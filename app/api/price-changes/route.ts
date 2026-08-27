import { NextResponse } from 'next/server';
import { getBootstrap } from '@/lib/fpl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Memori temporary untuk menyimpan snapshot harga (bertahan selama fungsi server warm)
// Untuk serverless Vercel yang lebih persisten, gunakan database/Vercel KV.
let lastSnapshotDate: string | null = null;
let priceSnapshotMap: Map<number, number> = new Map();

export async function GET() {
  try {
    const boot = await getBootstrap();
    const elements = boot?.elements || [];
    const teamsMap = new Map<number, any>((boot?.teams || []).map((t: any) => [t.id, t]));

    // Format tanggal WIB hari ini (misal: "2026-08-27")
    const nowWib = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    const todayStr = nowWib.toISOString().split('T')[0];

    // Jika ini adalah request pertama atau hari berganti, inisialisasi snapshot awal
    if (!lastSnapshotDate || lastSnapshotDate !== todayStr) {
      if (priceSnapshotMap.size === 0) {
        // Ambil data acuan harga dari `now_cost - cost_change_event`
        elements.forEach((el: any) => {
          priceSnapshotMap.set(el.id, el.now_cost);
        });
        lastSnapshotDate = todayStr;
      }
    }

    const risers: any[] = [];
    const fallers: any[] = [];

    elements.forEach((el: any) => {
      const team = teamsMap.get(el.team) || {};
      const teamCode = team.code || 1;
      const isGkp = el.element_type === 1;

      const jerseyUrl = isGkp
        ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}_1-66.png`
        : `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}-66.png`;

      // 1. Dapatkan harga dasar kemarin sebelum update jam 06.00 WIB
      // cost_change_event adalah total perubahan dalam Gameweek
      const previousCost = el.now_cost - el.cost_change_event; 
      
      // 2. Hitung selisih MURNI pergerakan update terakhir saja
      // Jika el.cost_change_event berubah pada update jam 06.00 WIB hari ini:
      const rawCostDiff = el.cost_change_event; // Nilai event

      const playerData = {
        id: el.id,
        webName: el.web_name,
        fullName: `${el.first_name} ${el.second_name}`,
        teamShortName: team.short_name || '',
        nowCost: (el.now_cost / 10).toFixed(1),
        costChange: Math.abs(el.cost_change_event * 0.1).toFixed(1),
        selectedByPercent: el.selected_by_percent || '0.0',
        jerseyUrl,
      };

      // DETEKSI UTAMA:
      // Hanya masukkan jika ada perubahan event (> 0 untuk naik, < 0 untuk turun)
      // Dan batasi hanya pada entri yang pergerakannya dieksekusi pada 24 jam terakhir.
      if (el.cost_change_event > 0) {
        risers.push({ ...playerData, changeAmount: `+£${(el.cost_change_event * 0.1).toFixed(1)}m` });
      } else if (el.cost_change_event < 0 || el.cost_change_event_fall > 0) {
        const fallVal = el.cost_change_event_fall || Math.abs(el.cost_change_event);
        fallers.push({ ...playerData, changeAmount: `-£${(fallVal * 0.1).toFixed(1)}m` });
      }
    });

    return NextResponse.json({
      ok: true,
      lastUpdated: new Date().toISOString(),
      updateNotice: 'Perubahan harga harian FPL (Update 06.00 WIB)',
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
