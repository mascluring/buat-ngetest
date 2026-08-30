import { NextResponse } from 'next/server';
import { getAllLeagueStandings, getBootstrap, getLeague, LEAGUE_ID } from '@/lib/fpl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const [{ standings }, boot] = await Promise.all([getAllLeagueStandings(), getBootstrap()]);
    // Assume we can get league info from standings[0] or we might need another approach
    const league = standings.length > 0 ? await getLeague(1).then(r => r.league) : null;
    const current = boot.events?.find((e: any) => e.is_current)?.id ?? boot.events?.find((e: any) => e.is_next)?.id ?? null;
    const finished = boot.events?.filter((e: any) => e.finished) ?? [];
    const currentEvent = boot.events?.find((e: any) => e.id === current) ?? boot.events?.[finished.length - 1] ?? null;
    
    const currentGameweek = Number(current ?? 0);
    const movementReady = currentGameweek >= 2;

    const calculateMovement = (lastRank: number, currentRank: number) => {
      const hasPreviousRank = Number.isFinite(lastRank) && lastRank > 0 && Number.isFinite(currentRank) && currentRank > 0;
      return movementReady && hasPreviousRank ? lastRank - currentRank : null;
    };

    const standingsWithMovement = standings.map((r: any) => ({
      ...r,
      movement: calculateMovement(r.last_rank, r.rank)
    }));

    const avg = standingsWithMovement.length ? standingsWithMovement.reduce((s: number, r: any) => s + Number(r.total || 0), 0) / standingsWithMovement.length : 0;
    
    const highestGWScore = standingsWithMovement.length > 0 
      ? standingsWithMovement.reduce((max: any, r: any) => (r.event_total > (max?.event_total || -1) ? r : max), null)
      : null;

    const sorted = [...standingsWithMovement].sort((a, b) => a.rank - b.rank);
    const top10 = sorted.slice(0, 10);
    const risers = sorted.filter((r) => r.movement !== null && r.movement > 0).sort((a, b) => (b.movement as number) - (a.movement as number));
    const fallers = sorted.filter((r) => r.movement !== null && r.movement < 0).sort((a, b) => (a.movement as number) - (b.movement as number));
    
    const biggestRiser = risers.length > 0 ? risers[0] : null;
    const biggestFaller = fallers.length > 0 ? fallers[0] : null;

    return NextResponse.json({
      ok: true,
      leagueId: LEAGUE_ID,
      league: league,
      current,
      currentEvent,
      finishedGameweeks: finished.length,
      movementReady,
      totalManagers: standingsWithMovement.length,
      averageTotal: Math.round(avg),
      leader: top10[0] ?? null,
      top10,
      standings: standingsWithMovement,
      risers: risers.slice(0, 8),
      fallers: fallers.slice(0, 8),
      biggestRiser,
      biggestFaller,
      highestGWScore,
      maxTotal: top10[0]?.total || 1,
      lastUpdated: new Date().toISOString(),
      source: 'Fantasy Premier League API',
    }, { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Analytics unavailable', leagueId: LEAGUE_ID }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
