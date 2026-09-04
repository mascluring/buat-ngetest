'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, DollarSign, Clock, AlertCircle, Calendar } from 'lucide-react';

const getTeamShirtUrl = (shortName: string) => {
  const teamCodes: Record<string, string> = {
    ARS: '3', AVL: '7', BOU: '91', BRE: '94', BHA: '36',
    CHE: '8', COV: '9', CRY: '31', EVE: '11', FUL: '54',
    HUL: '88', IPS: '40', LEE: '2', LIV: '14', MCI: '43',
    MUN: '1', NEW: '4', NFO: '17', TOT: '6', SUN: '56'
  };
  const code = teamCodes[shortName?.toUpperCase()] || '1';
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}-66.png`;
};

function TeamShirt({ team }: { team: string }) {
  return (
    <img 
      src={getTeamShirtUrl(team)} 
      alt={team} 
      className="w-10 h-10 object-contain drop-shadow-md" 
      loading="lazy" 
    />
  );
}

export default function PriceChangesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const loadData = async (date?: string) => {
    setLoading(true);
    setError('');
    try {
      const url = date ? `/api/price-changes?date=${date}` : '/api/price-changes';
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Gagal memuat data');
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    setDateFilter(date);
    loadData(date);
  };

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
            <h1 className="text-3xl font-black text-white">Perubahan Harga Pemain</h1>
            <p className="text-slate-400 text-sm mt-1">Daftar pemain yang mengalami perubahan harga pasar di Fantasy Premier League.</p>
          </div>
          <div className="flex flex-col gap-2">
            <input 
              type="date" 
              value={dateFilter} 
              onChange={handleDateChange}
              className="bg-slate-800 text-white p-2 rounded-lg border border-slate-700"
            />
            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 flex items-center gap-3">
              <Clock size={18} className="text-cyan-400" />
              <div className="text-xs">
                <span className="text-slate-400 block font-semibold">JADWAL UPDATE FPL:</span>
                <span className="text-white font-bold">Setiap Hari Pukul 06.00 WIB</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="card text-center py-16 text-slate-400">
          <RefreshCw className="spin mx-auto mb-3" size={28} /> Memuat data perubahan harga...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
          <section className="card p-6 border-emerald-500/30">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2"><TrendingUp size={20} /> Pemain Naik Harga</h2>
              <span className="bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs px-2.5 py-1 rounded-full border border-emerald-500/30">{risers.length} Pemain</span>
            </div>
            {risers.length > 0 ? (
              <div className="space-y-3">
                {risers.map((p: any, idx: number) => (
                  <div key={`${p.id}-${idx}`} className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800 hover:border-emerald-500/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <TeamShirt team={p.teamShortName} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="bg-slate-800 text-slate-300 text-[10px] font-mono px-2 py-0.5 rounded border border-slate-700 flex items-center gap-1">
                            <Calendar size={10} /> {p.changeDate}
                          </span>
                          <b className="text-white text-sm block">{p.webName}</b>
                        </div>
                        <small className="text-slate-400 text-xs">{p.teamShortName} • Ownership: {p.selectedByPercent}%</small>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block font-mono">£{p.nowCost}m</span>
                      <span className="text-emerald-400 font-bold font-mono text-sm">+£{p.priceChange}m ↗</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-slate-500 py-6">Tidak ada data.</p>}
          </section>

          <section className="card p-6 border-rose-500/30">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h2 className="text-lg font-bold text-rose-400 flex items-center gap-2"><TrendingDown size={20} /> Pemain Turun Harga</h2>
              <span className="bg-rose-500/20 text-rose-300 font-mono font-bold text-xs px-2.5 py-1 rounded-full border border-rose-500/30">{fallers.length} Pemain</span>
            </div>
            {fallers.length > 0 ? (
              <div className="space-y-3">
                {fallers.map((p: any, idx: number) => (
                  <div key={`${p.id}-${idx}`} className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800 hover:border-rose-500/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <TeamShirt team={p.teamShortName} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="bg-slate-800 text-slate-300 text-[10px] font-mono px-2 py-0.5 rounded border border-slate-700 flex items-center gap-1">
                            <Calendar size={10} /> {p.changeDate}
                          </span>
                          <b className="text-white text-sm block">{p.webName}</b>
                        </div>
                        <small className="text-slate-400 text-xs">{p.teamShortName} • Ownership: {p.selectedByPercent}%</small>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block font-mono">£{p.nowCost}m</span>
                      <span className="text-rose-400 font-bold font-mono text-sm">-£{p.priceChange}m ↘</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-slate-500 py-6">Tidak ada data.</p>}
          </section>
        </div>
      )}

      <footer className="mt-12 text-center text-xs text-slate-500 pb-6">ERA SUPER LEAGUE • V6.2 Price Changes • League ID 134820</footer>
    </main>
  );
}
