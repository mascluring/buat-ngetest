import { NextResponse } from 'next/server';
import { getLeagueStandings } from '@/lib/fpl';
export async function GET() {
  try {
    const data = await getLeagueStandings(134820);
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
