import { NextResponse } from 'next/server';
import { getBootstrap, getFixtures } from '@/lib/fpl';

// Simple in-memory cache to respect the 5-minute requirement
let cache: { data: any; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000;

export async function GET() {
  const now = Date.now();

  if (cache && now - cache.timestamp < CACHE_DURATION) {
    return NextResponse.json(cache.data);
  }

  try {
    // 1. Fetch data
    const [bootstrap, fixtures] = await Promise.all([
      getBootstrap(),
      getFixtures()
    ]);

    const { elements, element_types, teams, events } = bootstrap;
    const currentEvent = events.find((e: any) => e.is_current) || events[0];

    // Map teams
    const teamMap = teams.reduce((acc: any, team: any) => {
      acc[team.id] = team.short_name;
      return acc;
    }, {});

    const teamFullNameMap = teams.reduce((acc: any, team: any) => {
      acc[team.id] = team.name;
      return acc;
    }, {});

    // Map positions (1=GKP, 2=DEF, 3=MID, 4=FWD)
    const posMap = element_types.reduce((acc: any, type: any) => {
      acc[type.id] = type.singular_name_short;
      return acc;
    }, {});

    // Determine the next 3 upcoming gameweeks globally
    const upcomingEvents = events
      .filter((e: any) => e.is_next || (!e.finished && e.is_current) || (e.id >= currentEvent.id && !e.finished))
      .sort((a: any, b: any) => a.id - b.id)
      .slice(0, 3)
      .map((e: any) => e.id);

    const targetGWs = upcomingEvents.length > 0 
      ? upcomingEvents 
      : [currentEvent.id + 1, currentEvent.id + 2, currentEvent.id + 3];

    // Helper for next 3 fixtures
    const getNext3Fixtures = (teamId: number) => {
      // Get all future fixtures for the team
      const teamFixtures = fixtures.filter(
        (f: any) => (f.team_h === teamId || f.team_a === teamId) && (f.event > currentEvent.id || (f.event === currentEvent.id && !f.finished))
      );

      // Group by event
      const fixturesByEvent = teamFixtures.reduce((acc: any, f: any) => {
        if (!acc[f.event]) acc[f.event] = [];
        acc[f.event].push(f);
        return acc;
      }, {});

      return targetGWs.map((eventId: number) => {
        const eventFixtures = fixturesByEvent[eventId] || [];
        if (eventFixtures.length === 0) {
          return {
            gw: Number(eventId),
            opponent: 'Blank',
            isHome: false,
            difficulty: 0,
            label: 'Blank GW',
            isBlank: true,
            isDGW: false,
            fixtures: []
          };
        }

        const isDGW = eventFixtures.length > 1;
        const fixturesList = eventFixtures.map((f: any) => {
          const isHome = f.team_h === teamId;
          const opponentId = isHome ? f.team_a : f.team_h;
          const difficulty = isHome ? (f.team_h_difficulty ?? 3) : (f.team_a_difficulty ?? 3);
          return {
            opponent: teamMap[opponentId] || 'Unknown',
            isHome,
            difficulty,
            label: `${teamMap[opponentId] || 'Unknown'} (${isHome ? 'H' : 'A'})`
          };
        });

        const firstF = eventFixtures[0];
        const isHome = firstF.team_h === teamId;
        const opponentId = isHome ? firstF.team_a : firstF.team_h;
        const difficulty = isHome ? (firstF.team_h_difficulty ?? 3) : (firstF.team_a_difficulty ?? 3);

        return {
          gw: Number(eventId),
          opponent: teamMap[opponentId] || 'Unknown',
          isHome: isHome,
          difficulty,
          label: isDGW 
            ? fixturesList.map((x: any) => x.label).join(' + ')
            : `${teamMap[opponentId] || 'Unknown'} (${isHome ? 'H' : 'A'})`,
          isDGW,
          isBlank: false,
          fixtures: fixturesList
        };
      });
    };

    // 2. Transform
    const transformed = elements.map((p: any) => {
      const netTransfers = (p.transfers_in_event ?? 0) - (p.transfers_out_event ?? 0);
      const ownership = parseFloat(p.selected_by_percent || '0');
      const sqrtOwnership = Math.sqrt(Math.max(0.01, ownership));
      
      // Check for flags/injury
      const isAvailable = p.status === 'a';
      const flagMultiplier = !isAvailable ? 4 : 1; 
      
      const thresholdRise = (1500 * sqrtOwnership) * flagMultiplier;
      const thresholdFall = (1200 * sqrtOwnership) * flagMultiplier;
      
      // Calculate progress
      let progressVal = 0;
      if (netTransfers > 0 && thresholdRise > 0) {
        progressVal = (netTransfers / thresholdRise) * 100;
      } else if (netTransfers < 0 && thresholdFall > 0) {
        progressVal = (netTransfers / thresholdFall) * 100;
      }
      
      const predictedProgressVal = progressVal * 1.5;
      const clampedProgress = Math.max(Math.min(progressVal, 100), -100);
      const clampedPredicted = Math.max(Math.min(predictedProgressVal, 100), -100);
      
      // Determine status
      let statusLabel = "Unlikely to Change";
      let statusColor = "bg-slate-800";
      
      if (!isAvailable) {
        statusLabel = "Locked / Unlikely";
        statusColor = "bg-slate-700";
      } else if (p.cost_change_event > 0 || (netTransfers > 0 && clampedProgress >= 100)) {
        statusLabel = "Very Likely to Rise 🔥";
        statusColor = "bg-green-600";
      } else if (p.cost_change_event_fall > 0 || (netTransfers < 0 && clampedProgress <= -100)) {
        statusLabel = "Very Likely to Drop 🔻";
        statusColor = "bg-red-600";
      } else if (clampedProgress >= 80) {
        statusLabel = "Likely to Rise";
        statusColor = "bg-green-900";
      } else if (clampedProgress <= -80) {
        statusLabel = "Likely to Drop";
        statusColor = "bg-red-900";
      }

      const teamShort = teamMap[p.team] || 'Unknown';
      const teamFull = teamFullNameMap[p.team] || 'Unknown';
      const positionCode = posMap[p.element_type] || 'MID';
      const fullName = `${p.first_name || ''} ${p.second_name || ''}`.trim() || p.web_name;
      const rawCost = Number(p.now_cost ?? 0);
      const priceVal = Number((rawCost / 10).toFixed(1));

      return {
        id: Number(p.id),
        name: p.web_name || 'Unknown',
        fullName: fullName,
        team: teamFull,
        teamShortName: teamShort,
        team_short: teamShort,
        position: positionCode,

        // V6.1 Season Statistics
        points: Number(p.total_points ?? 0),
        goals: Number(p.goals_scored ?? 0),
        assists: Number(p.assists ?? 0),

        xG: parseFloat(p.expected_goals || '0') || 0,
        xA: parseFloat(p.expected_assists || '0') || 0,
        xGI: parseFloat(p.expected_goal_involvements || '0') || 0,

        defensiveContribution: Number(p.defensive_contribution ?? 0),

        yellowCards: Number(p.yellow_cards ?? 0),
        redCards: Number(p.red_cards ?? 0),
        ownGoals: Number(p.own_goals ?? 0),

        minutes: Number(p.minutes ?? 0),
        starts: Number(p.starts ?? 0),
        cleanSheets: Number(p.clean_sheets ?? 0),

        bonus: Number(p.bonus ?? 0),
        bps: Number(p.bps ?? 0),

        price: priceVal,
        selectedBy: parseFloat(p.selected_by_percent || '0') || 0,
        form: parseFloat(p.form || '0') || 0,
        ictIndex: parseFloat(p.ict_index || '0') || 0,

        // Backward compatibility properties
        price_raw: rawCost,
        status: statusLabel,
        status_color: statusColor,
        progress: `${clampedProgress.toFixed(1)}%`,
        predicted_progress: `${clampedPredicted.toFixed(1)}%`,
        next_3_gw: getNext3Fixtures(p.team),
        eo_percent: `${p.selected_by_percent || '0'}%`,
        total_points: Number(p.total_points ?? 0),
        goals_scored: Number(p.goals_scored ?? 0),
        clean_sheets: Number(p.clean_sheets ?? 0),
        yellow_cards: Number(p.yellow_cards ?? 0),
        red_cards: Number(p.red_cards ?? 0),
        saves: Number(p.saves ?? 0)
      };
    });

    cache = { data: transformed, timestamp: now };

    return NextResponse.json(transformed);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch FPL data' }, { status: 500 });
  }
}
