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
      return fixtures
        .filter((f: any) => (f.team_h === teamId || f.team_a === teamId) && f.event >= currentEvent.id)
        .slice(0, 3)
        .map((f: any) => {
          const isHome = f.team_h === teamId;
          const opponentId = isHome ? f.team_a : f.team_h;
          const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;
          return {
            opponent: teamMap[opponentId],
            is_home: isHome,
            difficulty,
            label: `${teamMap[opponentId]} (${isHome ? 'H' : 'A'})`
          };
        });
    };

    // 2. Transform
    const transformed = elements.map((p: any) => {
      const momentum = p.transfers_in_event - p.transfers_out_event;
      let status = "Unlikely to Change";
      if (momentum > 10000) status = "Likely Rise";
      else if (momentum < -10000) status = "Likely Fall";

      const progress = p.transfers_in_event > 0 
        ? `${((momentum / p.transfers_in_event) * 100).toFixed(0)}%` 
        : "0%";

      return {
        id: p.id,
        name: p.web_name,
        team_short: teamMap[p.team],
        position: posMap[p.element_type],
        price: `£${(p.now_cost / 10).toFixed(1)}m`,
        price_raw: p.now_cost,
        status,
        progress: momentum >= 0 ? `+${progress}` : progress,
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
