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
        saves: stats.saves || 0,
        bonus: stats.bonus || 0,
        clean_sheets: stats.clean_sheets || 0,
        goals_scored: stats.goals_scored || 0,
        assists: stats.assists || 0,
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

    // Fetch picks for all gameweeks using a single historical picks process per GW
    const formationFrequency: Record<string, number> = {};
    const gwPicksMap = new Map<number, any>();
    const sortedGwHistory = [...gwHistory].sort((a: any, b: any) => a.event - b.event);

    await Promise.all(
      sortedGwHistory.map(async (h: any) => {
        const picksData = await getEntryPicks(entryId, h.event).catch(() => null);
        if (picksData) {
          gwPicksMap.set(h.event, picksData);
        }
      })
    );

    const captainPerformance: any[] = [];
    const transferHistory: any[] = [];
    let lastPermanentPicks: any[] = [];

    for (const h of sortedGwHistory) {
      const picksData = gwPicksMap.get(h.event);
      if (!picksData) continue;

      const picks = picksData.picks || [];
      const activeChip = picksData?.active_chip ? String(picksData.active_chip).toUpperCase() : null;
      const isFreeHit = activeChip === 'FREEHIT' || activeChip === 'FH';
      const isWildcard = activeChip === 'WILDCARD' || activeChip === 'WC';

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

      // --- Captain Performance calculation ---
      const captainPick = picks.find((p: any) => p.is_captain);
      const vicePick = picks.find((p: any) => p.is_vice_captain);

      if (captainPick) {
        const captainPlayer = elementsMap.get(captainPick.element);
        const vicePlayer = vicePick ? elementsMap.get(vicePick.element) : null;
        
        const liveData = await getLiveEvent(h.event).catch(() => null);
        const liveMapForGW = new Map<number, any>((liveData?.elements || []).map((el: any) => [el.id, el.stats]));
        const captainStats = liveMapForGW.get(captainPick.element);
        
        const capMult = captainPick.multiplier || 1;
        const rawPoints = captainStats?.total_points || 0;
        const captainPoints = rawPoints * capMult;

        captainPerformance.push({
          event: h.event,
          captainName: captainPlayer?.web_name || '—',
          viceName: vicePlayer?.web_name || '—',
          rawPoints,
          captainPoints,
          multiplier: capMult,
        });
      }
      // ---------------------------------------

      // --- Transfer History calculation ---
      if (h.event === 1) {
        lastPermanentPicks = picks;
      } else {
        if (isFreeHit) {
          transferHistory.push({
            event: h.event,
            transfers: h.transfers || 0,
            cost: h.transfersCost || 0,
            chip: 'FREEHIT',
            isTemporary: true,
            transfersOut: [],
            transfersIn: []
          });
        } else {
          const previousIds = new Set<number>(lastPermanentPicks.map((p: any) => Number(p.element)));
          const currentIds = new Set<number>(picks.map((p: any) => Number(p.element)));

          const outIds = [...previousIds].filter((id: number) => !currentIds.has(id));
          const inIds = [...currentIds].filter((id: number) => !previousIds.has(id));

          if ((h.transfers && h.transfers > 0) || isWildcard || outIds.length > 0 || inIds.length > 0) {
            const posMap: Record<number, string> = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
            const transfersOut = outIds.map(id => {
              const el = elementsMap.get(id) || {};
              const team = teamsMap.get(el.team) || {};
              return {
                id,
                name: el.web_name || 'Player',
                team: team.short_name || '',
                position: posMap[el.element_type] || 'MID'
              };
            });

            const transfersIn = inIds.map(id => {
              const el = elementsMap.get(id) || {};
              const team = teamsMap.get(el.team) || {};
              return {
                id,
                name: el.web_name || 'Player',
                team: team.short_name || '',
                position: posMap[el.element_type] || 'MID'
              };
            });

            transferHistory.push({
              event: h.event,
              transfers: h.transfers || (inIds.length > 0 ? inIds.length : 0),
              cost: h.transfersCost || 0,
              chip: isWildcard ? 'WILDCARD' : null,
              isTemporary: false,
              transfersOut,
              transfersIn
            });
          }
          lastPermanentPicks = picks;
        }
      }
      // ------------------------------------
    }

    let bestGameweek: { event: number; points: number } | null = null;
    let worstGameweek: { event: number; points: number } | null = null;

    if (gwHistory && gwHistory.length > 0) {
      let best = gwHistory[0];
      let worst = gwHistory[0];

      for (const h of gwHistory) {
        const pts = h.points ?? 0;
        const bestPts = best.points ?? 0;
        const worstPts = worst.points ?? 0;

        if (pts > bestPts) {
          best = h;
        } else if (pts === bestPts && h.event < best.event) {
          best = h;
        }

        if (pts < worstPts) {
          worst = h;
        } else if (pts === worstPts && h.event < worst.event) {
          worst = h;
        }
      }

      bestGameweek = { event: best.event, points: best.points ?? 0 };
      worstGameweek = { event: worst.event, points: worst.points ?? 0 };
    }

    let productiveCaptain: { name: string; timesCaptained: number; totalPoints: number; avgPoints: number } | null = null;
    const filteredCaptainPerf = captainPerformance.filter(Boolean);
    if (filteredCaptainPerf.length > 0) {
      const capMap = new Map<string, { totalPoints: number; timesCaptained: number }>();
      for (const cp of filteredCaptainPerf) {
        const name = cp.captainName;
        if (!name || name === '—') continue;
        const curr = capMap.get(name) || { totalPoints: 0, timesCaptained: 0 };
        curr.totalPoints += cp.captainPoints;
        curr.timesCaptained += 1;
        capMap.set(name, curr);
      }

      const capList = Array.from(capMap.entries()).map(([name, data]) => ({
        name,
        timesCaptained: data.timesCaptained,
        totalPoints: data.totalPoints,
        avgPoints: Number((data.totalPoints / data.timesCaptained).toFixed(1))
      }));

      if (capList.length > 0) {
        capList.sort((a, b) => {
          if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
          if (b.timesCaptained !== a.timesCaptained) return b.timesCaptained - a.timesCaptained;
          return a.name.localeCompare(b.name);
        });
        productiveCaptain = capList[0];
      }
    }

    let favoriteFormation: { formation: string; count: number; percentage: number } | null = null;
    const formationEntries = Object.entries(formationFrequency);
    if (formationEntries.length > 0) {
      const totalFormations = formationEntries.reduce((sum, [_, count]) => sum + (count as number), 0);
      formationEntries.sort((a, b) => {
        if ((b[1] as number) !== (a[1] as number)) return (b[1] as number) - (a[1] as number);
        return a[0].localeCompare(b[0]);
      });
      const [formation, count] = formationEntries[0];
      const percentage = totalFormations > 0 ? Number((((count as number) / totalFormations) * 100).toFixed(1)) : 0;
      favoriteFormation = {
        formation,
        count: count as number,
        percentage
      };
    }

    const totalTransfers = gwHistory.reduce((sum: number, h: any) => sum + (h.transfers || 0), 0);
    const totalTransferCost = gwHistory.reduce((sum: number, h: any) => sum + (h.transfersCost || 0), 0);

    const performanceInsights = {
      bestGameweek,
      worstGameweek,
      productiveCaptain,
      favoriteFormation,
      totalTransfers,
      totalTransferCost
    };

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
      transferHistory,
      performanceInsights,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
