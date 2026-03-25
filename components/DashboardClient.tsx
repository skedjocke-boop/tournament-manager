'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { generateSchedule, saveMatchResult, initiatePlayoffs, advancePlayoffs, distributeAwards, startNextSeason, updateTeamColors, exportDatabase } from '@/app/actions';

// --- HJÄLPFUNKTIONER ---
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '55, 65, 81';
}

// 1. Typ-definitioner
type Trophy = { id: string; name: string; type: string; imagePath: string | null; seasonId: string; season: { name: string } };
export type Team = { id: string; name: string; region: string; currentElo: number; primaryColor: string; secondaryColor?: string | null; logoPath?: string | null; trophies: Trophy[]; stats: { played: number; wins: number; otWins: number; losses: number; otLosses: number; goalsFor: number; goalsAgainst: number; goalDifference: number; points: number; form: ('W' | 'L' | 'OTW' | 'OTL')[]; cleanSheets: number; }; };
export type Match = { id: string; round: number; status: string; homeScore: number | null; awayScore: number | null; isOvertime: boolean; matchType: string; playoffRound?: string | null; gameNumber?: number | null; homeTeamId: string; awayTeamId: string; homeTeam: { id: string; name: string; region: string; primaryColor: string; logoPath?: string | null; }; awayTeam: { id: string; name: string; region: string; primaryColor: string; logoPath?: string | null; }; };

interface DashboardClientProps { initialTeams: Team[]; matches: Match[]; seasonPhase: string; seasonName: string; }

type MainTab = 'START' | 'SLUTSPEL' | 'LAG' | 'RITUAL';
type SubTab = 'HSL_SERIE' | 'ASL_SERIE' | 'REPORT' | 'ELO' | 'HSL_LAG' | 'ASL_LAG' | 'HOF' | 'AWARDS' | 'SETTINGS' | 'HSL_PLAYOFF' | 'ASL_PLAYOFF' | 'CL' | 'REPORT_PLAYOFF';

// --- DELKOMPONENTER (MatchCard, LeagueTable, Bracket, Gallery) ---
const MatchCard = ({ match }: { match: Match }) => {
  const [homeScore, setHomeScore] = useState(match.homeScore?.toString() || '');
  const [awayScore, setAwayScore] = useState(match.awayScore?.toString() || '');
  const [isOvertime, setIsOvertime] = useState(match.isOvertime || false);
  const [isSaving, setIsSaving] = useState(false);
  const isCompleted = match.status === 'COMPLETED';
  const isTie = homeScore !== '' && awayScore !== '' && homeScore === awayScore;
  const canSave = homeScore !== '' && awayScore !== '' && !isTie && !isSaving && !isCompleted;
  const handleSave = async () => { if (!canSave) return; setIsSaving(true); await saveMatchResult(match.id, parseInt(homeScore), parseInt(awayScore), isOvertime); setIsSaving(false); };

  return (
    <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${isCompleted ? 'bg-slate-900/50 border-slate-800 opacity-60' : 'bg-slate-800 border-slate-700 shadow-lg'}`}>
      <div className="flex items-center gap-4 w-1/3 justify-end relative">
        {match.matchType !== 'REGULAR' && <span className="absolute -top-3 right-0 text-[10px] font-black tracking-widest text-slate-500 uppercase">Hemma (Seed)</span>}
        <span className="font-bold text-white text-right text-lg">{match.homeTeam.name}</span>
        {match.homeTeam.logoPath ? <img src={match.homeTeam.logoPath} alt={match.homeTeam.name} className="w-12 h-12 object-contain drop-shadow-md" /> : <div className="w-12 h-12 rounded-full border-2 border-slate-900 flex items-center justify-center font-bold text-sm text-white shadow-inner" style={{ backgroundColor: match.homeTeam.primaryColor }}>{match.homeTeam.name.charAt(0)}</div>}
      </div>
      <div className="flex flex-col items-center w-1/3 px-4">
        {match.matchType !== 'REGULAR' && <div className="text-xs font-black text-amber-500 mb-2 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">{match.playoffRound} - Match {match.gameNumber}</div>}
        {isCompleted ? (
          <div className="flex flex-col items-center"><div className="text-2xl font-black tracking-widest text-white">{match.homeScore} - {match.awayScore}</div>{match.isOvertime && <span className="text-xs font-bold text-amber-500">OT</span>}</div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2"><input type="number" min="0" value={homeScore} onChange={e => setHomeScore(e.target.value)} className="w-12 h-10 text-center bg-slate-950 border border-slate-700 rounded-md text-white font-bold focus:border-blue-500 outline-none" /><span className="text-slate-500 font-bold">-</span><input type="number" min="0" value={awayScore} onChange={e => setAwayScore(e.target.value)} className="w-12 h-10 text-center bg-slate-950 border border-slate-700 rounded-md text-white font-bold focus:border-blue-500 outline-none" /></div>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer"><input type="checkbox" checked={isOvertime} onChange={e => setIsOvertime(e.target.checked)} className="rounded border-slate-700 bg-slate-900" />Sudden Death</label>
            {isTie && <span className="text-xs text-red-400 mt-1">Matcher kan inte sluta oavgjort.</span>}
          </>
        )}
      </div>
      <div className="flex items-center gap-4 w-1/3 justify-between relative">
        <div className="flex items-center gap-4">
          {match.awayTeam.logoPath ? <img src={match.awayTeam.logoPath} alt={match.awayTeam.name} className="w-12 h-12 object-contain drop-shadow-md" /> : <div className="w-12 h-12 rounded-full border-2 border-slate-900 flex items-center justify-center font-bold text-sm text-white shadow-inner" style={{ backgroundColor: match.awayTeam.primaryColor }}>{match.awayTeam.name.charAt(0)}</div>}
          <span className="font-bold text-white text-lg">{match.awayTeam.name}</span>
        </div>
        {!isCompleted && <button onClick={handleSave} disabled={!canSave} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${canSave ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>{isSaving ? '...' : 'Spara'}</button>}
      </div>
    </div>
  );
};

const LeagueTable = ({ teams, leagueName }: { teams: Team[], leagueName: string }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
    <div className="p-4 border-b border-slate-800 bg-slate-950/50"><h2 className="text-xl font-bold text-white flex items-center gap-2"><div className={`w-3 h-6 rounded-sm ${leagueName === 'HSL' ? 'bg-blue-500' : 'bg-red-500'}`}></div>{leagueName} Serie</h2></div>
    <table className="w-full text-left text-sm"><thead className="bg-slate-950 text-slate-400 border-b border-slate-800"><tr><th className="px-4 py-3 font-medium w-12 text-center">#</th><th className="px-4 py-3 font-medium">Lag</th><th className="px-2 py-3 font-medium text-center">S</th><th className="px-2 py-3 font-medium text-center">W</th><th className="px-2 py-3 font-medium text-center">OTW</th><th className="px-2 py-3 font-medium text-center">L</th><th className="px-2 py-3 font-medium text-center">OTL</th><th className="px-4 py-3 font-medium text-center">+/-</th><th className="px-4 py-3 font-medium text-center text-white text-base">P</th><th className="px-4 py-3 font-medium text-center w-32">Form</th></tr></thead><tbody className="divide-y divide-slate-800">{teams.map((team, index) => ( <tr key={team.id} className="hover:bg-slate-800/50 transition-colors"><td className="px-4 py-4 text-slate-500 font-mono text-center text-base">{index + 1}</td><td className="px-4 py-4 font-bold text-white flex items-center gap-4 text-base">{team.logoPath ? <img src={team.logoPath} alt={team.name} className="w-10 h-10 object-contain drop-shadow-md" /> : <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm shadow-inner" style={{ backgroundColor: team.primaryColor }}>{team.name.charAt(0)}</div>}{team.name}</td><td className="px-2 py-4 text-center text-slate-400">{team.stats.played}</td><td className="px-2 py-4 text-center text-slate-300">{team.stats.wins}</td><td className="px-2 py-4 text-center text-slate-300">{team.stats.otWins}</td><td className="px-2 py-4 text-center text-slate-300">{team.stats.losses}</td><td className="px-2 py-4 text-center text-slate-300">{team.stats.otLosses}</td><td className="px-4 py-4 text-center text-slate-400">{team.stats.goalDifference > 0 ? `+${team.stats.goalDifference}` : team.stats.goalDifference}</td><td className="px-4 py-4 text-center font-bold text-white text-base">{team.stats.points}</td><td className="px-4 py-4 text-center"><div className="flex items-center justify-center gap-1">{[...Array(Math.max(0, 5 - team.stats.form.length))].map((_, i) => (<div key={`empty-${i}`} className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700"></div>))}{team.stats.form.map((result, i) => { let colorClass = ''; let title = ''; if (result === 'W') { colorClass = 'bg-emerald-500 shadow-emerald-500/20'; title = 'Vinst'; } else if (result === 'OTW') { colorClass = 'bg-blue-500 shadow-blue-500/20'; title = 'Övertidsvinst'; } else if (result === 'L') { colorClass = 'bg-red-500 shadow-red-500/20'; title = 'Förlust'; } else if (result === 'OTL') { colorClass = 'bg-orange-500 shadow-orange-500/20'; title = 'Övertidsförlust'; } return (<div key={`form-${i}`} className={`w-2.5 h-2.5 rounded-full shadow-sm ${colorClass}`} title={title}></div>); })}</div></td></tr>))}</tbody></table>
  </div>
);

const TeamGallery = ({ teams }: { teams: Team[] }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
    {teams.map(team => ( <Link key={team.id} href={`/teams/${team.id}`} className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-xl hover:border-slate-500 transition-all hover:scale-105 cursor-pointer group flex flex-col items-center text-center shadow-lg">{team.logoPath ? <img src={team.logoPath} alt={team.name} className="w-24 h-24 object-contain mb-4 drop-shadow-lg transition-transform group-hover:rotate-6" /> : <div className="w-24 h-24 rounded-full mb-4 shadow-lg flex items-center justify-center text-4xl font-black transition-transform group-hover:rotate-12" style={{ backgroundColor: team.primaryColor }}>{team.name.charAt(0)}</div>}<h3 className="text-xl font-bold text-white group-hover:text-blue-400">{team.name}</h3><span className="text-sm text-slate-400 mt-2 bg-slate-900 px-3 py-1 rounded-md border border-slate-700">ELO: {team.currentElo}</span><span className="text-sm font-bold text-slate-500 mt-5 group-hover:text-blue-500 transition-colors">GÅ TILL LAGSIDA →</span></Link> ))}
  </div>
);

const PlayoffBracket = ({ playoffMatches, title, icon }: { playoffMatches: Match[], title: string, icon: string }) => {
  const getSeries = (round: string) => {
    const stageMatches = playoffMatches.filter(m => m.playoffRound === round);
    const seriesMap = new Map();
    for (const m of stageMatches) {
      const pair = [m.homeTeamId, m.awayTeamId].sort().join('_');
      if (!seriesMap.has(pair)) { seriesMap.set(pair, { team1: m.gameNumber === 1 ? m.homeTeam : m.awayTeam, team2: m.gameNumber === 1 ? m.awayTeam : m.homeTeam, wins1: 0, wins2: 0, status: 'TBD' }); }
      const serie = seriesMap.get(pair);
      if (m.status === 'COMPLETED') { const winnerId = m.homeScore! > m.awayScore! ? m.homeTeamId : m.awayTeamId; if (winnerId === serie.team1.id) serie.wins1++; else serie.wins2++; }
    }
    return Array.from(seriesMap.values());
  };
  const qfSeries = getSeries('QF'); const sfSeries = getSeries('SF'); const finalSeries = getSeries('FINAL');
  const SeriesBox = ({ serie, placeholder = false }: { serie?: any, placeholder?: boolean }) => {
    if (placeholder || !serie) { return (<div className="w-56 h-20 bg-slate-900/50 border border-slate-800 rounded-lg flex flex-col justify-center px-4 relative z-10"><div className="text-slate-600 text-xs font-bold uppercase text-center">TBD vs TBD</div></div>); }
    const team1Won = serie.wins1 === 2; const team2Won = serie.wins2 === 2;
    return (
      <div className="w-56 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden shadow-lg relative z-10 flex flex-col">
        <div className={`flex items-center justify-between p-2 border-b border-slate-700/50 ${team1Won ? 'bg-slate-700/80' : 'bg-slate-800'} ${team2Won ? 'opacity-50' : ''}`}><div className="flex items-center gap-2 overflow-hidden">{serie.team1.logoPath ? <img src={serie.team1.logoPath} className="w-5 h-5 object-contain" alt="" /> : <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold" style={{backgroundColor: serie.team1.primaryColor}}>{serie.team1.name.charAt(0)}</div>}<span className={`font-bold text-sm truncate ${team1Won ? 'text-white' : 'text-slate-300'}`}>{serie.team1.name}</span></div><span className={`font-black text-sm ${team1Won ? 'text-blue-400' : 'text-slate-400'}`}>{serie.wins1}</span></div>
        <div className={`flex items-center justify-between p-2 ${team2Won ? 'bg-slate-700/80' : 'bg-slate-800'} ${team1Won ? 'opacity-50' : ''}`}><div className="flex items-center gap-2 overflow-hidden">{serie.team2.logoPath ? <img src={serie.team2.logoPath} className="w-5 h-5 object-contain" alt="" /> : <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold" style={{backgroundColor: serie.team2.primaryColor}}>{serie.team2.name.charAt(0)}</div>}<span className={`font-bold text-sm truncate ${team2Won ? 'text-white' : 'text-slate-300'}`}>{serie.team2.name}</span></div><span className={`font-black text-sm ${team2Won ? 'text-blue-400' : 'text-slate-400'}`}>{serie.wins2}</span></div>
      </div>
    );
  };
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 overflow-x-auto"><div className="flex items-center gap-4 mb-10 justify-center"><span className="text-4xl">{icon}</span><h2 className="text-3xl font-black text-white uppercase tracking-widest">{title}</h2></div>
      <div className="min-w-[800px] flex justify-between items-center relative py-10">
        <div className="flex gap-16 relative"><div className="flex flex-col gap-8 justify-around relative"><SeriesBox serie={qfSeries[0]} /><SeriesBox serie={qfSeries[1]} /></div><div className="absolute left-[224px] top-10 bottom-10 w-8 border-r-2 border-t-2 border-b-2 border-slate-700 rounded-r-lg"></div><div className="absolute left-[256px] top-1/2 w-8 border-t-2 border-slate-700"></div><div className="flex flex-col justify-center"><SeriesBox serie={sfSeries[0]} placeholder={!sfSeries[0]} /></div></div>
        <div className="flex flex-col items-center justify-center mx-16 relative"><div className="absolute -left-16 top-1/2 w-16 border-t-2 border-slate-700"></div><div className="absolute -right-16 top-1/2 w-16 border-t-2 border-slate-700"></div><div className="text-amber-500 font-black tracking-widest text-xs uppercase mb-4 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">The Final</div><div className="scale-110 shadow-[0_0_30px_rgba(30,64,175,0.2)] rounded-lg"><SeriesBox serie={finalSeries[0]} placeholder={!finalSeries[0]} /></div></div>
        <div className="flex flex-row-reverse gap-16 relative"><div className="flex flex-col gap-8 justify-around relative"><SeriesBox serie={qfSeries[2]} /><SeriesBox serie={qfSeries[3]} /></div><div className="absolute right-[224px] top-10 bottom-10 w-8 border-l-2 border-t-2 border-b-2 border-slate-700 rounded-l-lg"></div><div className="absolute right-[256px] top-1/2 w-8 border-t-2 border-slate-700"></div><div className="flex flex-col justify-center"><SeriesBox serie={sfSeries[1]} placeholder={!sfSeries[1]} /></div></div>
      </div>
    </div>
  );
};


// --- HUVUDKOMPONENT ---
export default function DashboardClient({ initialTeams, matches, seasonPhase, seasonName }: DashboardClientProps) {
  const [mainTab, setMainTab] = useState<MainTab>('START');
  const [startSubTab, setStartSubTab] = useState<SubTab>('REPORT'); 
  const [lagSubTab, setLagSubTab] = useState<SubTab>('HSL_LAG');
  const [ritualSubTab, setRitualSubTab] = useState<SubTab>('AWARDS');
  const [playoffSubTab, setPlayoffSubTab] = useState<SubTab>('REPORT_PLAYOFF'); 
  
  const [isLoading, setIsLoading] = useState(false);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [tempPrimary, setTempPrimary] = useState('');
  const [tempSecondary, setTempSecondary] = useState('');

  const sortTeams = (teamsList: Team[]) => teamsList.sort((a, b) => {
    if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points;
    if (b.stats.goalDifference !== a.stats.goalDifference) return b.stats.goalDifference - a.stats.goalDifference;
    return b.stats.goalsFor - a.stats.goalsFor;
  });

  const hslTeams = sortTeams(initialTeams.filter(t => t.region === 'HSL'));
  const aslTeams = sortTeams(initialTeams.filter(t => t.region === 'ASL'));
  const allTeamsByElo = [...initialTeams].sort((a, b) => b.currentElo - a.currentElo);

  const activeRound = matches.filter(m => m.status === 'SCHEDULED' && m.matchType === 'REGULAR').sort((a, b) => a.round - b.round)[0]?.round;
  const currentRoundMatches = activeRound ? matches.filter(m => m.round === activeRound && m.matchType === 'REGULAR') : [];
  
  const playoffMatches = matches.filter(m => m.matchType !== 'REGULAR');
  const scheduledPlayoffs = playoffMatches.filter(m => m.status === 'SCHEDULED');
  const activePlayoffRound = scheduledPlayoffs.sort((a, b) => a.round - b.round)[0]?.round;
  const currentPlayoffMatches = activePlayoffRound ? scheduledPlayoffs.filter(m => m.round === activePlayoffRound) : [];
  
  const hslPlayoffsToReport = currentPlayoffMatches.filter(m => m.matchType === 'HSL_PLAYOFF');
  const aslPlayoffsToReport = currentPlayoffMatches.filter(m => m.matchType === 'ASL_PLAYOFF');
  const clPlayoffsToReport = currentPlayoffMatches.filter(m => m.matchType === 'CHAMPIONS_LEAGUE');

  const hallOfFameData = useMemo(() => {
    const allTrophies: (Trophy & { team: Team })[] = [];
    initialTeams.forEach(team => {
      team.trophies.forEach(t => allTrophies.push({ ...t, team }));
    });

    const grouped: Record<string, typeof allTrophies> = {};
    allTrophies.forEach(t => {
      if(!grouped[t.season.name]) grouped[t.season.name] = [];
      grouped[t.season.name].push(t);
    });

    const sortedSeasons = Object.keys(grouped).sort((a, b) => {
       const numA = parseInt(a.replace(/\D/g, '')) || 0;
       const numB = parseInt(b.replace(/\D/g, '')) || 0;
       return numB - numA;
    });

    return sortedSeasons.map(season => ({ seasonName: season, trophies: grouped[season] }));
  }, [initialTeams]);

  const STANDARD_TROPHIES = [
    { type: 'TRIFECTA', name: 'Tri-fecta Champion', icon: '👑' },
    { type: 'CL', name: 'Champions League Mästare', icon: '🌍' },
    { type: 'PLAYOFF_HSL', name: 'HSL Slutspelsmästare', icon: '🏆' },
    { type: 'PLAYOFF_ASL', name: 'ASL Slutspelsmästare', icon: '🏆' },
    { type: 'REGULAR_HSL', name: 'HSL Grundserievinnare', icon: '🥇' },
    { type: 'REGULAR_ASL', name: 'ASL Grundserievinnare', icon: '🥇' },
  ];

  const TrophyCard = ({ seasonTrophies, type, title, icon, isLarge = false }: { seasonTrophies: any[], type: string, title: string, icon: string, isLarge?: boolean }) => {
    const wonTrophy = seasonTrophies.find(t => t.type === type);
    if (wonTrophy) {
        const rgbPrimary = hexToRgb(wonTrophy.team.primaryColor);
        const secondaryColor = wonTrophy.team.secondaryColor || '#020617';
        return (
            <Link href={`/teams/${wonTrophy.team.id}`} className={`relative bg-slate-950 border border-slate-700 rounded-2xl p-6 flex flex-col items-center text-center overflow-hidden group hover:border-slate-500 transition-colors cursor-pointer ${isLarge ? 'h-full justify-center min-h-[250px]' : ''}`}>
                <div className="absolute inset-0 opacity-30 group-hover:opacity-60 transition-opacity duration-700" style={{ background: `radial-gradient(circle at bottom, rgba(${rgbPrimary}, 0.8) 0%, ${secondaryColor}80 50%, transparent 100%)` }}></div>
                {wonTrophy.imagePath ? <img src={wonTrophy.imagePath} alt={wonTrophy.name} className={`${isLarge ? 'w-40 h-40' : 'w-24 h-24'} object-contain mb-4 z-10 drop-shadow-2xl group-hover:scale-110 transition-transform duration-500`} /> : <div className={`${isLarge ? 'text-8xl' : 'text-6xl'} mb-4 z-10 group-hover:scale-110 transition-transform`}>{icon}</div>}
                <h4 className="text-amber-500 font-bold text-[10px] uppercase tracking-widest z-10 mb-6">{wonTrophy.name}</h4>
                <div className="z-10 flex flex-col items-center">
                    {wonTrophy.team.logoPath ? <img src={wonTrophy.team.logoPath} alt={wonTrophy.team.name} className={`${isLarge ? 'w-20 h-20' : 'w-16 h-16'} object-contain mb-3 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]`} /> : <div className={`${isLarge ? 'w-20 h-20 text-3xl' : 'w-16 h-16 text-2xl'} rounded-full flex items-center justify-center font-black mb-3 border-2 border-slate-800 bg-slate-900`} style={{ color: wonTrophy.team.primaryColor }}>{wonTrophy.team.name.charAt(0)}</div>}
                    <h5 className={`${isLarge ? 'text-3xl' : 'text-xl'} font-black text-white`}>{wonTrophy.team.name}</h5>
                </div>
            </Link>
        );
    } else {
        return (
            <div className={`bg-slate-900/30 border border-slate-800 border-dashed rounded-2xl p-6 flex flex-col items-center text-center opacity-50 grayscale ${isLarge ? 'h-full justify-center min-h-[250px]' : ''}`}>
                <div className={`${isLarge ? 'text-7xl' : 'text-5xl'} mb-4`}>{icon}</div>
                <h4 className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mb-4">{title}</h4>
                <div className="mt-auto pt-4 border-t border-slate-800/50 w-full"><span className="text-slate-600 font-medium text-sm">Ej utdelad</span></div>
            </div>
        );
    }
  };

  const handleGenerate = async () => { setIsLoading(true); await generateSchedule(); setIsLoading(false); };
  const handleInitiatePlayoffs = async () => { if(confirm("LÅS GRUNDSERIEN OCH STARTA SLUTSPELET?")) { setIsLoading(true); await initiatePlayoffs(); setIsLoading(false); setMainTab('SLUTSPEL'); } };
  const handleAdvancePlayoffs = async () => { setIsLoading(true); await advancePlayoffs(); setIsLoading(false); };
  const handleStartNextSeason = async () => { if(confirm("ÄR DU REDO FÖR NÄSTA SÄSONG?")) { setIsLoading(true); await startNextSeason(); setIsLoading(false); setMainTab('START'); } };
  const handleSaveColors = async (teamId: string) => { setIsLoading(true); await updateTeamColors(teamId, tempPrimary, tempSecondary); setEditingTeam(null); setIsLoading(false); };

  const handleExportData = async () => {
    setIsLoading(true);
    try {
      const data = await exportDatabase();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HQ-Backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Kunde inte exportera databasen.");
    }
    setIsLoading(false);
  };

  const handleDistributeAwards = async () => { 
    setIsLoading(true); 
    await distributeAwards(); 
    setIsLoading(false); 
    
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) { return clearInterval(interval); }
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  // --- FIXEN: VI FILTRERAR PÅ DEN AKTUELLA SÄSONGENS NAMN (seasonName) ISTÄLLET FÖR ATT TA FÖRSTA BÄSTA POKAL ---
  const ceremonyData = useMemo(() => {
    if (seasonPhase !== 'OFF_SEASON') return null;
    
    // Vi filtrerar initialTeams trophies så vi BARA tittar på pokaler utdelade i 'seasonName' (t.ex. "Säsong 2")
    const currentSeasonTrophies = initialTeams.flatMap(t => 
        t.trophies
         .filter(tr => tr.season.name === seasonName) // Detta är den magiska skyddsvallen!
         .map(tr => ({ ...tr, team: t }))
    );

    const hslReg = currentSeasonTrophies.find(t => t.type === 'REGULAR_HSL');
    const aslReg = currentSeasonTrophies.find(t => t.type === 'REGULAR_ASL');
    const hslPlayoff = currentSeasonTrophies.find(t => t.type === 'PLAYOFF_HSL');
    const aslPlayoff = currentSeasonTrophies.find(t => t.type === 'PLAYOFF_ASL');
    const clWinner = currentSeasonTrophies.find(t => t.type === 'CL');
    const trifecta = currentSeasonTrophies.find(t => t.type === 'TRIFECTA');

    // Stats hämtas fortfarande från grundserien (vilket redan är filtrerat rätt i page.tsx!)
    const teamsWithMatches = initialTeams.filter(t => t.stats.played > 0);
    const mostGoals = [...teamsWithMatches].sort((a, b) => b.stats.goalsFor - a.stats.goalsFor)[0];
    const leastGoals = [...teamsWithMatches].sort((a, b) => a.stats.goalsAgainst - b.stats.goalsAgainst)[0];
    const cleanSheets = [...teamsWithMatches].sort((a, b) => b.stats.cleanSheets - a.stats.cleanSheets)[0];

    return { hslReg, aslReg, hslPlayoff, aslPlayoff, clWinner, trifecta, mostGoals, leastGoals, cleanSheets };
  }, [seasonPhase, initialTeams, seasonName]);

  const navTabs = [
    { id: 'START', label: '1. Grundserie' },
    ...(seasonPhase === 'PLAYOFFS' || seasonPhase === 'AWARDS' ? [{ id: 'SLUTSPEL', label: '2. Slutspel' }] : []),
    { id: 'LAG', label: seasonPhase === 'PLAYOFFS' || seasonPhase === 'AWARDS' ? '3. Lagen & Hall of Fame' : '2. Lagen & Hall of Fame' },
    { id: 'RITUAL', label: seasonPhase === 'PLAYOFFS' || seasonPhase === 'AWARDS' ? '4. The Ritual Room' : '3. The Ritual Room' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-6">
          HQ <span className="text-slate-500 font-light">| The Tournament Manager | </span> 
          <span className="text-blue-400 font-medium">{seasonName}</span>
        </h1>
        <div className="flex border-b border-slate-800">
          {navTabs.map((tab) => (<button key={tab.id} onClick={() => setMainTab(tab.id as MainTab)} className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${mainTab === tab.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>{tab.label}</button>))}
        </div>
      </header>

      <main>
        {/* GRUNDSERIE */}
        {mainTab === 'START' && (
           <div className="space-y-6">
            <nav className="flex space-x-2 bg-slate-900 p-1.5 rounded-lg border border-slate-800 w-fit">
              {[ { id: 'HSL_SERIE', label: 'HSL Serie' }, { id: 'ASL_SERIE', label: 'ASL Serie' }, { id: 'REPORT', label: 'Rapportera resultat' }, { id: 'ELO', label: 'Global Elo-tabell' } ].map(sub => (<button key={sub.id} onClick={() => setStartSubTab(sub.id as SubTab)} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${startSubTab === sub.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>{sub.label}</button>))}
            </nav>
            {startSubTab === 'HSL_SERIE' && <LeagueTable teams={hslTeams} leagueName="HSL" />}
            {startSubTab === 'ASL_SERIE' && <LeagueTable teams={aslTeams} leagueName="ASL" />}
            {startSubTab === 'REPORT' && (
              <div className="max-w-4xl mx-auto w-full">
                {seasonPhase === 'PRE_SEASON' ? (
                  <div className="p-12 border border-slate-800 rounded-xl bg-slate-900 text-center">
                    <span className="text-5xl mb-4">📅</span><h3 className="text-2xl font-bold text-white mb-4">Inget spelschema skapat</h3>
                    <button onClick={handleGenerate} disabled={isLoading} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors">{isLoading ? 'Laddar...' : 'Skapa Spelschema'}</button>
                  </div>
                ) : ['PLAYOFFS', 'AWARDS', 'OFF_SEASON'].includes(seasonPhase) ? (
                  <div className="p-12 border border-slate-800 rounded-xl bg-slate-900 text-center">
                    <span className="text-6xl mb-6">🏁</span><h3 className="text-3xl font-black text-white mb-4">Grundserien är stängd</h3>
                    <button onClick={() => setMainTab(seasonPhase === 'PLAYOFFS' ? 'SLUTSPEL' : 'RITUAL')} className="px-10 py-5 bg-blue-600 text-white font-black text-xl rounded-xl">Gå vidare</button>
                  </div>
                ) : !activeRound ? (
                  <div className="p-12 border border-slate-800 rounded-xl bg-slate-900 text-center"><span className="text-5xl mb-4">🏁</span><h3 className="text-2xl font-bold text-white mb-2">Alla 26 omgångar är spelade!</h3><p className="text-slate-400">Gå till The Ritual Room för att initiera slutspelet.</p></div>
                ) : (
                  <div>
                    <h2 className="text-3xl font-black text-white mb-8">Omgång {activeRound}</h2>
                    <div className="space-y-10">
                      <div><h3 className="text-xl font-bold text-blue-400 mb-6 pb-2 text-center uppercase border-b border-slate-800/50">HSL Matcher</h3><div className="space-y-4">{currentRoundMatches.filter(m => m.homeTeam.region === 'HSL').map(m => <MatchCard key={m.id} match={m} />)}</div></div>
                      <div><h3 className="text-xl font-bold text-red-400 mb-6 pb-2 text-center uppercase border-b border-slate-800/50">ASL Matcher</h3><div className="space-y-4">{currentRoundMatches.filter(m => m.homeTeam.region === 'ASL').map(m => <MatchCard key={m.id} match={m} />)}</div></div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* ELO TABELL */}
            {startSubTab === 'ELO' && (
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
                <table className="w-full text-left text-sm"><thead className="bg-slate-950 text-slate-400 border-b border-slate-800"><tr><th className="px-6 py-4 font-medium">Rank</th><th className="px-6 py-4 font-medium">Lag</th><th className="px-6 py-4 font-medium">Liga</th><th className="px-6 py-4 font-medium text-right">Elo Rating</th></tr></thead>
                  <tbody className="divide-y divide-slate-800">
                    {allTeamsByElo.map((team, index) => (
                      <tr key={team.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 text-slate-500 font-mono">#{index + 1}</td><td className="px-6 py-4 font-semibold text-white flex items-center gap-3">{team.logoPath ? <img src={team.logoPath} alt={team.name} className="w-6 h-6 object-contain" /> : <div className="w-6 h-6 rounded-full flex justify-center items-center text-[10px]" style={{ backgroundColor: team.primaryColor }}>{team.name.charAt(0)}</div>}{team.name}</td>
                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${team.region === 'HSL' ? 'bg-blue-900/50 text-blue-400' : 'bg-red-900/50 text-red-400'}`}>{team.region}</span></td><td className="px-6 py-4 text-right font-mono text-emerald-400">{team.currentElo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SLUTSPEL */}
        {mainTab === 'SLUTSPEL' && (
          <div className="space-y-6">
            <nav className="flex space-x-2 bg-slate-900 p-1.5 rounded-lg border border-slate-800 w-fit mb-8">
              {[ { id: 'HSL_PLAYOFF', label: '1.1 HSL Slutspel' }, { id: 'ASL_PLAYOFF', label: '1.2 ASL Slutspel' }, { id: 'CL', label: '1.3 Champions League' }, { id: 'REPORT_PLAYOFF', label: '1.4 Rapportera resultat' } ].map(sub => (<button key={sub.id} onClick={() => setPlayoffSubTab(sub.id as SubTab)} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${playoffSubTab === sub.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>{sub.label}</button>))}
            </nav>
            {playoffSubTab === 'HSL_PLAYOFF' && <PlayoffBracket playoffMatches={playoffMatches.filter(m => m.matchType === 'HSL_PLAYOFF')} title="Horizon Super League" icon="🏆" />}
            {playoffSubTab === 'ASL_PLAYOFF' && <PlayoffBracket playoffMatches={playoffMatches.filter(m => m.matchType === 'ASL_PLAYOFF')} title="Arctic Super League" icon="🏆" />}
            {playoffSubTab === 'CL' && <PlayoffBracket playoffMatches={playoffMatches.filter(m => m.matchType === 'CHAMPIONS_LEAGUE')} title="Champions League" icon="🌍" />}
            
            {playoffSubTab === 'REPORT_PLAYOFF' && (
              <div className="max-w-4xl mx-auto w-full">
                {!activePlayoffRound && seasonPhase === 'PLAYOFFS' ? (
                   <div className="p-12 border border-slate-800 rounded-xl bg-slate-900 text-center"><span className="text-6xl mb-6">⚙️</span><h3 className="text-3xl font-black text-white mb-4">Nuvarande Fas Avslutad</h3>
                     <button onClick={handleAdvancePlayoffs} disabled={isLoading} className="px-10 py-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xl uppercase rounded-xl shadow-xl">{isLoading ? 'ANALYSEN KÖRS...' : 'UTVÄRDERA & GENERERA NÄSTA STEG'}</button>
                   </div>
                ) : ['AWARDS', 'OFF_SEASON'].includes(seasonPhase) ? (
                   <div className="p-12 border border-slate-800 rounded-xl bg-slate-900 text-center"><span className="text-6xl mb-6">🏆</span><h3 className="text-3xl font-black text-white mb-4">Slutspelet är Avgjort!</h3>
                     <button onClick={() => setMainTab('RITUAL')} className="px-8 py-4 bg-yellow-600 text-white font-bold rounded-xl">Gå till The Ritual Room</button>
                   </div>
                ) : (
                  <div>
                    <h2 className="text-3xl font-black text-white mb-8">Slutspelsomgång {activePlayoffRound}</h2>
                    <div className="space-y-12">
                      {hslPlayoffsToReport.length > 0 && (<div><h3 className="text-xl font-bold text-blue-400 mb-6 pb-2 text-center uppercase border-b border-slate-800/50">HSL Slutspel</h3><div className="space-y-4">{hslPlayoffsToReport.map(match => <MatchCard key={match.id} match={match} />)}</div></div>)}
                      {aslPlayoffsToReport.length > 0 && (<div><h3 className="text-xl font-bold text-red-400 mb-6 pb-2 text-center uppercase border-b border-slate-800/50">ASL Slutspel</h3><div className="space-y-4">{aslPlayoffsToReport.map(match => <MatchCard key={match.id} match={match} />)}</div></div>)}
                      {clPlayoffsToReport.length > 0 && (<div><h3 className="text-xl font-bold text-amber-400 mb-6 pb-2 text-center uppercase border-b border-slate-800/50">Champions League</h3><div className="space-y-4">{clPlayoffsToReport.map(match => <MatchCard key={match.id} match={match} />)}</div></div>)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* LAGEN & HALL OF FAME */}
        {mainTab === 'LAG' && (
          <div className="space-y-6">
            <nav className="flex space-x-2 bg-slate-900 p-1.5 rounded-lg border border-slate-800 w-fit mb-8">
              <button onClick={() => setLagSubTab('HSL_LAG')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${lagSubTab === 'HSL_LAG' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>1 HSL Lagen</button>
              <button onClick={() => setLagSubTab('ASL_LAG')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${lagSubTab === 'ASL_LAG' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>2 ASL Lagen</button>
              <button onClick={() => setLagSubTab('HOF')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${lagSubTab === 'HOF' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-amber-500'}`}>3 Hall of Fame 🏛️</button>
            </nav>
            
            {lagSubTab === 'HSL_LAG' && <TeamGallery teams={hslTeams} />}
            {lagSubTab === 'ASL_LAG' && <TeamGallery teams={aslTeams} />}
            
            {lagSubTab === 'HOF' && (
              <div className="space-y-16 animate-in fade-in duration-700">
                <div className="text-center mb-12">
                   <h2 className="text-5xl md:text-7xl font-black text-white uppercase tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">The Hall of Fame</h2>
                </div>

                {hallOfFameData.map(season => {
                  const hasTrifecta = season.trophies.some(t => t.type === 'TRIFECTA');
                  return (
                    <div key={season.seasonName} className="bg-slate-900 border border-slate-800 rounded-3xl p-10 relative overflow-hidden shadow-2xl">
                       <h3 className="text-4xl font-black text-amber-500 tracking-widest uppercase mb-10 border-b border-slate-800 pb-4">{season.seasonName}</h3>
                       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
                          <div className="flex flex-col gap-6">
                             <div className="text-center font-black text-slate-500 uppercase tracking-widest border-b border-slate-800/50 pb-2 mb-2">Arctic Super League</div>
                             <TrophyCard seasonTrophies={season.trophies} type="REGULAR_ASL" title="ASL Grundserievinnare" icon="🥇" />
                             <TrophyCard seasonTrophies={season.trophies} type="PLAYOFF_ASL" title="ASL Slutspelsmästare" icon="🏆" />
                          </div>
                          <div className="flex flex-col gap-6">
                             <div className="text-center font-black text-slate-500 uppercase tracking-widest border-b border-slate-800/50 pb-2 mb-2">Horizon Super League</div>
                             <TrophyCard seasonTrophies={season.trophies} type="REGULAR_HSL" title="HSL Grundserievinnare" icon="🥇" />
                             <TrophyCard seasonTrophies={season.trophies} type="PLAYOFF_HSL" title="HSL Slutspelsmästare" icon="🏆" />
                          </div>
                          <div className="flex flex-col gap-6 h-full">
                             <div className="text-center font-black text-amber-500/70 uppercase tracking-widest border-b border-amber-900/30 pb-2 mb-2">Globala Titlar</div>
                             {hasTrifecta ? (
                                <>
                                   <TrophyCard seasonTrophies={season.trophies} type="CL" title="Champions League Mästare" icon="🌍" />
                                   <TrophyCard seasonTrophies={season.trophies} type="TRIFECTA" title="Tri-fecta Champion" icon="👑" />
                                </>
                             ) : (
                                <div className="flex-1 flex flex-col h-full min-h-[500px]">
                                   <TrophyCard seasonTrophies={season.trophies} type="CL" title="Champions League Mästare" icon="🌍" isLarge={true} />
                                </div>
                             )}
                          </div>
                       </div>
                    </div>
                  );
                })}
                
                {hallOfFameData.length === 0 && (
                   <div className="text-center p-20 text-slate-500 font-medium border border-slate-800 border-dashed rounded-2xl">
                      Inga pokaler har delats ut än. Spela klart Säsong 1 för att inviga The Hall of Fame.
                   </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* THE RITUAL ROOM */}
        {mainTab === 'RITUAL' && (
          <div className="space-y-6">
            <nav className="flex space-x-2 bg-slate-900 p-1.5 rounded-lg border border-slate-800 w-fit mb-8">
              <button onClick={() => setRitualSubTab('AWARDS')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${ritualSubTab === 'AWARDS' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>1 Ceremonier</button>
              <button onClick={() => setRitualSubTab('SETTINGS')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${ritualSubTab === 'SETTINGS' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>2 System & Färg</button>
            </nav>
            
            {ritualSubTab === 'SETTINGS' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
                   <h2 className="text-2xl font-black text-white mb-4 flex items-center gap-3">
                     <span className="text-emerald-500">💾</span> Database Export (Backup)
                   </h2>
                   <p className="text-slate-400 mb-6">Ladda ner en fullständig snapshot av din nuvarande databas.</p>
                   <button onClick={handleExportData} disabled={isLoading} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-emerald-500/20">
                     {isLoading ? 'SAMMANSTÄLLER DATA...' : 'EXPORTERA DATABAS (.json)'}
                   </button>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
                  <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                    <span className="text-blue-500">🎨</span> Färginställningar
                  </h2>
                  <p className="text-slate-400 mb-8">Definiera lagens primära och sekundära färger för att maximera The Glow på deras lagsidor och i The Hall of Fame.</p>
                  
                  <div className="space-y-4">
                    {initialTeams.map(team => (
                      <div key={team.id} className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors">
                        <div className="flex items-center gap-4">
                          {team.logoPath ? <img src={team.logoPath} className="w-10 h-10 object-contain" /> : <div className="w-10 h-10 rounded-full bg-slate-800" />}
                          <span className="font-bold text-white w-32">{team.name}</span>
                          <span className={`text-xs px-2 py-1 rounded font-bold ${team.region === 'HSL' ? 'bg-blue-900/50 text-blue-400' : 'bg-red-900/50 text-red-400'}`}>{team.region}</span>
                        </div>
                        
                        {editingTeam === team.id ? (
                          <div className="flex items-center gap-4">
                            <label className="flex flex-col text-xs text-slate-500 font-bold">
                              Primär (Hex)
                              <div className="flex items-center gap-2 mt-1">
                                <input type="color" value={tempPrimary} onChange={(e) => setTempPrimary(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0" />
                                <input type="text" value={tempPrimary} onChange={(e) => setTempPrimary(e.target.value)} className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white" />
                              </div>
                            </label>
                            <label className="flex flex-col text-xs text-slate-500 font-bold">
                              Sekundär (Hex)
                              <div className="flex items-center gap-2 mt-1">
                                <input type="color" value={tempSecondary} onChange={(e) => setTempSecondary(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0" />
                                <input type="text" value={tempSecondary} onChange={(e) => setTempSecondary(e.target.value)} className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white" />
                              </div>
                            </label>
                            <div className="flex flex-col gap-1">
                              <button onClick={() => handleSaveColors(team.id)} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-1.5 rounded transition-colors mt-4">Spara</button>
                              <button onClick={() => setEditingTeam(null)} className="text-slate-500 hover:text-slate-300 text-xs mt-1">Avbryt</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-8">
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full border border-slate-700" style={{ backgroundColor: team.primaryColor }} title="Primärfärg" />
                              <div className="w-6 h-6 rounded-full border border-slate-700 relative overflow-hidden" style={{ backgroundColor: team.secondaryColor || '#020617' }} title="Sekundärfärg">
                                {!team.secondaryColor && <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-600">-</div>}
                              </div>
                            </div>
                            <button onClick={() => { setEditingTeam(team.id); setTempPrimary(team.primaryColor); setTempSecondary(team.secondaryColor || '#000000'); }} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-lg transition-colors border border-slate-700">
                              Ändra
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {ritualSubTab === 'AWARDS' && (
              <>
                {seasonPhase === 'PLAYOFFS' ? (
                  <div className="p-12 border border-slate-800 rounded-xl bg-slate-900 text-center flex flex-col items-center">
                    <span className="text-5xl mb-6">⏳</span><h3 className="text-3xl font-black text-white mb-4">Slutspelet Pågår</h3>
                    <button onClick={() => { setMainTab('SLUTSPEL'); setPlayoffSubTab('REPORT_PLAYOFF'); }} className="px-8 py-4 bg-slate-800 text-white font-bold rounded-xl">Följ Slutspelet</button>
                  </div>
                ) : seasonPhase === 'AWARDS' ? (
                   <div className="p-12 border border-slate-800 rounded-xl bg-slate-900 text-center">
                    <span className="text-6xl mb-6 drop-shadow-[0_0_20px_rgba(234,179,8,0.8)]">🥇</span>
                    <h3 className="text-3xl font-black text-white mb-4 tracking-tight">Säsongen är över!</h3>
                    <p className="text-slate-400 max-w-xl mx-auto mb-8 text-lg">Alla matcher är spelade. Klicka nedan för att starta avslutningsceremonin.</p>
                    <button onClick={handleDistributeAwards} disabled={isLoading} className="px-12 py-6 bg-gradient-to-br from-yellow-400 to-amber-700 text-white font-black text-2xl uppercase rounded-2xl shadow-[0_0_40px_rgba(234,179,8,0.6)] hover:scale-105 transition-transform">
                      {isLoading ? 'LADDAR CEREMONI...' : 'STARTA CEREMONIN'}
                    </button>
                  </div>
                ) : seasonPhase === 'OFF_SEASON' && ceremonyData ? (
                   <div className="space-y-12 animate-in fade-in duration-700">
                      <div className="text-center mb-16">
                        <span className="text-6xl mb-4 block drop-shadow-[0_0_20px_rgba(234,179,8,0.8)]">🎇</span>
                        <h2 className="text-5xl font-black text-white tracking-widest uppercase drop-shadow-md">Säsongsavslutning ({seasonName})</h2>
                        <div className="h-1 w-32 bg-amber-500 mx-auto mt-6 rounded-full"></div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {ceremonyData.hslReg && (
                          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-8 flex items-center gap-8 shadow-xl hover:border-slate-500 transition-colors">
                            {ceremonyData.hslReg.imagePath ? <img src={ceremonyData.hslReg.imagePath} alt="Medal" className="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" /> : <div className="text-6xl">🥇</div>}
                            <div>
                              <h4 className="text-amber-500 font-bold text-sm tracking-widest uppercase mb-1">HSL Grundserievinnare</h4>
                              <h3 className="text-3xl font-black text-white mb-2">{ceremonyData.hslReg.team.name}</h3>
                            </div>
                          </div>
                        )}
                        {ceremonyData.aslReg && (
                          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-8 flex items-center gap-8 shadow-xl hover:border-slate-500 transition-colors">
                            {ceremonyData.aslReg.imagePath ? <img src={ceremonyData.aslReg.imagePath} alt="Medal" className="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" /> : <div className="text-6xl">🥇</div>}
                            <div>
                              <h4 className="text-amber-500 font-bold text-sm tracking-widest uppercase mb-1">ASL Grundserievinnare</h4>
                              <h3 className="text-3xl font-black text-white mb-2">{ceremonyData.aslReg.team.name}</h3>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {ceremonyData.hslPlayoff && (
                          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-8 flex items-center gap-8 shadow-xl relative overflow-hidden hover:border-blue-500/50 transition-colors">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full"></div>
                            {ceremonyData.hslPlayoff.imagePath ? <img src={ceremonyData.hslPlayoff.imagePath} alt="Cup" className="w-28 h-28 object-contain drop-shadow-[0_0_20px_rgba(245,158,11,0.7)]" /> : <div className="text-7xl">🏆</div>}
                            <div className="relative z-10">
                              <h4 className="text-blue-400 font-bold text-sm tracking-widest uppercase mb-1">HSL Slutspelsmästare</h4>
                              <h3 className="text-3xl font-black text-white mb-2">{ceremonyData.hslPlayoff.team.name}</h3>
                            </div>
                          </div>
                        )}
                        {ceremonyData.aslPlayoff && (
                          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-8 flex items-center gap-8 shadow-xl relative overflow-hidden hover:border-red-500/50 transition-colors">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-3xl rounded-full"></div>
                            {ceremonyData.aslPlayoff.imagePath ? <img src={ceremonyData.aslPlayoff.imagePath} alt="Cup" className="w-28 h-28 object-contain drop-shadow-[0_0_20px_rgba(245,158,11,0.7)]" /> : <div className="text-7xl">🏆</div>}
                            <div className="relative z-10">
                              <h4 className="text-red-400 font-bold text-sm tracking-widest uppercase mb-1">ASL Slutspelsmästare</h4>
                              <h3 className="text-3xl font-black text-white mb-2">{ceremonyData.aslPlayoff.team.name}</h3>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {ceremonyData.clWinner && (
                          <div className="bg-slate-900 border border-slate-600 rounded-2xl p-10 flex flex-col items-center text-center shadow-[0_0_40px_rgba(255,255,255,0.1)] relative overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-700/40 via-slate-900 to-slate-950"></div>
                            <div className="relative z-10 flex flex-col items-center">
                              {ceremonyData.clWinner.imagePath ? <img src={ceremonyData.clWinner.imagePath} alt="CL Cup" className="w-40 h-40 object-contain mb-6 drop-shadow-[0_0_30px_rgba(255,255,255,0.5)] hover:scale-110 transition-transform duration-500" /> : <div className="text-8xl mb-6">🌍</div>}
                              <h4 className="text-slate-300 font-bold text-sm tracking-widest uppercase mb-2">Champions League Vinnare</h4>
                              <h3 className="text-4xl font-black text-white mb-4">{ceremonyData.clWinner.team.name}</h3>
                            </div>
                          </div>
                        )}
                        
                        {ceremonyData.trifecta ? (
                          <div className="bg-gradient-to-b from-amber-900/40 to-slate-900 border border-amber-500/50 rounded-2xl p-10 flex flex-col items-center text-center shadow-[0_0_50px_rgba(245,158,11,0.2)] relative overflow-hidden group">
                            <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-50"></div>
                            <div className="relative z-10 flex flex-col items-center">
                              {ceremonyData.trifecta.imagePath ? <img src={ceremonyData.trifecta.imagePath} alt="Trifecta" className="w-40 h-40 object-contain mb-6 drop-shadow-[0_0_40px_rgba(245,158,11,0.8)] group-hover:scale-110 group-hover:rotate-3 transition-transform duration-700" /> : <div className="text-8xl mb-6">👑</div>}
                              <h4 className="text-amber-500 font-bold text-sm tracking-widest uppercase mb-2 animate-pulse">The Tri-Fecta</h4>
                              <h3 className="text-4xl font-black text-white mb-4">{ceremonyData.trifecta.team.name}</h3>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-2xl p-10 flex flex-col items-center text-center justify-center opacity-60 grayscale h-full min-h-[300px]">
                            <div className="text-7xl mb-4">👑</div>
                            <h4 className="text-slate-500 font-bold tracking-widest uppercase mb-2">Ingen Tri-Fecta</h4>
                            <p className="text-slate-600 text-sm max-w-sm">Det svåraste man kan göra i The Tournament Manager förblev ogjort denna säsong.</p>
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 mt-12">
                        <h3 className="text-xl font-bold text-white mb-6 text-center uppercase tracking-widest border-b border-slate-800 pb-4">Säsongens Prestationer</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-center">
                            <div className="text-slate-500 text-xs font-bold uppercase mb-2">Flest Hållna Nollor</div>
                            <div className="text-3xl font-black text-emerald-400 mb-1">{ceremonyData.cleanSheets?.stats.cleanSheets} st</div>
                            <div className="text-white font-bold">{ceremonyData.cleanSheets?.name}</div>
                          </div>
                          <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-center">
                            <div className="text-slate-500 text-xs font-bold uppercase mb-2">Flest Gjorda Mål</div>
                            <div className="text-3xl font-black text-blue-400 mb-1">{ceremonyData.mostGoals?.stats.goalsFor} st</div>
                            <div className="text-white font-bold">{ceremonyData.mostGoals?.name}</div>
                          </div>
                          <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-center">
                            <div className="text-slate-500 text-xs font-bold uppercase mb-2">Minst Insläppta Mål</div>
                            <div className="text-3xl font-black text-red-400 mb-1">{ceremonyData.leastGoals?.stats.goalsAgainst} st</div>
                            <div className="text-white font-bold">{ceremonyData.leastGoals?.name}</div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-12 text-center border-t border-slate-800">
                        <p className="text-slate-400 mb-6">Grattis till alla vinnare. Historien är skriven, pokalerna är placerade i lagens Trophy Rooms och The Elo Journey har sparats.</p>
                        <button onClick={handleStartNextSeason} disabled={isLoading} className="px-12 py-5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-black text-lg uppercase tracking-widest rounded-xl transition-all shadow-xl hover:scale-105">
                          {isLoading ? 'RULLAR FRAM NÄSTA SÄSONG...' : 'STÄNG SÄSONG & GÅ VIDARE'}
                        </button>
                      </div>
                   </div>
                ) : (
                  <div className="p-12 border border-slate-800 rounded-xl bg-slate-900 text-center flex flex-col items-center">
                    <span className="text-6xl mb-6">🏆</span><h3 className="text-3xl font-black text-white mb-4">Dags för Slutspel?</h3>
                    <button onClick={handleInitiatePlayoffs} disabled={isLoading} className="px-12 py-6 bg-yellow-600 text-white font-black text-2xl uppercase rounded-2xl hover:scale-105 transition-transform shadow-xl">INITIERA SLUTSPEL</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}