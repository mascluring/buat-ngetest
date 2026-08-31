import { NextResponse } from 'next/server';
import { getBootstrap, getEntry, getEntryHistory, getEntryPicks, getLiveEvent } from '@/lib/fpl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entryId = Number(id);

    if (isNaN(entryId)) {
      return NextResponse.json({ ok: false, error: 'ID Manager tidak valid' }, { status: 400 });
    }

    const [entry, history, boot] = await Promise.all([
      getEntry(entryId).catch(() => null),
      getEntryHistory(entryId).catch(() => null),
      getBootstrap().catch(() => null),
    ]);

    if (!entry) {
      return NextResponse.json({ ok: false, error: 'Manager tidak ditemukan di FPL' }, { status: 404 });
    }

    const currentGW = boot?.events?.find((e: any) => e.is_current)?.id ?? boot?.events?.find((e: any) => e.is_next)?.id ?? 1;
    
    // Fetch picks & live stats for latest GW
    let picksData = null;
    let liveData = null;
    try {
      [picksData, liveData] = await Promise.all([
        getEntryPicks(entryId, currentGW).catch(() => null),
        getLiveEvent(currentGW).catch(() => null),
      ]);
    } catch {}

    const elementsMap = new Map<number, any>((boot?.elements || []).map((el: any) => [el.id, el]));
    const teamsMap = new Map<number, any>((boot?.teams || []).map((t: any) => [t.id, t]));
    const liveMap = new Map<number, any>((liveData?.elements || []).map((el: any) => [el.id, el.stats]));

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

    const gwHistory = (history?.current || []).map((h: any) => ({
      event: h.event,
      points: h.points,
      totalPoints: h.total_points,
      rank: h.rank,
      overallRank: h.overall_rank,
      bank: (h.bank / 10).toFixed(1),
      value: (h.value / 10).toFixed(1),
      transfers: h.event_transfers,
      transfersCost: h.event_transfers_cost,
      benchPoints: h.points_on_bench,
    }));

    const chipsUsed = (history?.chips || []).map((c: any) => ({
      name: String(c.name).toUpperCase(),
      event: c.event,
      time: c.time,
    }));

    // Fetch picks for all gameweeks
    const formationFrequency: Record<string, number> = {};
    const captainPerformance = await Promise.all(
      gwHistory.map(async (h: any) => {
        const picksData = await getEntryPicks(entryId, h.event).catch(() => null);
        if (!picksData) return null;
        
        const picks = picksData.picks || [];
        
        // --- Formation calculation ---
        const starters11 = picks.filter((p: any) => p.position <= 11);
        let def = 0, mid = 0, fwd = 0;
        starters11.forEach((p: any) => {
          const el = elementsMap.get(p.element);
          if (el?.element_type === 2) def++;
          else if (el?.element_type === 3) mid++;
          else if (el?.element_type === 4) fwd++;
        });
        const formation = `${def}-${mid}-${fwd}`;
        formationFrequency[formation] = (formationFrequency[formation] || 0) + 1;
        // -----------------------------

        const captainPick = picks.find((p: any) => p.is_captain);
        const vicePick = picks.find((p: any) => p.is_vice_captain);

        if (!captainPick) return null;

        const captainPlayer = elementsMap.get(captainPick.element);
        const vicePlayer = vicePick ? elementsMap.get(vicePick.element) : null;
        
        // We need live points for that GW. getLiveEvent(h.event)
        const liveData = await getLiveEvent(h.event).catch(() => null);
        const liveMapForGW = new Map<number, any>((liveData?.elements || []).map((el: any) => [el.id, el.stats]));
        const captainStats = liveMapForGW.get(captainPick.element);
        
        const capMult = captainPick.multiplier || 1;
        const rawPoints = captainStats?.total_points || 0;
        const captainPoints = rawPoints * capMult;

        return {
          event: h.event,
          captainName: captainPlayer?.web_name || '—',
          viceName: vicePlayer?.web_name || '—',
          rawPoints,
          captainPoints,
          multiplier: capMult,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      entry: {
        id: entry.id,
        name: entry.name,
        playerFirstName: entry.player_first_name,
        playerLastName: entry.player_last_name,
        playerName: `${entry.player_first_name} ${entry.player_last_name}`,
        overallRank: entry.summary_overall_rank,
        overallPoints: entry.summary_overall_points,
        teamValue: ((entry.last_deadline_value || 1000) / 10).toFixed(1),
        bank: ((entry.last_deadline_bank || 0) / 10).toFixed(1),
      },
      detail: {
        formation,
        chip: activeChip,
        captainName: captainPlayer ? captainPlayer.web_name : '—',
        viceName: vicePlayer ? vicePlayer.web_name : '—',
        captainPoints,
        vicePoints,
        lineupPoints,
        benchPoints,
        bonusPoints,
        transfersCost,
        netPoints,
        playedCount,
        totalPicks: startingPicks.length,
        picksList,
      },
      currentGW,
      gwHistory,
      chipsUsed,
      captainPerformance: captainPerformance.filter(Boolean),
      formationFrequency,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
