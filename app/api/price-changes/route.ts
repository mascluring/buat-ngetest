import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Buat client Supabase (Gunakan Service Role jika ada untuk bypass RLS di server)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Environment variables untuk Supabase belum diatur.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFilter = searchParams.get('date');

    // Query dasar: Urutkan dari tanggal & ID terbaru
    let query = supabase
      .from('price_changes')
      .select('*')
      .order('change_date', { ascending: false })
      .order('id', { ascending: false });

    // Jika user memilih tanggal tertentu di filter
    if (dateFilter) {
      query = query.or(
        `change_date.eq.${dateFilter},change_date.gte.${dateFilter}T00:00:00,change_date.lte.${dateFilter}T23:59:59`
      );
    }
    // Jika TIDAK ADA filter (saat pertama kali dibuka):
    // Tanpa klausa .eq(), query ini otomatis mengambil SEMUA data di tabel price_changes.

    const { data: priceChanges, error } = await query;

    if (error) {
      console.error('Supabase Error:', error);
      throw new Error(error.message);
    }

    const risers: any[] = [];
    const fallers: any[] = [];

    (priceChanges || []).forEach((item: any) => {
      // 1. Ambil tanggal murni (YYYY-MM-DD) agar tidak bergeser karena zona waktu UTC/WIB
      const rawDateStr = String(item.change_date || '').split('T')[0];
      let formattedDate = rawDateStr;

      if (rawDateStr.includes('-')) {
        const [year, month, day] = rawDateStr.split('-');
        const monthNames = [
          'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
          'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
        ];
        const mIdx = parseInt(month, 10) - 1;
        if (day && monthNames[mIdx]) {
          formattedDate = `${parseInt(day, 10)} ${monthNames[mIdx]}`;
        }
      }

      // 2. Proteksi Nilai Null / Undefined
      const nowCostVal = Number(item.now_cost || 0);
      const priceChangeVal = Number(item.price_change || 0);

      const playerData = {
        id: item.player_id || item.id,
        webName: item.web_name || 'Tanpa Nama',
        teamShortName: item.team_short_name || 'UNK',
        nowCost: nowCostVal.toFixed(1),
        priceChange: Math.abs(priceChangeVal).toFixed(1),
        selectedByPercent: item.selected_by_percent || '0.0',
        jerseyUrl:
          item.jersey_url ||
          `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_1-66.png`,
        changeDate: formattedDate,
      };

      // 3. Pengelompokan Riser / Faller yang Aman
      const changeType = String(item.change_type || '').toLowerCase();
      const isRiser = changeType === 'riser' || priceChangeVal > 0;

      if (isRiser) {
        risers.push(playerData);
      } else {
        fallers.push(playerData);
      }
    });

    return NextResponse.json({ ok: true, risers, fallers });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}
