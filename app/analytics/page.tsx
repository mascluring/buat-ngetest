'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, Sparkles, Trophy, Users } from 'lucide-react';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics')
      .then(res => res.json())
      .then(json => { setData(json); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main className="container page-shell py-8">
      <div className="my-4">
        <Link href="/" className="back-link inline-flex items-center gap-2 text-slate-300 hover:text-white">
          <ArrowLeft size={16} /> Kembali ke Klasemen Utama
        </Link>
      </div>
      <header className="card p-6 my-4 bg-slate-900/90 border-slate-700">
        <h1 className="text-3xl font-black text-white">League Analytics</h1>
        <p className="text-slate-400 text-sm mt-1">Analisis performa liga dan tren transfer.</p>
      </header>
      {loading ? (
        <div className="card text-center py-16 text-slate-400"><RefreshCw className="spin mx-auto mb-3" size={28}/> Memuat analisis...</div>
      ) : (
        <div className="card p-6">Analisis liga siap ditampilkan.</div>
      )}
    </main>
  );
}
