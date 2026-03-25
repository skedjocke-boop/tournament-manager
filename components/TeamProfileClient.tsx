'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Trophy = { id: string; name: string; type: string; imagePath: string | null; seasonId: string; season: { name: string } };
type HeritagePoint = { seasonName: string; elo: number; };

type DeepStats = {
  allTime: { biggestWin: any; biggestLoss: any; maxWinStreak: number; cleanSheets: number; goalsFor: number; goalsAgainst: number; favoriteOpponent: any; totalMatches: number; };
  currentSeason: { biggestWin: any; biggestLoss: any; maxWinStreak: number; cleanSheets: number; goalsFor: number; goalsAgainst: number; totalMatches: number; };
  heritageData: HeritagePoint[]; recentForm: { opponent: string; result: string; }[]; activeSeasonName: string;
};

type TeamData = { id: string; name: string; region: string; currentElo: number; primaryColor: string; secondaryColor?: string | null; logoPath?: string | null; trophies: Trophy[]; };

// Funktion för att göra om en hex-kod (ex #FF0000) till rgba-kompatibel sträng
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '55, 65, 81';
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl">
        <p className="text-slate-400 text-xs font-bold uppercase mb-1">{data.seasonName}</p>
        <p className="text-white font-black text-xl">{data.elo} ELO</p>
      </div>
    );
  }
  return null;
};

export default function TeamProfileClient({ team, deepStats }: { team: TeamData, deepStats: DeepStats }) {
  const [activeTab, setActiveTab] = useState<'STATS' | 'TROPHIES'>('STATS');

  const StatCard = ({ label, value, subtext, highlight = false }: { label: string, value: string | number, subtext?: string, highlight?: boolean }) => (
    <div className={`p-6 rounded-2xl border ${highlight ? 'border-blue-500/50 bg-blue-900/10' : 'border-slate-800 bg-slate-900/50'} flex flex-col items-center text-center justify-center transition-all hover:bg-slate-800`}>
      <span className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">{label}</span>
      <span className={`text-3xl font-black ${highlight ? 'text-white' : 'text-slate-200'}`}>{value}</span>
      {subtext && <span className="text-xs font-medium text-slate-500 mt-2 bg-slate-950 px-2 py-1 rounded border border-slate-800">{subtext}</span>}
    </div>
  );

  const rgbPrimary = hexToRgb(team.primaryColor);
  const secondaryColor = team.secondaryColor || '#020617';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-32">
      {/* 1. THE HERO SECTION MED MASSIV GLOW */}
      <div 
        className="relative w-full min-h-[55vh] py-16 flex flex-col items-center justify-center overflow-hidden border-b border-slate-800" 
        style={{ background: `radial-gradient(ellipse at center, rgba(${rgbPrimary}, 0.3) 0%, ${secondaryColor}20 50%, #020617 100%)` }}
      >
        <div className="absolute top-6 left-6 z-20"><Link href="/" className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 backdrop-blur border border-slate-700 rounded-lg text-sm font-bold text-slate-300 hover:text-white transition-colors">← Tillbaka till HQ</Link></div>
        
        <div className="relative z-10 flex flex-col items-center">
          {team.logoPath ? ( 
            <img src={team.logoPath} alt={team.name} className="w-64 h-64 md:w-80 md:h-80 lg:w-[400px] lg:h-[400px] object-contain hover:scale-105 transition-transform duration-700" 
                 style={{ filter: `drop-shadow(0 0 50px rgba(${rgbPrimary}, 0.8)) drop-shadow(0 0 100px ${secondaryColor})` }} />
          ) : ( 
            <div className="w-64 h-64 md:w-80 md:h-80 lg:w-[400px] lg:h-[400px] rounded-full flex items-center justify-center text-8xl md:text-[150px] font-black border-4 border-slate-900 transition-transform duration-700 hover:scale-105" 
                 style={{ backgroundColor: team.primaryColor, boxShadow: `0 0 60px rgba(${rgbPrimary}, 0.8), 0 0 120px ${secondaryColor}` }}>{team.name.charAt(0)}</div> 
          )}
          
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mt-12 drop-shadow-2xl">{team.name}</h1>
          <div className="flex gap-4 mt-8">
            <span className="px-6 py-2.5 rounded-full text-lg font-bold bg-slate-900/80 backdrop-blur border border-slate-700 shadow-xl">{team.region}</span>
            <span className="px-6 py-2.5 rounded-full text-lg font-bold bg-slate-900/80 backdrop-blur border border-slate-700 shadow-xl flex items-center gap-2">ELO: <span className="text-blue-400">{team.currentElo}</span></span>
          </div>
        </div>
      </div>

      {/* 2. THE TABS */}
      <div className="max-w-7xl mx-auto px-8 mt-12">
        <div className="flex border-b border-slate-800 mb-12">
          <button onClick={() => setActiveTab('STATS')} className={`px-8 py-4 font-bold text-lg border-b-2 transition-all ${activeTab === 'STATS' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>1. Statistik & Historik</button>
          <button onClick={() => setActiveTab('TROPHIES')} className={`px-8 py-4 font-bold text-lg border-b-2 transition-all flex items-center gap-2 ${activeTab === 'TROPHIES' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>2. Trophy Room {team.trophies.length > 0 && <span className="bg-amber-500 text-slate-900 text-xs px-2 py-0.5 rounded-full">{team.trophies.length}</span>}</button>
        </div>

        {/* FLIK 1: STATISTIK */}
        {activeTab === 'STATS' && (
          <div className="space-y-20 animate-in fade-in duration-500">
            
            {/* NUVARANDE SÄSONG */}
            <section>
              <div className="flex items-center gap-4 mb-8"><h2 className="text-2xl font-black text-white">Nuvarande {deepStats.activeSeasonName}</h2><div className="h-px flex-1 bg-slate-800"></div></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <StatCard label="Spelade Matcher" value={deepStats.currentSeason.totalMatches} />
                <StatCard label="Hållna Nollor" value={deepStats.currentSeason.cleanSheets} />
                <StatCard label="Längsta Winstreak" value={deepStats.currentSeason.maxWinStreak} highlight={deepStats.currentSeason.maxWinStreak >= 3} />
                <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 flex flex-col items-center justify-center text-slate-500 font-medium">
                  <span className="mb-2 uppercase text-xs font-bold tracking-widest">Senaste 5 matcherna</span>
                  <div className="flex items-center gap-2">
                    {deepStats.recentForm.map((hist, i) => (<div key={i} className={`w-4 h-4 rounded-full ${hist.result === 'W' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-red-500 shadow-red-500/20'}`} title={`${hist.result} vs ${hist.opponent}`}></div>))}
                    {deepStats.recentForm.length === 0 && <span className="text-sm">Inga matcher spelade.</span>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Största Seger" value={deepStats.currentSeason.biggestWin ? deepStats.currentSeason.biggestWin.score : '-'} subtext={deepStats.currentSeason.biggestWin ? `mot ${deepStats.currentSeason.biggestWin.opponent}` : 'Ingen ännu'} />
                <StatCard label="Tyngsta Förlust" value={deepStats.currentSeason.biggestLoss ? deepStats.currentSeason.biggestLoss.score : '-'} subtext={deepStats.currentSeason.biggestLoss ? `mot ${deepStats.currentSeason.biggestLoss.opponent}` : 'Ingen ännu'} />
              </div>
            </section>

            {/* THE HERITAGE GRAFEN */}
            <section>
              <div className="flex items-center gap-4 mb-8"><h2 className="text-2xl font-black text-white">The Heritage (Elo över tid)</h2><div className="h-px flex-1 bg-slate-800"></div></div>
              <div className="w-full h-[400px] bg-slate-900/40 border border-slate-800 rounded-2xl p-6 pt-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={deepStats.heritageData} margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
                    <defs><linearGradient id="colorElo" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={team.primaryColor} stopOpacity={0.7}/><stop offset="95%" stopColor={secondaryColor} stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="seasonName" stroke="#475569" tick={{fill: '#475569', fontSize: 12}} tickLine={false} axisLine={false} />
                    <YAxis domain={['dataMin - 50', 'dataMax + 50']} stroke="#475569" tick={{fill: '#475569', fontSize: 12}} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="elo" stroke={team.primaryColor} strokeWidth={5} fillOpacity={1} fill="url(#colorElo)" animationDuration={1500} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
            
            {/* ALL-TIME STATS */}
            <section>
              <div className="flex items-center gap-4 mb-8"><h2 className="text-2xl font-black text-white">Historik & Rekord (All-Time)</h2><div className="h-px flex-1 bg-slate-800"></div></div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Spelade Matcher" value={deepStats.allTime.totalMatches} />
                <StatCard label="Hållna Nollor" value={deepStats.allTime.cleanSheets} />
                <StatCard label="Gjorda Mål" value={deepStats.allTime.goalsFor} />
                <StatCard label="Insläppta Mål" value={deepStats.allTime.goalsAgainst} />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
                <StatCard label="Längsta Winstreak" value={deepStats.allTime.maxWinStreak} highlight={deepStats.allTime.maxWinStreak >= 5} />
                <StatCard label="Favoritmotstånd" value={deepStats.allTime.favoriteOpponent?.name || '-'} subtext={deepStats.allTime.favoriteOpponent ? `${deepStats.allTime.favoriteOpponent.wins} vinster` : ''} highlight={true} />
                <StatCard label="Största Seger" value={deepStats.allTime.biggestWin ? deepStats.allTime.biggestWin.score : '-'} subtext={deepStats.allTime.biggestWin ? `mot ${deepStats.allTime.biggestWin.opponent}` : ''} />
                <StatCard label="Tyngsta Förlust" value={deepStats.allTime.biggestLoss ? deepStats.allTime.biggestLoss.score : '-'} subtext={deepStats.allTime.biggestLoss ? `mot ${deepStats.allTime.biggestLoss.opponent}` : ''} />
              </div>
            </section>
          </div>
        )}

        {/* FLIK 2: TROPHY ROOM */}
        {activeTab === 'TROPHIES' && (
          <div className="animate-in fade-in duration-500">
            {team.trophies.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {team.trophies.map(trophy => (
                  <div key={trophy.id} className="bg-slate-900/80 border border-amber-500/30 p-10 rounded-2xl flex flex-col items-center text-center shadow-[0_0_30px_rgba(245,158,11,0.1)] hover:shadow-[0_0_50px_rgba(245,158,11,0.2)] transition-all hover:-translate-y-2 group">
                    {trophy.imagePath ? (
                      <img src={trophy.imagePath} alt={trophy.name} className="w-48 h-48 object-contain mb-8 drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)] group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="text-8xl mb-8 group-hover:scale-110 transition-transform duration-500">{trophy.type === 'TRIFECTA' ? '👑' : trophy.type === 'CL' ? '🌍' : '🏆'}</div>
                    )}
                    <h3 className="text-2xl font-black text-white mb-3">{trophy.name}</h3>
                    <div className="h-px w-16 bg-amber-500/50 mb-4"></div>
                    <p className="text-slate-400 text-sm mb-6 max-w-[250px]">
                      {trophy.type.includes('REGULAR') && "Vann grundserien genom tålamod, strategi och total dominans."}
                      {trophy.type.includes('PLAYOFF') && "Tog sig genom slutspelet och vann den avgörande finalen."}
                      {trophy.type === 'CL' && "Ett bevis på mod och list mot de absolut bästa från båda regionerna."}
                      {trophy.type === 'TRIFECTA' && "Den heliga gralen. Grundserie, Slutspel och CL under en och samma säsong."}
                    </p>
                    <span className="text-xs font-black uppercase text-amber-500 tracking-widest bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-500/20">Vunnen i {trophy.season.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-20 text-center border border-slate-800 border-dashed rounded-3xl bg-slate-900/20">
                <span className="text-6xl mb-6 opacity-50 grayscale">🏆</span>
                <h3 className="text-2xl font-bold text-slate-500 mb-2">Trophy Room ekar tomt</h3>
                <p className="text-slate-600">Laget väntar fortfarande på sin första stora titel.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}