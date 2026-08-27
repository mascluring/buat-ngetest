import { NextResponse } from 'next/server';
import { getBootstrap, getLeague, LEAGUE_ID } from '@/lib/fpl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  try {
    const [league, boot] = await Promise.all([getLeague(page), getBootstrap()]);
    const standings = league.standings?.results ?? [];
    const current = boot.events?.find((e: any) => e.is_current)?.id ?? boot.events?.find((e: any) => e.is_next)?.id ?? null;
    return NextResponse.json(
      {
        ok: true,
        league: league.league,
        standings,
        hasNext: Boolean(league.standings?.has_next),
        page,
        current,
        leagueId: LEAGUE_ID,
        count: standings.length,
        source: 'Fantasy Premier League API',
      },
      { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'FPL API unavailable', leagueId: LEAGUE_ID, source: 'Fantasy Premier League API' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
