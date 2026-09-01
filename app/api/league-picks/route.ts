import { NextResponse } from 'next/server';
import { getBootstrap, getEntryPicks, getLeague, getLiveEvent, LEAGUE_ID } from '@/lib/fpl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') || 1));

  try {
    const [league, boot] = await Promise.all([
      getLeague(page).catch(() => null),
      getBootstrap().catch(() => null)
    ]);

    if (!league || !league.standings) {
      return NextResponse.json(
        { ok: false, error: 'API FPL sedang sibuk atau memblokir akses sementara (403/Rate-limit). Coba refresh dalam beberapa saat.', leagueId: LEAGUE_ID },
        { status: 503 }
      );
    }

    const standings = league.standings?.results ?? [];
    const current = boot?.events?.find((e: any) => e.is_current)?.id ?? boot?.events?.find((e: any) => e.is_next)?.id ?? 1;

    const liveData = await getLiveEvent(current).catch(() => null);

    const elementsMap = new Map<number, any>((boot?.elements || []).map((el: any) => [el.id, el]));
    const teamsMap = new Map<number, any>((boot?.teams || []).map((t: any) => [t.id, t]));
    const liveMap = new Map<number, any>((liveData?.elements || []).map((el: any) => [el.id, el.stats]));

    // Fetch picks in batches to avoid triggering Cloudflare rate-limit / 403
    const picksResults = [];
    const chunkSize = 10;
    for (let i = 0; i < standings.length; i += chunkSize) {
      const chunk = standings.slice(i, i + chunkSize);
      const chunkRes = await Promise.all(
        chunk.map(async (row) => {
          try {
            const picksData = await getEntryPicks(row.entry, current);
            const picks = picksData.picks || [];
            const activeChip = picksData.active_chip ? String(picksData.active_chip).toUpperCase() : null;

            const isBB = activeChip === 'BB' || activeChip === 'BBOOST';
            const startingPicks = picks.filter((p: any) => isBB ? true : p.position <= 11);

            const starters11 = picks.filter((p: any) => p.position <= 11);
            let defCount = 0, midCount = 0, fwdCount = 0;
            starters11.forEach((p: any) => {
              const el = elementsMap.get(p.element);
              if (el?.element_type === 2) defCount++;
              else if (el?.element_type === 3) midCount++;
              else if (el?.element_type === 4) fwdCount++;
            });
            const formation = `${defCount}-${midCount}-${fwdCount}`;

            let playedCount = 0;
            startingPicks.forEach((p: any) => {
              const stats = liveMap.get(p.element);
              if (stats && stats.minutes > 0) playedCount++;
            });

            const captainPick = picks.find((p: any) => p.is_captain);
            const vicePick = picks.find((p: any) => p.is_vice_captain);
            
            const captainPlayer: any = captainPick ? elementsMap.get(captainPick.element) : null;
            const vicePlayer: any = vicePick ? elementsMap.get(vicePick.element) : null;

            const captainLiveStats = captainPick ? liveMap.get(captainPick.element) : null;
            const viceLiveStats = vicePick ? liveMap.get(vicePick.element) : null;

            const capMult = captainPick?.multiplier || (activeChip === '3XC' || activeChip === 'TC' ? 3 : 2);
            const captainPoints = captainLiveStats ? (captainLiveStats.total_points || 0) * capMult : 0;
            const vicePoints = viceLiveStats ? (viceLiveStats.total_points || 0) : 0;
            
            const lineupPoints = startingPicks.reduce((sum: number, p: any) => {
              const stats = liveMap.get(p.element);
              const mult = p.multiplier || 1;
              return sum + ((stats?.total_points || 0) * mult);
            }, 0);

            const bonusPoints = startingPicks.reduce((sum: number, p: any) => {
              const stats = liveMap.get(p.element);
              return sum + (stats?.bonus || 0);
            }, 0);

            const benchPoints = picksData.entry_history?.points_on_bench || 0;
            const transfersCost = picksData.entry_history?.event_transfers_cost || 0;
            const netPoints = lineupPoints - transfersCost;

            const valueRaw = picksData.entry_history?.value || 1000;
            const teamValue = (valueRaw / 10).toFixed(1);
            const bankRaw = picksData.entry_history?.bank || 0;
            const bankValue = (bankRaw / 10).toFixed(1);

            const picksList = picks.map((p: any) => {
              const el = elementsMap.get(p.element) || {};
              const team = teamsMap.get(el.team) || {};
              const stats = liveMap.get(p.element) || {};
              const mult = p.multiplier || 1;
              const teamCode = team.code || 1;
              const isGkp = el.element_type === 1;

              const jerseyUrl = isGkp
                ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}_1-66.png`
                : `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}-66.png`;

              return {
                id: p.element,
                name: el.web_name || 'Player',
                elementType: el.element_type || 1,
                teamCode: teamCode,
                teamShortName: team.short_name || '',
                jerseyUrl: jerseyUrl,
                position: p.position,
                multiplier: mult,
                isCaptain: p.is_captain,
                isVice: p.is_vice_captain,
                points: (stats.total_points || 0) * mult,
                rawPoints: stats.total_points || 0,
                minutes: stats.minutes || 0,
                goals_scored: stats.goals_scored || 0,
                assists: stats.assists || 0,
                saves: stats.saves || 0,
                clean_sheets: stats.clean_sheets || 0,
                bonus: stats.bonus || 0,
                yellow_cards: stats.yellow_cards || 0,
                red_cards: stats.red_cards || 0,
                own_goals: stats.own_goals || 0,
              };
            });

            return {
              entry: row.entry,
              captainName: captainPlayer ? captainPlayer.web_name : '—',
              viceName: vicePlayer ? vicePlayer.web_name : '—',
              captainPoints,
              vicePoints,
              lineupPoints,
              benchPoints,
              bonusPoints,
              transfersCost,
              netPoints,
              teamValue,
              bankValue,
              formation,
              chip: activeChip,
              playedCount,
              totalPicks: startingPicks.length,
              totalGamesCount: startingPicks.length,
              picksList,
            };
          } catch {
            return {
              entry: row.entry,
              captainName: '—',
              viceName: '—',
              captainPoints: 0,
              vicePoints: 0,
              lineupPoints: row.event_total,
              benchPoints: 0,
              bonusPoints: 0,
              transfersCost: 0,
              netPoints: row.event_total,
              teamValue: '100.0',
              bankValue: '0.0',
              formation: '3-4-3',
              chip: null,
              playedCount: 0,
              totalPicks: 11,
              totalGamesCount: 11,
              picksList: [],
            };
          }
        })
      );
      picksResults.push(...chunkRes);
    }

    const detailsMap = Object.fromEntries(picksResults.map((p) => [p.entry, p]));

    return NextResponse.json(
      {
        ok: true,
        league: league.league,
        standings,
        details: detailsMap,
        hasNext: Boolean(league.standings?.has_next),
        page,
        current,
        leagueId: LEAGUE_ID,
        count: standings.length,
        source: 'Fantasy Premier League API',
      },
      { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=600' } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'FPL API unavailable', leagueId: LEAGUE_ID },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
