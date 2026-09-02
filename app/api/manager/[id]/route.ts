import { NextResponse } from 'next/server';
import { getBootstrap, getEntry, getEntryHistory, getEntryPicks, getLiveEvent } from '@/lib/fpl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.all(
      batch.map(mapper)
    );
    results.push(...batchResults);
  }
  return results;
}

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
    const liveElementsMap = new Map<number, any>((liveData?.elements || []).map((el: any) => [el.id, el]));
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
      const liveEl = liveElementsMap.get(p.element) || {};
      const stats = liveEl.stats || liveMap.get(p.element) || {};
      const mult = p.multiplier || 1;
      const teamCode = team.code || 1;
      const isGkp = el.element_type === 1;

      const jerseyUrl = isGkp
        ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}_1-66.png`
        : `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}-66.png`;

      // Calculate official defensive contribution points from explain if available
      let dcPoints = 0;
      (liveEl.explain || []).forEach((fixture: any) => {
        (fixture.stats || []).forEach((s: any) => {
          if (s.identifier === 'defensive_contribution') {
            dcPoints += (s.points || 0);
          }
        });
      });

      const posName = el.element_type === 1 ? 'GKP' : el.element_type === 2 ? 'DEF' : el.element_type === 3 ? 'MID' : 'FWD';

      return {
        id: p.element,
        name: el.web_name || 'Player',
        fullName: `${el.first_name || ''} ${el.second_name || ''}`.trim() || el.web_name || 'Player',
        elementType: el.element_type || 1,
        positionName: posName,
        teamCode: teamCode,
        teamShortName: team.short_name || '',
        teamName: team.name || '',
        jerseyUrl: jerseyUrl,
        position: p.position,
        multiplier: mult,
        isCaptain: p.is_captain,
        isVice: p.is_vice_captain,
        points: (stats.total_points || 0) * mult,
        rawPoints: stats.total_points || 0,
        minutes: stats.minutes ?? 0,
        total_points: stats.total_points ?? 0,
        goals_scored: stats.goals_scored ?? 0,
        assists: stats.assists ?? 0,
        clean_sheets: stats.clean_sheets ?? 0,
        goals_conceded: stats.goals_conceded ?? 0,
        own_goals: stats.own_goals ?? 0,
        penalties_saved: stats.penalties_saved ?? 0,
        penalties_missed: stats.penalties_missed ?? 0,
        yellow_cards: stats.yellow_cards ?? 0,
        red_cards: stats.red_cards ?? 0,
        saves: stats.saves ?? 0,
        bonus: stats.bonus ?? 0,
        bps: stats.bps ?? 0,
        defensive_contribution: stats.defensive_contribution ?? 0,
        defensive_contribution_value: stats.defensive_contribution ?? 0,
        defensive_contribution_points: dcPoints,
        explain: liveEl.explain || [],
        breakdown: {
          minutes: stats.minutes ?? 0,
          totalPoints: stats.total_points ?? 0,
          goalsScored: stats.goals_scored ?? 0,
          assists: stats.assists ?? 0,
          cleanSheets: stats.clean_sheets ?? 0,
          goalsConceded: stats.goals_conceded ?? 0,
          ownGoals: stats.own_goals ?? 0,
          penaltiesSaved: stats.penalties_saved ?? 0,
          penaltiesMissed: stats.penalties_missed ?? 0,
          yellowCards: stats.yellow_cards ?? 0,
          redCards: stats.red_cards ?? 0,
          saves: stats.saves ?? 0,
          bonus: stats.bonus ?? 0,
          bps: stats.bps ?? 0,
          defensiveContribution: stats.defensive_contribution ?? 0,
          defensiveContributionValue: stats.defensive_contribution ?? 0,
          defensiveContributionPoints: dcPoints,
        },
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

    // Collect unique events for live data
    const uniqueEvents: number[] = [...new Set(
      sortedGwHistory
        .map((h: any) => h.event)
        .filter(Boolean)
    )];

    // Shared live data map with currentGW reuse
    const liveDataMap = new Map<number, any>();
    if (liveData && currentGW) {
      liveDataMap.set(currentGW, liveData);
    }

    const eventsToFetch = uniqueEvents.filter((ev: number) => !liveDataMap.has(ev));
    if (eventsToFetch.length > 0) {
      const liveResults = await mapWithConcurrency(
        eventsToFetch,
        5,
        async (event: number) => {
          const live = await getLiveEvent(event).catch(() => null);
          return [event, live] as const;
        }
      );
      for (const [event, live] of liveResults) {
        if (live) {
          liveDataMap.set(event, live);
        }
      }
    }

    // --- V5.9 SQUAD EVOLUTION & PLAYER HISTORY CALCULATION ---
    const playerHistoryMap = new Map<number, {
      id: number;
      name: string;
      team: string;
      position: "GKP" | "DEF" | "MID" | "FWD";
      events: number[];
    }>();

    const permanentEvents: number[] = [];
    const posMap: Record<number, "GKP" | "DEF" | "MID" | "FWD"> = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
    let latestValidPermanentSquadEvent: number | null = null;
    let latestPermanentPicksForSquad: any[] = [];

    for (const h of sortedGwHistory) {
      const picksData = gwPicksMap.get(h.event);
      if (!picksData) continue;

      const picks = picksData.picks || [];
      const activeChip = picksData?.active_chip ? String(picksData.active_chip).toUpperCase() : null;
      const isFreeHit = activeChip === 'FREEHIT' || activeChip === 'FH';

      if (isFreeHit) {
        // Exclude Free Hit squad from permanent player history & squad evolution
        continue;
      }

      permanentEvents.push(h.event);
      latestValidPermanentSquadEvent = h.event;
      latestPermanentPicksForSquad = picks;

      for (const p of picks) {
        const playerId = Number(p.element);
        const el = elementsMap.get(playerId) || {};
        const team = teamsMap.get(el.team) || {};
        const name = el.web_name || 'Player';
        const teamName = team.short_name || '';
        const position = posMap[el.element_type] || 'MID';

        if (!playerHistoryMap.has(playerId)) {
          playerHistoryMap.set(playerId, {
            id: playerId,
            name,
            team: teamName,
            position,
            events: []
          });
        }
        playerHistoryMap.get(playerId)!.events.push(h.event);
      }
    }

    const currentSquadPlayerIds = new Set<number>(latestPermanentPicksForSquad.map((p: any) => Number(p.element)));

    const playersList = Array.from(playerHistoryMap.values()).map(item => {
      const sortedEvents = [...item.events].sort((a, b) => a - b);
      const firstEvent = sortedEvents[0];
      const lastEvent = sortedEvents[sortedEvents.length - 1];
      const gameweeksInSquad = sortedEvents.length;
      const status: "CURRENT" | "TRANSFERRED_OUT" = currentSquadPlayerIds.has(item.id) ? "CURRENT" : "TRANSFERRED_OUT";

      // Calculate periods (handling leaves and returns)
      const periods: { start: number; end: number }[] = [];
      if (sortedEvents.length > 0) {
        let start = sortedEvents[0];
        let prev = sortedEvents[0];

        for (let i = 1; i < sortedEvents.length; i++) {
          const curr = sortedEvents[i];
          if (curr === prev + 1) {
            prev = curr;
          } else {
            periods.push({ start, end: prev });
            start = curr;
            prev = curr;
          }
        }
        periods.push({ start, end: prev });
      }

      // Calculate longest streak and current streak
      let longestStreak = 0;
      let currentStreak = 0;
      if (periods.length > 0) {
        longestStreak = Math.max(...periods.map(p => p.end - p.start + 1));
        if (status === "CURRENT" && latestValidPermanentSquadEvent !== null) {
          // Find period that ends at latestValidPermanentSquadEvent
          const latestPeriod = periods.find(p => p.end === latestValidPermanentSquadEvent);
          currentStreak = latestPeriod ? latestPeriod.end - latestPeriod.start + 1 : 0;
        } else {
          currentStreak = 0;
        }
      }

      return {
        id: item.id,
        name: item.name,
        team: item.team,
        position: item.position,
        firstEvent,
        lastEvent,
        gameweeksInSquad,
        status,
        events: sortedEvents,
        periods,
        longestStreak,
        currentStreak
      };
    });

    // Sort players: CURRENT first, then longestStreak DESC, gameweeksInSquad DESC, name ASC
    playersList.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "CURRENT" ? -1 : 1;
      }
      if (b.longestStreak !== a.longestStreak) {
        return b.longestStreak - a.longestStreak;
      }
      if (b.gameweeksInSquad !== a.gameweeksInSquad) {
        return b.gameweeksInSquad - a.gameweeksInSquad;
      }
      return a.name.localeCompare(b.name);
    });

    const totalUniquePlayers = playersList.length;
    const currentSquadPlayers = playersList.filter(p => p.status === "CURRENT").length;
    const transferredOutPlayers = playersList.filter(p => p.status === "TRANSFERRED_OUT").length;

    // Determine Most Loyal Player based on rule:
    // 1. longestStreak DESC
    // 2. gameweeksInSquad DESC
    // 3. firstEvent ASC
    // 4. name ASC
    let mostLoyalPlayer: any = null;
    if (playersList.length > 0) {
      const sortedLoyal = [...playersList].sort((a, b) => {
        if (b.longestStreak !== a.longestStreak) return b.longestStreak - a.longestStreak;
        if (b.gameweeksInSquad !== a.gameweeksInSquad) return b.gameweeksInSquad - a.gameweeksInSquad;
        if (a.firstEvent !== b.firstEvent) return a.firstEvent - b.firstEvent;
        return a.name.localeCompare(b.name);
      });
      const topLoyal = sortedLoyal[0];
      mostLoyalPlayer = {
        id: topLoyal.id,
        name: topLoyal.name,
        team: topLoyal.team,
        gameweeksInSquad: topLoyal.gameweeksInSquad,
        longestStreak: topLoyal.longestStreak
      };
    }

    const squadEvolution = {
      latestEvent: latestValidPermanentSquadEvent,
      players: playersList,
      summary: {
        totalUniquePlayers,
        currentSquadPlayers,
        transferredOutPlayers,
        mostLoyalPlayer
      }
    };
    // ---------------------------------------------------------

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
        
        const liveDataForGW = liveDataMap.get(h.event);
        const liveMapForGW = new Map<number, any>((liveDataForGW?.elements || []).map((el: any) => [el.id, el.stats]));
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
      squadEvolution,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
