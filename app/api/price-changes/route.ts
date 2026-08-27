import { NextResponse } from 'next/server';
import { getBootstrap } from '@/lib/fpl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const boot = await getBootstrap();
    const elements = boot?.elements || [];
    const teamsMap = new Map<number, any>((boot?.teams || []).map((t: any) => [t.id, t]));

    const risers: any[] = [];
    const fallers: any[] = [];

    elements.forEach((el: any) => {
      const team = teamsMap.get(el.team) || {};
      const teamCode = team.code || 1;
      const isGkp = el.element_type === 1;

      const jerseyUrl = isGkp
        ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}_1-66.png`
        : `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}-66.png`;

      const playerData = {
        id: el.id,
        webName: el.web_name,
        fullName: `${el.first_name} ${el.second_name}`,
        teamShortName: team.short_name || '',
        nowCost: (el.now_cost / 10).toFixed(1),
        costChangeEvent: el.cost_change_event || 0,
        costChangeEventFall: el.cost_change_event_fall || 0,
        selectedByPercent: el.selected_by_percent || '0.0',
        jerseyUrl,
      };

      // Pemain yang harganya naik pada Gameweek/event berjalan
      if (el.cost_change_event > 0) {
        risers.push(playerData);
      } 
      // Pemain yang harganya turun pada Gameweek/event berjalan
      else if (el.cost_change_event_fall > 0 || el.cost_change_event < 0) {
        fallers.push(playerData);
      }
    });

    // Urutkan nominal tertinggi ke terendah
    risers.sort((a, b) => b.costChangeEvent - a.costChangeEvent);
    fallers.sort((a, b) => b.costChangeEventFall - a.costChangeEventFall);

    return NextResponse.json({
      ok: true,
      lastUpdated: new Date().toISOString(),
      updateNotice: 'Perubahan harga FPL diperbarui setiap hari sekitar pukul 06.00 WIB.',
      risers,
      fallers,
      hasChanges: risers.length > 0 || fallers.length > 0,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Gagal memuat perubahan harga' },
      { status: 500 }
    );
  }
}
