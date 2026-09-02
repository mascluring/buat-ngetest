import { NextResponse } from 'next/server';
import { getBootstrap, getAllLeagueStandings, LEAGUE_ID } from '@/lib/fpl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const [boot, leagueRes] = await Promise.all([
      getBootstrap().catch(() => null),
      getAllLeagueStandings().catch(() => null)
    ]);

    if (!boot || !leagueRes) {
      return NextResponse.json(
        { ok: false, error: 'FPL API sedang sibuk atau memblokir akses sementara.', leagueId: LEAGUE_ID },
        { status: 503 }
      );
    }

    const currentEvent = boot.events?.find((e: any) => e.is_current) || boot.events?.find((e: any) => e.is_next) || boot.events?.[0];
    const currentGW = currentEvent?.id || 1;

    const managers = (leagueRes.standings || []).map((row: any) => ({
      entryId: row.entry,
      entryName: row.entry_name,
      managerName: row.player_name || 'Manager',
      previousRank: row.last_rank,
      currentRank: row.rank,
      totalPoints: row.total,
      eventPoints: row.event_total
    }));

    return NextResponse.json(
      {
        ok: true,
        currentGW,
        league: {
          id: LEAGUE_ID,
          name: "Era Super League" // Might not have exact name without getting page 1 again, but getAllLeagueStandings doesn't return league info.
        },
        eventStatus: {
          isCurrent: currentEvent?.is_current || false,
          finished: currentEvent?.finished || false,
          dataChecked: currentEvent?.data_checked || false
        },
        managers
      },
      { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to load live league data', leagueId: LEAGUE_ID },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
