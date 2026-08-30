'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Crown, RefreshCw, Sparkles, Trophy, TrendingUp, Users, Zap, Calendar } from 'lucide-react';

const fmt=(n:number)=>new Intl.NumberFormat('id-ID').format(n);
const initials=(name:string)=>name.split(' ').filter(Boolean).map(x=>x[0]).slice(0,2).join('').toUpperCase();
type Row={entry:number;entry_name:string;player_name:string;rank:number;last_rank:number;total:number;event_total:number;movement:number|null};
type Analytics={current:number|null;finishedGameweeks:number;movementReady:boolean;totalManagers:number;averageTotal:number;leader:Row|null;top10:Row[];standings:Row[];risers:Row[];fallers:Row[];biggestRiser:Row|null;biggestFaller:Row|null;highestGWScore:Row|null;maxTotal:number;currentEvent:any;lastUpdated:string};
export default function Analytics(){
 const [data,setData]=useState<Analytics|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=async()=>{setLoading(true);setError('');try{const r=await fetch('/api/analytics',{cache:'no-store'});const json=await r.json().catch(()=>null);if(!r.ok||!json?.ok)throw new Error(json?.error||`API error ${r.status}`);setData(json)}catch(e:any){setError(e?.message||'Analytics tidak dapat dimuat');setData(null)}finally{setLoading(false)}};
 useEffect(()=>{load()},[]);
 if(loading&&!data) return <main><section className="hero"><div className="container hero-inner"><Link href="/" className="back-link">← Kembali ke klasemen</Link><div className="profile-title"><div className="eyebrow">ERA SUPER LEAGUE • V5.5</div><h1>League Analytics</h1></div></div></section><div className="container page-shell"><div className="analytics-loading card flex items-center justify-center gap-3"><RefreshCw className="w-5 h-5 animate-spin text-blue-400" /><span className="animate-pulse">Memuat data dan menghitung analytics…</span></div></div></main>;
 return <main><section className="hero"><div className="container hero-inner"><div className="hero-top"><div className="brand-pill"><Trophy size={15}/> ERA SUPER LEAGUE</div><div className="id-pill">LEAGUE ID <b>134820</b></div></div><div className="profile-title"><div className="eyebrow">2026 / 27 • V5.5.2 ANALYTICS</div><h1>League <span>Analytics</span></h1><p>Dashboard performa komprehensif Era Super League.</p></div><div className="hero-meta"><span><i/> FPL Data</span><span>GW {data?.current??'—'}</span><span>{fmt(data?.totalManagers??0)} manager</span>{data?.lastUpdated&&<span className="opacity-70">Updated: {new Date(data.lastUpdated).toLocaleTimeString('id-ID')}</span>}</div></div></section>
 <div className="container page-shell">{error&&<div className="card error-banner"><b>Data FPL sedang tidak tersedia. Silakan coba lagi.</b><span>{error}</span><button onClick={load}>Coba lagi</button></div>}
 <div className="analytics-toolbar"><Link href="/" className="back-link dark"><ArrowLeft size={14}/> Klasemen Utama</Link><button onClick={load} disabled={loading}><RefreshCw size={14} className={loading?'spin':''}/> Refresh</button></div>
 
 <div className="stats-grid">
    <Stat icon={<Users/>} value={fmt(data?.totalManagers??0)} label="Total managers"/>
    <Stat icon={<Calendar/>} value={String(data?.current??'—')} label="Current GW"/>
    <Stat icon={<Zap/>} value={fmt(data?.currentEvent?.average_entry_score??0)} label="Average GW Pts"/>
    <Stat icon={<TrendingUp/>} value={fmt(data?.highestGWScore?.event_total??0)} label="Highest GW Score"/>
    <Stat icon={<Crown/>} value={data?.leader?.player_name||'—'} label="League Leader"/>
 </div>
 
 <section className="card my-4 p-6">
    <div className="section-kicker">TOP PERFORMERS</div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
            <div className="text-xs text-slate-400">Highest GW Score</div>
            <div className="text-xl font-bold">{data?.highestGWScore?.player_name || '—'}</div>
        </div>
        <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
            <div className="text-xs text-slate-400">League Leader</div>
            <div className="text-xl font-bold">{data?.leader?.player_name}</div>
        </div>
    </div>
 </section>

 <div className="analytics-feature-grid"><section className="card feature-card"><div className="section-kicker">POWER RANKING</div><h2>Top 10 Era Super League</h2><p>Urutan berdasarkan total poin.</p><div className="power-list">{data?.top10.map((r,i)=><Link href={`/manager/${r.entry}`} key={r.entry} className="power-row"><span className="power-pos">{String(i+1).padStart(2,'0')}</span><span className="avatar">{initials(r.player_name||r.entry_name)}</span><span className="power-name"><b>{r.player_name}</b><small>{r.entry_name}</small></span><span className="power-track"><i style={{width:`${Math.max(8,(r.total/(data?.maxTotal||1))*100)}%`}}/></span><strong>{fmt(r.total)}</strong></Link>)}</div></section>
 <section className="card feature-card"><div className="section-kicker">SEASON PULSE</div><h2>Momentum ranking</h2><p>Perubahan posisi sejak update terakhir.</p><div className="momentum-grid"><Momentum title="Biggest Riser" row={data?.biggestRiser} up ready={data?.movementReady}/><Momentum title="Biggest Faller" row={data?.biggestFaller} ready={data?.movementReady}/></div></section></div>
 
 <section className="card roadmap mt-6"><div><div className="section-kicker">V6 ANALYTICS — COMING SOON</div><h2>Insight berikutnya</h2>
 <div className="roadmap-tags"><span>Captain Performance</span><span>Chip Usage</span><span>Transfer Activity</span><span>Ranking History</span><span>Manager Performance Score</span></div></div></section>
 <footer>ERA SUPER LEAGUE • Analytics V5.5.2 • League ID 134820</footer></div></main>
}
function Stat({icon,value,label}:{icon:any;value:string;label:string}){return <div className="stat card"><div className="stat-icon">{icon}</div><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>}
function Momentum({title,row,up=false,ready=false}:{title:string;row?:Row|null;up?:boolean;ready?:boolean}){const d=row?.movement??0;return <div className="momentum-card"><span>{title}</span>{!ready?<><b>Mulai tersedia GW2</b><small>Belum ada perbandingan ranking.</small></>:<><b>{row?.player_name||'—'}</b><small>{row?.entry_name||'—'}</small><strong className={d>0?'up':'down'}>{d>0?'↑':'↓'} {Math.abs(d)} posisi</strong></>}</div>}
function MiniRow({row,up=false}:{row:Row;up?:boolean}){const d=row.movement; return <Link href={`/manager/${row.entry}`} className="mini-row"><span className="avatar">{initials(row.player_name||row.entry_name)}</span><span><b>{row.player_name}</b><small>{row.entry_name}</small></span><strong className={d && d>0?'up':d&&d<0?'down':'flat'}>{d===null||d===0?'—':(d>0?`↑ ${d}`:`↓ ${Math.abs(d)}`)}</strong></Link>}
