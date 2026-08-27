'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, DollarSign, Clock, AlertCircle } from 'lucide-react';

export default function PriceChangesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/price-changes', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Gagal memuat statistik perubahan harga');
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const risers = data?.risers || [];
  const fallers = data?.fallers || [];

  return (
    <main className="container page-shell py-8">
      <div className="my-4">
        <Link href="/" className="back-link inline-flex items-center gap-2 text-slate-300 hover:text-white">
          <ArrowLeft size={16} /> Kembali ke Klasemen Utama
        </Link>
      </div>

      <header className="card p-6 my-4 bg-slate-900/90 border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="eyebrow text-amber-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <DollarSign size={14} /> FPL DAILY PRICE CHANGES
            </div>
            <h1 className="text-3xl font-black text-white">Perubahan Harga Pemain Hari Ini</h1>
            <p className="text-slate-400 text-sm mt-1">
              Daftar pemain yang mengalami kenaikan atau penurunan harga pasar di Fantasy Premier League.
            </p>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 flex items-center gap-3">
            <Clock size={18} className="text-cyan-400" />
            <div className="text-xs">
              <span className="text-slate-400 block font-semibold">JADWAL UPDATE FPL:</span>
              <span className="text-white font-bold">Setiap Hari Pukul 06.00 WIB</span>
            </div>
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
          Memuat data kenaikan dan penurunan harga pemain...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
          <section className="card p-6 border-emerald-500/30">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                <TrendingUp size={20} /> Pemain Naik Harga Hari Ini
              </h2>
              <span className="bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs px-2.5 py-1 rounded-full border border-emerald-500/30">
                {risers.length} Pemain
              </span>
            </div>

            {risers.length > 0 ? (
              <div className="space-y-3">
                {risers.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800 hover:border-emerald-500/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <img src={p.jerseyUrl} alt={p.teamShortName} className="w-10 h-10 object-contain drop-shadow" />
                      <div>
                        <b className="text-white text-sm block">{p.webName}</b>
                        <small className="text-slate-400 text-xs">{p.teamShortName} • Ownership: {p.selectedByPercent}%</small>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block font-mono">£{p.nowCost}m</span>
                      <span className="text-emerald-400 font-bold font-mono text-sm">
                        +£{(p.costChangeEvent * 0.1).toFixed(1)}m ↗
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-950/40 rounded-xl border border-slate-800/60">
                <AlertCircle size={28} className="mx-auto text-slate-500 mb-2" />
                <p className="text-sm font-semibold text-slate-300">Tidak ada pemain yang naik harga hari ini.</p>
                <small className="text-slate-500 block mt-1">Sistem FPL belum mencatat adanya kenaikan harga baru pada pukul 06.00 WIB.</small>
              </div>
            )}
          </section>

          <section className="card p-6 border-rose-500/30">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h2 className="text-lg font-bold text-rose-400 flex items-center gap-2">
                <TrendingDown size={20} /> Pemain Turun Harga Hari Ini
              </h2>
              <span className="bg-rose-500/20 text-rose-300 font-mono font-bold text-xs px-2.5 py-1 rounded-full border border-rose-500/30">
                {fallers.length} Pemain
              </span>
            </div>

            {fallers.length > 0 ? (
              <div className="space-y-3">
                {fallers.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800 hover:border-rose-500/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <img src={p.jerseyUrl} alt={p.teamShortName} className="w-10 h-10 object-contain drop-shadow" />
                      <div>
                        <b className="text-white text-sm block">{p.webName}</b>
                        <small className="text-slate-400 text-xs">{p.teamShortName} • Ownership: {p.selectedByPercent}%</small>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block font-mono">£{p.nowCost}m</span>
                      <span className="text-rose-400 font-bold font-mono text-sm">
                        -£{(Math.abs(p.costChangeEvent) * 0.1).toFixed(1)}m ↘
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-950/40 rounded-xl border border-slate-800/60">
                <AlertCircle size={28} className="mx-auto text-slate-500 mb-2" />
                <p className="text-sm font-semibold text-slate-300">Tidak ada pemain yang turun harga hari ini.</p>
                <small className="text-slate-500 block mt-1">Sistem FPL belum mencatat adanya penurunan harga baru pada pukul 06.00 WIB.</small>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
