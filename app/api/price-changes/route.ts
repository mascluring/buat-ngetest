import { NextResponse } from 'next/server';
import { getBootstrap } from '@/lib/fpl';

// Revalidate data setiap 24 jam (86400 detik)
export const revalidate = 86400;

export async function GET(request: Request) {
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

      // FPL mereset `cost_change_event` setiap kali ada perubahan harian.
      // Perubahan persis 1 step harian (+0.1m atau -0.1m) ditandai dengan cost_change_event = 1 atau -1 
      // saat event update harian terjadi.
      const isDailyRise = el.cost_change_event === 1;
      const isDailyFall = el.cost_change_event_fall === 1 || el.cost_change_event === -1;

      if (isDailyRise || isDailyFall) {
        const playerData = {
          id: el.id,
          webName: el.web_name,
          fullName: `${el.first_name} ${el.second_name}`,
          teamShortName: team.short_name || '',
          nowCost: (el.now_cost / 10).toFixed(1),
          priceDiff: '0.1',
          selectedByPercent: el.selected_by_percent || '0.0',
          jerseyUrl,
        };

        if (isDailyRise) risers.push(playerData);
        if (isDailyFall) fallers.push(playerData);
      }
    });

    return NextResponse.json({
      ok: true,
      lastUpdated: new Date().toISOString(),
      risers,
      fallers,
      hasChanges: risers.length > 0 || fallers.length > 0,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}
