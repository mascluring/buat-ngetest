import { NextResponse } from 'next/server';
import { getBootstrap, getLeague, LEAGUE_ID, FPL_LEAGUE_URL } from '@/lib/fpl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const started = Date.now();
  try {
    const [league, boot] = await Promise.all([getLeague(1), getBootstrap()]);
    const rows = league.standings?.results ?? [];
    const current = boot.events?.find((e: any) => e.is_current)?.id ?? null;
    return NextResponse.json({
      ok: true,
      leagueId: LEAGUE_ID,
      leagueName: league.league?.name ?? null,
      rows: rows.length,
      hasNext: Boolean(league.standings?.has_next),
      currentGameweek: current,
      fplLeagueUrl: FPL_LEAGUE_URL,
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      leagueId: LEAGUE_ID,
      fplLeagueUrl: FPL_LEAGUE_URL,
      latencyMs: Date.now() - started,
      error: e?.message || 'FPL API unavailable',
      checkedAt: new Date().toISOString(),
    }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
