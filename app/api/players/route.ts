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

    // Map positions
    const posMap = element_types.reduce((acc: any, type: any) => {
      acc[type.id] = type.singular_name_short === 'GKP' ? 'GK' : type.singular_name_short;
      return acc;
    }, {});

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

      // Take next 3 unique events
      const nextEvents = Object.keys(fixturesByEvent).sort((a,b) => Number(a) - Number(b)).slice(0, 3);
      
      return nextEvents.map(eventId => {
        const eventFixtures = fixturesByEvent[eventId];
        // Take the first fixture of the GW
        const f = eventFixtures[0];
        const isHome = f.team_h === teamId;
        const opponentId = isHome ? f.team_a : f.team_h;
        const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;
        
        return {
          gw: Number(eventId),
          opponent: teamMap[opponentId],
          isHome: isHome,
          difficulty,
          label: `${teamMap[opponentId]} (${isHome ? 'H' : 'A'})`
        };
      });
    };

    // 2. Transform
    const transformed = elements.map((p: any) => {
      // Correct logic for price change prediction:
      // FPL provides cost_change_event (change this GW) and cost_change_event_fall (fallback)
      // Usually, transfers_in/out relative to market threshold is the standard estimation method.
      // momentum is correct.
      
      const momentum = p.transfers_in_event - p.transfers_out_event;
      
      // Logic for price change prediction
      const netTransfers = p.transfers_in_event - p.transfers_out_event;
      const ownership = parseFloat(p.selected_by_percent);
      const sqrtOwnership = Math.sqrt(ownership);
      
      const thresholdRise = 1500 * sqrtOwnership;
      const thresholdFall = 1200 * sqrtOwnership;
      
      // Calculate progress
      let progressVal = 0;
      if (netTransfers > 0) {
        progressVal = (netTransfers / thresholdRise) * 100;
      } else if (netTransfers < 0) {
        progressVal = (netTransfers / thresholdFall) * 100;
      }
      
      // Clamp progress
      progressVal = Math.max(Math.min(progressVal, 100), -100);
      
      // Determine status
      let statusLabel = "Stable";
      let statusColor = "bg-slate-800";
      
      if (p.cost_change_event > 0) {
        statusLabel = "Price Rise";
        statusColor = "bg-green-900";
      } else if (p.cost_change_event_fall > 0) {
        statusLabel = "Price Fall";
        statusColor = "bg-red-900";
      } else if (progressVal >= 100) {
        statusLabel = "Riser / High Risk of Rise";
        statusColor = "bg-green-600";
      } else if (progressVal >= 70) {
        statusLabel = "Building Momentum (Rise)";
        statusColor = "bg-green-900";
      } else if (progressVal <= -100) {
        statusLabel = "Faller / High Risk of Fall";
        statusColor = "bg-red-600";
      } else if (progressVal <= -70) {
        statusLabel = "Building Momentum (Fall)";
        statusColor = "bg-red-900";
      }

      return {
        id: p.id,
        name: p.web_name,
        team_short: teamMap[p.team],
        position: posMap[p.element_type],
        price: `£${(p.now_cost / 10).toFixed(1)}m`,
        price_raw: p.now_cost,
        status: statusLabel,
        status_color: statusColor,
        progress: `${progressVal > 0 ? '+' : ''}${progressVal.toFixed(1)}%`,
        next_3_gw: getNext3Fixtures(p.team),
        form: parseFloat(p.form).toFixed(1),
        eo_percent: `${p.selected_by_percent}%`
      };
    });

    cache = { data: transformed, timestamp: now };

    return NextResponse.json(transformed);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch FPL data' }, { status: 500 });
  }
}
