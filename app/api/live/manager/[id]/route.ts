import { NextResponse } from 'next/server';
import { getBootstrap, getEntryPicks, getLiveEvent, getFixtures } from '@/lib/fpl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const entryId = Number(params.id);
  if (isNaN(entryId)) {
    return NextResponse.json({ ok: false, error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const boot = await getBootstrap().catch(() => null);
    if (!boot) throw new Error('Failed to load bootstrap');

    const currentEvent = boot.events?.find((e: any) => e.is_current) || boot.events?.find((e: any) => e.is_next) || boot.events?.[0];
    const currentGW = currentEvent?.id || 1;

    const [picksData, liveData, fixturesData] = await Promise.all([
      getEntryPicks(entryId, currentGW).catch(() => null),
      getLiveEvent(currentGW).catch(() => null),
      getFixtures(currentGW).catch(() => null)
    ]);

    if (!picksData) {
      return NextResponse.json({
        ok: false,
        entryId,
        isLiveUnavailable: true,
        error: 'Failed to load manager picks'
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const liveMap = new Map<number, any>((liveData?.elements || []).map((el: any) => [el.id, el.stats]));
    const elementsMap = new Map<number, any>((boot?.elements || []).map((el: any) => [el.id, el]));
    
    // Create fixtures map by team
    const teamFixtures = new Map<number, any[]>();
    (fixturesData || []).forEach((f: any) => {
      if (!teamFixtures.has(f.team_h)) teamFixtures.set(f.team_h, []);
      if (!teamFixtures.has(f.team_a)) teamFixtures.set(f.team_a, []);
      teamFixtures.get(f.team_h)?.push(f);
      teamFixtures.get(f.team_a)?.push(f);
    });

    const picks = picksData.picks || [];
    const activeChip = picksData.active_chip ? String(picksData.active_chip).toLowerCase() : null;
    const isBB = activeChip === 'bb' || activeChip === 'bboost';
    
    const startingPicks = picks.filter((p: any) => isBB ? true : p.position <= 11);
    
    let liveGWPoints = 0;
    let playedCount = 0;
    
    const playersStatus = {
      notStarted: 0,
      playing: 0,
      finished: 0,
      unknown: 0
    };

    let captainInfo = null;

    startingPicks.forEach((p: any) => {
      const stats = liveMap.get(p.element);
      const el = elementsMap.get(p.element);
      
      const mult = p.multiplier || 1;
      const rawPoints = stats?.total_points || 0;
      liveGWPoints += (rawPoints * mult);
      
      if (stats && stats.minutes > 0) {
        playedCount++;
      }

      // Status logic
      let pStatus = 'UNKNOWN';
      if (el && el.team) {
        const pFixtures = teamFixtures.get(el.team) || [];
        if (pFixtures.length === 0) {
          pStatus = 'UNKNOWN';
        } else {
          const anyLive = pFixtures.some(f => f.started === true && f.finished_provisional === false && f.finished === false);
          const allFinished = pFixtures.every(f => f.finished_provisional === true || f.finished === true);
          const noneStarted = pFixtures.every(f => f.started === false);
          
          if (anyLive) pStatus = 'LIVE';
          else if (allFinished) pStatus = 'FINISHED';
          else if (noneStarted) pStatus = 'NOT_STARTED';
          else pStatus = 'FINISHED'; // Fallback if some finished and some not started (rare, DGWs)
        }
      }

      if (pStatus === 'NOT_STARTED') playersStatus.notStarted++;
      else if (pStatus === 'LIVE') playersStatus.playing++;
      else if (pStatus === 'FINISHED') playersStatus.finished++;
      else playersStatus.unknown++;

      if (p.is_captain) {
        captainInfo = {
          id: p.element,
          name: el?.web_name || 'Unknown',
          multiplier: mult,
          rawPoints: rawPoints,
          points: rawPoints * mult,
          status: pStatus
        };
      }
    });

    const transferCost = picksData.entry_history?.event_transfers_cost || 0;
    
    // We don't have previousTotal directly, it should be calculated frontend side using standings.
    // Or we return liveGWPoints, and frontend adds it to previousTotal.
    // Let's just return liveGWPoints and transferCost.

    return NextResponse.json({
      ok: true,
      currentGW,
      entry: {
        id: entryId,
        name: "Unknown",
        managerName: "Unknown"
      },
      live: {
        liveGWPoints,
        transferCost,
        activeChip
      },
      captain: captainInfo,
      playersStatus,
      playedCount,
      totalActivePlayers: startingPicks.length
    }, { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } });

  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      entryId,
      isLiveUnavailable: true,
      error: e?.message || 'Failed to calculate live points'
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
