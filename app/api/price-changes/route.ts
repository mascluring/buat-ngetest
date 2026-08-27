import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    // 1. Ambil data dari database, diurutkan dari tanggal perubahan TERBARU
    const { data: priceChanges, error } = await supabase
      .from('price_changes')
      .select('*')
      .order('change_date', { ascending: false })
      .order('id', { ascending: false });

    if (error) {
      throw new Error(`Database Error: ${error.message}`);
    }

    const risers: any[] = [];
    const fallers: any[] = [];

    // 2. Format data untuk frontend
    (priceChanges || []).forEach((item: any) => {
      // Ubah format tanggal (contoh: "2026-08-27" menjadi "27 Aug")
      const dateObj = new Date(item.change_date);
      const formattedDate = dateObj.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
      });

      const playerData = {
        id: item.player_id,
        webName: item.web_name,
        teamShortName: item.team_short_name,
        nowCost: Number(item.now_cost).toFixed(1),
        priceChange: Math.abs(Number(item.price_change)).toFixed(1),
        changeDate: formattedDate,
        rawDate: item.change_date,
        jerseyUrl: `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_1-66.png`, // Opsional: sesuaikan jika menyimpan team_code
      };

      if (item.change_type === 'Riser' || item.price_change > 0) {
        risers.push(playerData);
      } else {
        fallers.push(playerData);
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
    return NextResponse.json(
      { ok: false, error: err?.message || 'Gagal memuat perubahan harga dari database' },
      { status: 500 }
    );
  }
}
