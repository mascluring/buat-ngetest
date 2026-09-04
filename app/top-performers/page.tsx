'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, Trophy, Star, Shield, Zap, Sparkles, Flame, UserCheck, DollarSign } from 'lucide-react';

const posNames: Record<number, string> = {
  1: 'GOALKEEPER (GKP)',
  2: 'DEFENDER (DEF)',
  3: 'MIDFIELDER (MID)',
  4: 'FORWARD (FWD)',
};

export default function TopPerformersPage() {
  const [gw, setGw] = useState<number>(1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'gkp' | 'def' | 'mid' | 'fwd'>('all');

  const loadData = async (selectedGw?: number) => {
    setLoading(true);
    setError('');
    try {
      const url = selectedGw ? `/api/top-performers?gw=${selectedGw}` : `/api/top-performers`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Gagal memuat statistik pemain');
      setData(json);
      if (!selectedGw) setGw(json.gw);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGwChange = (newGw: number) => {
    setGw(newGw);
    loadData(newGw);
  };

  const dreamTeam = data?.dreamTeam;
  const topByPos = data?.topByPosition;

  return (
    <main className="container page-shell py-8">
      <div className="my-4">
        <Link href="/" className="back-link inline-flex items-center gap-2 text-slate-300 hover:text-white">
          <ArrowLeft size={16} /> Kembali ke Klasemen Utama
        </Link>
      </div>

      {/* HEADER SECTION */}
      <header className="card p-6 my-4 bg-slate-900/90 border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="eyebrow text-amber-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Sparkles size={14} /> FPL TOP PERFORMERS & DREAM TEAM
            </div>
            <h1 className="text-3xl font-black text-white">Pemain Poin Tertinggi GW{gw}</h1>
            <p className="text-slate-400 text-sm mt-1">
              Analisis statistik poin terbaik, bonus points (BPS), gol, assist, dan persentase kepemilikan manager (Ownership %).
            </p>
          </div>

          {/* GAMEWEEK SELECTOR DROPDOWN */}
          <div className="flex items-center gap-3 bg-slate-800 p-3 rounded-xl border border-slate-700">
            <span className="text-xs text-slate-300 font-bold uppercase">Pilih Gameweek:</span>
            <select
              value={gw}
              onChange={(e) => handleGwChange(Number(e.target.value))}
              className="bg-slate-950 text-amber-400 font-black text-sm px-3 py-1.5 rounded-lg border border-slate-700 outline-none cursor-pointer"
            >
              {Array.from({ length: data?.currentGW || 38 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>
                  Gameweek {g} {g === data?.currentGW ? '(Aktif)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {error && (
        <div className="card error-banner my-4 p-4 text-rose-400 bg-rose-950/40 border-rose-800">
          <b>Gagal memuat data:</b> {error}
        </div>
      )}

      {loading ? (
        <div className="card text-center py-16 text-slate-400">
          <RefreshCw className="spin mx-auto mb-3" size={28} />
          Memuat susunan pemain poin tertinggi Gameweek {gw}...
        </div>
      ) : (
        <>
          {/* VISUAL LAPANGAN DREAM TEAM GW */}
          {dreamTeam && (
            <section className="card p-6 my-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
                <div>
                  <div className="section-kicker">GAMEWEEK {gw} DREAM TEAM</div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Trophy className="text-amber-400" size={20} /> Formasi Resmi FPL Dream Team ({dreamTeam?.formation || "3-4-3"})
                  </h2>
                </div>
              </div>

              <div className="fpl-pitch relative rounded-2xl overflow-hidden p-6 border-2 border-emerald-400/40 shadow-2xl bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-800">
                <div className="pitch-line pitch-goal-top" />
                <div className="pitch-line pitch-box-top" />
                <div className="pitch-line pitch-center-circle" />

                {/* GKP */}
                <div className="flex justify-center my-3 relative z-10">
                  {dreamTeam.gkp.map((p: any) => (
                    <DreamCard key={p.id} player={p} />
                  ))}
                </div>

                {/* DEF */}
                <div className="flex justify-around my-4 relative z-10">
                  {dreamTeam.def.map((p: any) => (
                    <DreamCard key={p.id} player={p} />
                  ))}
                </div>

                {/* MID */}
                <div className="flex justify-around my-4 relative z-10">
                  {dreamTeam.mid.map((p: any) => (
                    <DreamCard key={p.id} player={p} />
                  ))}
                </div>

                {/* FWD */}
                <div className="flex justify-around my-4 relative z-10">
                  {dreamTeam.fwd.map((p: any) => (
                    <DreamCard key={p.id} player={p} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* TAB CATEGORY FILTER */}
          <div className="flex items-center gap-2 my-6 overflow-x-auto pb-2">
            {(['all', 'gkp', 'def', 'mid', 'fwd'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                  activeTab === tab
                    ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {tab === 'all' ? '⚡ Semua Posisi (Top 15)' : posNames[tab === 'gkp' ? 1 : tab === 'def' ? 2 : tab === 'mid' ? 3 : 4]}
              </button>
            ))}
          </div>

          {/* TABEL PERINGKAT PEMAIN DENGAN DETAIL STATISTIK */}
          <section className="card table-card my-6">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Flame className="text-amber-400" size={20} /> Daftar Pemain Terbaik GW{gw}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Lengkap dengan status Bonus Points (Bonus), Goals (G), Assists (A), Clean Sheet (CS), Kepemilikan (Selected %), dan Harga (£).
              </p>
            </div>

            <div className="table-scroll">
              <table className="rank-table w-full">
                <thead>
                  <tr>
                    <th className="text-center">Pos</th>
                    <th>Pemain</th>
                    <th className="text-center">Klub</th>
                    <th className="text-center">Harga</th>
                    <th className="text-center">Ownership %</th>
                    <th className="text-center">G / A / CS</th>
                    <th className="text-center">Bonus (BPS)</th>
                    <th className="text-center">Poin GW{gw}</th>
                  </tr>
                </thead>
                <tbody>
                  {getTabPlayers(activeTab, data).map((p: any, idx: number) => (
                    <tr key={p.id} className={idx < 3 ? 'podium-row' : ''}>
                      <td className="text-center font-bold font-mono text-slate-300">#{idx + 1}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <img src={p.jerseyUrl} alt={p.teamShortName} className="w-10 h-10 object-contain drop-shadow" />
                          <div>
                            <b className="text-white block">{p.webName}</b>
                            <small className="text-slate-400 text-[11px]">{posNames[p.elementType]?.split(' ')[0]}</small>
                          </div>
                        </div>
                      </td>
                      <td className="text-center font-bold text-cyan-300 font-mono">{p.teamShortName}</td>
                      <td className="text-center font-mono text-slate-300">£{p.nowCost}m</td>
                      <td className="text-center font-mono font-semibold text-emerald-400">{p.selectedByPercent}%</td>
                      <td className="text-center font-mono text-slate-200">
                        {p.goals}G / {p.assists}A / {p.cleanSheet}CS
                      </td>
                      <td className="text-center font-mono text-amber-400">
                        <b>+{p.bonus}</b> <small className="text-slate-500">({p.bps})</small>
                      </td>
                      <td className="text-center font-mono font-black text-xl text-amber-300">{p.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <footer className="mt-12 text-center text-xs text-slate-500 pb-6">ERA SUPER LEAGUE • V6.2 Top Performers • League ID 134820</footer>
    </main>
  );
}

function getTabPlayers(tab: string, data: any) {
  if (!data) return [];
  if (tab === 'gkp') return data.topByPosition.gkp;
  if (tab === 'def') return data.topByPosition.def;
  if (tab === 'mid') return data.topByPosition.mid;
  if (tab === 'fwd') return data.topByPosition.fwd;
  return data.topOverall;
}

function DreamCard({ player }: { player: any }) {
  return (
    <div className="player-card text-center flex flex-col items-center mx-1.5">
      <div className="jersey-icon relative mb-1.5 flex justify-center items-center">
        <img
          src={player.jerseyUrl}
          alt={player.teamShortName}
          className="w-14 h-14 md:w-16 md:h-16 object-contain drop-shadow-lg transition-transform hover:scale-110"
        />
        <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full border border-amber-300 shadow">
          {player.selectedByPercent}%
        </span>
      </div>
      <div className="bg-slate-950/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-t border border-slate-700 max-w-[110px] truncate shadow">
        {player.webName}
      </div>
      <div className="bg-emerald-400 text-slate-950 font-black text-[12px] px-2.5 py-0.5 rounded-b min-w-[46px] mt-[-1px] shadow-md border-x border-b border-emerald-500">
        {player.points} pts
      </div>
    </div>
  );
}
