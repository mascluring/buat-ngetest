import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is required');
  if (!supabaseKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is required');
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data: priceChanges, error } = await supabase
      .from('price_changes')
      .select('*')
      .order('change_date', { ascending: false })
      .order('id', { ascending: false });

    if (error) throw new Error(error.message);

    const risers: any[] = [];
    const fallers: any[] = [];

    (priceChanges || []).forEach((item: any) => {
      const dateObj = new Date(item.change_date);
      const formattedDate = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

      const playerData = {
        id: item.player_id,
        webName: item.web_name,
        teamShortName: item.team_short_name,
        nowCost: Number(item.now_cost).toFixed(1),
        priceChange: Math.abs(Number(item.price_change)).toFixed(1),
        selectedByPercent: item.selected_by_percent || '0.0',
        jerseyUrl: item.jersey_url || `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_1-66.png`,
        changeDate: formattedDate,
      };

      if (item.change_type === 'Riser' || item.price_change > 0) {
        risers.push(playerData);
      } else {
        fallers.push(playerData);
      }
    });

    return NextResponse.json({ ok: true, risers, fallers });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}
