import { NextResponse } from 'next/server';
import { getBootstrap, getLeagueStandings, getEntryPicks, getLiveEvent } from '@/lib/fpl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') || 1);

  try {
    const boot = await getBootstrap();
    const currentGWObj = boot?.events?.find((e: any) => e.is_current) || boot?.events?.find((e: any) => e.is_next) || boot?.events?.[0];
    const nextGWObj = boot?.events?.find((e: any) => e.is_next) || currentGWObj;
    const currentGW = currentGWObj?.id || 1;

    const standingsData = await getLeagueStandings(134820, page);
    const league = standingsData?.league || {};
    const standings = standingsData?.standings?.results || [];
    const hasNext = standingsData?.standings?.has_next || false;

    const liveData = await getLiveEvent(currentGW).catch(() => null);
    const elementsMap = new Map<number, any>((boot?.elements || []).map((el: any) => [el.id, el]));
    const teamsMap = new Map<number, any>((boot?.teams || []).map((t: any) => [t.id, t]));
    const liveMap = new Map<number, any>((liveData?.elements || []).map((el: any) => [el.id, el.stats]));

    const details: Record<number, any> = {};

    await Promise.all(
      standings.map(async (row: any) => {
        try {
          const picksData = await getEntryPicks(row.entry, currentGW);
          const picks = picksData?.picks || [];
          const activeChip = picksData?.active_chip ? String(picksData.active_chip).toUpperCase() : null;
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

          const captainPlayer = captainPick ? elementsMap.get(captainPick.element) : null;
          const vicePlayer = vicePick ? elementsMap.get(vicePick.element) : null;

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

          const benchPoints = picksData?.entry_history?.points_on_bench || 0;
          const transfersCost = picksData?.entry_history?.event_transfers_cost || 0;
          const netPoints = lineupPoints - transfersCost;

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
            };
          });

          details[row.entry] = {
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
            teamValue: ((picksData?.entry_history?.value || 1000) / 10).toFixed(1),
            bankValue: ((picksData?.entry_history?.bank || 0) / 10).toFixed(1),
            formation,
            chip: activeChip,
            playedCount,
            totalPicks: startingPicks.length,
            totalGamesCount: 11,
            picksList,
          };
        } catch {}
      })
    );

    return NextResponse.json({
      ok: true,
      league,
      standings,
      details,
      hasNext,
      page,
      current: currentGW,
      nextGW: {
        id: nextGWObj?.id,
        name: nextGWObj?.name || `Gameweek ${nextGWObj?.id}`,
        deadlineTime: nextGWObj?.deadline_time,
        isNext: nextGWObj?.is_next,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server Error' }, { status: 500 });
  }
}
