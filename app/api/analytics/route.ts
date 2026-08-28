import { NextResponse } from 'next/server';
import { getAllLeagueStandings, getBootstrap, LEAGUE_ID } from '@/lib/fpl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const [{ first, standings }, boot] = await Promise.all([getAllLeagueStandings(), getBootstrap()]);
    const current = boot.events?.find((e: any) => e.is_current)?.id ?? boot.events?.find((e: any) => e.is_next)?.id ?? null;
    const finished = boot.events?.filter((e: any) => e.finished) ?? [];
    const currentEvent = boot.events?.find((e: any) => e.id === current) ?? boot.events?.[finished.length - 1] ?? null;
    const movementReady = Number(current ?? 0) >= 2;
    const avg = standings.length ? standings.reduce((s: number, r: any) => s + Number(r.total || 0), 0) / standings.length : 0;
    const sorted = [...standings].sort((a, b) => a.rank - b.rank);
    const top10 = sorted.slice(0, 10);
    const risers = movementReady ? sorted.filter((r) => r.last_rank > 0 && r.rank > 0 && (r.last_rank - r.rank) > 0).sort((a, b) => (b.last_rank - b.rank) - (a.last_rank - a.rank)) : [];
    const fallers = movementReady ? sorted.filter((r) => r.last_rank > 0 && r.rank > 0 && (r.last_rank - r.rank) < 0).sort((a, b) => (a.last_rank - a.rank) - (b.last_rank - b.rank)) : [];
    return NextResponse.json({
      ok: true,
      leagueId: LEAGUE_ID,
      league: first.league,
      current,
      currentEvent,
      finishedGameweeks: finished.length,
      movementReady,
      totalManagers: standings.length,
      averageTotal: Math.round(avg),
      leader: top10[0] ?? null,
      top10,
      standings,
      risers: risers.slice(0, 8),
      fallers: fallers.slice(0, 8),
      maxTotal: top10[0]?.total || 1,
      lastUpdated: new Date().toISOString(),
      source: 'Fantasy Premier League API',
    }, { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Analytics unavailable', leagueId: LEAGUE_ID }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
