import { NextResponse } from 'next/server';
import { getBootstrap, getFixtures } from '@/lib/fpl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const paramGw = searchParams.get('gw');

    const bootstrap = await getBootstrap();
    const events = bootstrap.events || [];
    const teams = bootstrap.teams || [];

    let currentGwId = 1;
    // Find the first event that is not finished (meaning all matches are not yet done)
    // If all are somehow finished (e.g. end of season), fallback to the current or last event
    const activeEvent = events.find((e: any) => !e.finished) || events.find((e: any) => e.is_current) || events[events.length - 1];
    
    if (activeEvent) {
      currentGwId = activeEvent.id;
    }
    
    const targetGwId = paramGw ? parseInt(paramGw, 10) : currentGwId;
    const targetGw = events.find((e: any) => e.id === targetGwId);

    const fixtures = await getFixtures(targetGwId);

    const elements = bootstrap.elements || [];
    const elementMap = new Map();
    elements.forEach((el: any) => elementMap.set(el.id, el));

    // Map teams data
    const teamMap = new Map();
    teams.forEach((t: any) => teamMap.set(t.id, t));

    const mappedFixtures = fixtures.map((f: any) => {
      const homeTeam = teamMap.get(f.team_h) || {};
      const awayTeam = teamMap.get(f.team_a) || {};

      // Parse stats
      const parsedStats = (f.stats || []).map((s: any) => ({
        identifier: s.identifier,
        h: s.h.map((item: any) => ({ ...item, name: elementMap.get(item.element)?.web_name })),
        a: s.a.map((item: any) => ({ ...item, name: elementMap.get(item.element)?.web_name })),
      }));
      
      return {
        id: f.id,
        kickoff_time: f.kickoff_time,
        started: f.started,
        finished: f.finished,
        finished_provisional: f.finished_provisional,
        team_h_score: f.team_h_score,
        team_a_score: f.team_a_score,
        minutes: f.minutes,
        stats: parsedStats,
        homeTeam: {
          id: homeTeam.id,
          name: homeTeam.name,
          short_name: homeTeam.short_name,
        },
        awayTeam: {
          id: awayTeam.id,
          name: awayTeam.name,
          short_name: awayTeam.short_name,
        }
      };
    });

    return NextResponse.json({
      ok: true,
      gw: targetGwId,
      gwName: targetGw?.name || `Gameweek ${targetGwId}`,
      deadline: targetGw?.deadline_time,
      isCurrent: targetGw?.is_current || false,
      isNext: targetGw?.is_next || false,
      events: events.map((e: any) => ({
        id: e.id,
        name: e.name,
        is_current: e.is_current,
        is_next: e.is_next
      })),
      fixtures: mappedFixtures,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}
