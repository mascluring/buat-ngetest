'use client';
import Link from 'next/link';
import { ArrowLeft, BarChart3 } from 'lucide-react';

export default function ComparePage() {
  return (
    <main className="container page-shell py-8">
      <div className="my-4">
        <Link href="/" className="back-link inline-flex items-center gap-2 text-slate-300 hover:text-white">
          <ArrowLeft size={16} /> Kembali ke Klasemen Utama
        </Link>
      </div>
      <header className="card p-6 my-4 bg-slate-900/90 border-slate-700">
        <h1 className="text-3xl font-black text-white">Compare Manager</h1>
        <p className="text-slate-400 text-sm mt-1">Bandingkan skuad dan perolehan poin 2 manager secara head-to-head.</p>
      </header>
      <div className="card p-6 text-slate-300">Pilih dua manager untuk mulai membandingkan.</div>
    </main>
  );
}
