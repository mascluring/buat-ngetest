import { NextResponse } from 'next/server';
import { getBootstrap, getLiveEvent } from '@/lib/fpl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  try {
    const boot = await getBootstrap();
    const currentGW = boot?.events?.find((e: any) => e.is_current)?.id ?? boot?.events?.find((e: any) => e.is_next)?.id ?? 1;
    const eventParam = Number(searchParams.get('gw') || currentGW);
    const event = isNaN(eventParam) ? currentGW : Math.max(1, Math.min(eventParam, 38));

    const liveData = await getLiveEvent(event).catch(() => null);

    const teamsMap = new Map<number, any>((boot?.teams || []).map((t: any) => [t.id, t]));
    const liveMap = new Map<number, any>((liveData?.elements || []).map((el: any) => [el.id, el.stats]));

    const allPlayers: any[] = [];

    (boot?.elements || []).forEach((el: any) => {
      const stats = liveMap.get(el.id) || {};
      const team = teamsMap.get(el.team) || {};
      const totalPoints = stats.total_points || 0;
      const teamCode = team.code || 1;
      const isGkp = el.element_type === 1;

      const jerseyUrl = isGkp
        ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}_1-66.png`
        : `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}-66.png`;

      allPlayers.push({
        id: el.id,
        webName: el.web_name,
        fullName: `${el.first_name} ${el.second_name}`,
        elementType: el.element_type,
        teamShortName: team.short_name || '',
        teamCode: teamCode,
        jerseyUrl: jerseyUrl,
        points: totalPoints,
        bonus: stats.bonus || 0,
        bps: stats.bps || 0,
        goals: stats.goals_scored || 0,
        assists: stats.assists || 0,
        cleanSheet: stats.clean_sheets || 0,
        minutes: stats.minutes || 0,
        selectedByPercent: el.selected_by_percent || '0.0',
        nowCost: (el.now_cost / 10).toFixed(1),
        inDreamteam: Boolean(stats.in_dreamteam),
      });
    });

    allPlayers.sort((a, b) => b.points - a.points || b.bonus - a.bonus || b.bps - a.bps);

    // Official FPL Dream Team Selection (using official `in_dreamteam` flag)
    let officialDT = allPlayers.filter(p => p.inDreamteam);

    // Fallback if in_dreamteam is not set yet by FPL
    if (officialDT.length === 0) {
      const gkp = allPlayers.filter(p => p.elementType === 1).slice(0, 1);
      const def = allPlayers.filter(p => p.elementType === 2).slice(0, 3);
      const mid = allPlayers.filter(p => p.elementType === 3).slice(0, 4);
      const fwd = allPlayers.filter(p => p.elementType === 4).slice(0, 3);
      officialDT = [...gkp, ...def, ...mid, ...fwd];
    }

    const dtGkp = officialDT.filter(p => p.elementType === 1);
    const dtDef = officialDT.filter(p => p.elementType === 2);
    const dtMid = officialDT.filter(p => p.elementType === 3);
    const dtFwd = officialDT.filter(p => p.elementType === 4);

    const gkpList = allPlayers.filter(p => p.elementType === 1).slice(0, 10);
    const defList = allPlayers.filter(p => p.elementType === 2).slice(0, 10);
    const midList = allPlayers.filter(p => p.elementType === 3).slice(0, 10);
    const fwdList = allPlayers.filter(p => p.elementType === 4).slice(0, 10);

    return NextResponse.json({
      ok: true,
      gw: event,
      currentGW,
      totalGWs: boot?.events?.length || 38,
      dreamTeam: {
        gkp: dtGkp,
        def: dtDef,
        mid: dtMid,
        fwd: dtFwd,
        formation: `${dtDef.length}-${dtMid.length}-${dtFwd.length}`
      },
      topByPosition: {
        gkp: gkpList,
        def: defList,
        mid: midList,
        fwd: fwdList,
      },
      topOverall: allPlayers.slice(0, 15),
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Gagal memuat statistik pemain' }, { status: 500 });
  }
}
