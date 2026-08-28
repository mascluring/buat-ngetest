
import { NextResponse } from 'next/server';
import { getBootstrap } from '@/lib/fpl';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Inisialisasi client Supabase
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is required');
  if (!supabaseKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is required');
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabase();
    // 1. Ambil data bootstrap dari FPL API
    const boot = await getBootstrap();
    const elements = boot?.elements || [];
    const teamsMap = new Map<number, any>((boot?.teams || []).map((t: any) => [t.id, t]));

    // Format tanggal WIB hari ini (YYYY-MM-DD)
    const todayWib = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    const dateStr = todayWib.toISOString().split('T')[0];

    const recordsToInsert: any[] = [];

    // 2. Filter pemain yang harganya berubah (cost_change_event !== 0)
    elements.forEach((el: any) => {
      const costChange = el.cost_change_event || 0;
      const costChangeFall = el.cost_change_event_fall || 0;

      if (costChange !== 0 || costChangeFall > 0) {
        const team = teamsMap.get(el.team) || {};
        const isRiser = costChange > 0;
        
        // Hitung nominal perubahan harga
        const priceChangeVal = isRiser 
          ? Number((costChange * 0.1).toFixed(1)) 
          : -Number((Math.abs(costChangeFall || costChange) * 0.1).toFixed(1));

        recordsToInsert.push({
          player_id: el.id,
          web_name: el.web_name,
          team_short_name: team.short_name || '',
          change_type: isRiser ? 'Riser' : 'Faller',
          price_change: priceChangeVal,
          now_cost: Number((el.now_cost / 10).toFixed(1)),
          selected_by_percent: el.selected_by_percent,
          change_date: dateStr,
        });
      }
    });

    if (recordsToInsert.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'Tidak ada perubahan harga hari ini.',
        insertedCount: 0,
      });
    }

    // 3. Simpan ke Supabase (menggunakan upsert agar tidak duplicate jika cron berjalan 2x)
    const { data, error } = await supabase
      .from('price_changes')
      .upsert(recordsToInsert, { onConflict: 'player_id,change_date' });

    if (error) {
      throw new Error(`Database Error: ${error.message}`);
    }

    return NextResponse.json({
      ok: true,
      message: `Berhasil menyimpan ${recordsToInsert.length} perubahan harga harian.`,
      insertedCount: recordsToInsert.length,
      data: recordsToInsert,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Gagal menyimpan snapshot perubahan harga' },
      { status: 500 }
    );
  }
}
