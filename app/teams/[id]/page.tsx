import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import BackButton from "@/components/BackButton"

// HIERARKIN FÖR LÄNDERNAS EGET PRISSKÅP
const TROPHY_ORDER = [
    'THE TRI-FECTA', 
    'Champions League Vinnare', 
    'Världsmästare', 
    'Vinnare Elitserien', 
    'Vinnare Superettan', 
    'Sämst'
];

export const dynamic = 'force-dynamic';

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const team = await prisma.team.findUnique({
        where: { id: id },
        include: {
            homeMatches: { where: { status: 'COMPLETED' }, include: { awayTeam: true, season: true } },
            awayMatches: { where: { status: 'COMPLETED' }, include: { homeTeam: true, season: true } },
            trophies: { include: { season: true } },
            eloHistory: { orderBy: { date: 'asc' }, include: { match: { include: { season: true } } } }
        }
    });

    if (!team) notFound();

    const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });

    const allMatches = [
        ...team.homeMatches.map(m => ({ ...m, isHome: true, oppTeam: m.awayTeam, teamPoints: m.homePoints!, oppPoints: m.awayPoints! })),
        ...team.awayMatches.map(m => ({ ...m, isHome: false, oppTeam: m.homeTeam, teamPoints: m.awayPoints!, oppPoints: m.homePoints! }))
    ].filter(m => m.oppTeam?.name !== 'TBD').sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

    const currentSeasonMatches = allMatches.filter(m => m.seasonId === activeSeason?.id);
    const currentSeasonLeagueMatches = currentSeasonMatches.filter(m => m.matchType === 'REGULAR');

    let csWins = 0, csLosses = 0, csOtWins = 0, csOtLosses = 0;
    let csGoalsFor = 0, csGoalsAgainst = 0;
    currentSeasonLeagueMatches.forEach(m => {
        csGoalsFor += m.teamPoints;
        csGoalsAgainst += m.oppPoints;
        if (m.teamPoints > m.oppPoints) { if (m.isSuddenDeath) csOtWins++; else csWins++; }
        else { if (m.isSuddenDeath) csOtLosses++; else csLosses++; }
    });
    const csPoints = (csWins * 3) + (csOtWins * 2) + (csOtLosses * 1);

    const recent10Matches = allMatches.slice(-10);
    const formArray = recent10Matches.map(m => {
        const isWin = m.teamPoints > m.oppPoints;
        if (isWin) return m.isSuddenDeath ? 'OTW' : 'W';
        return m.isSuddenDeath ? 'OTL' : 'L';
    });

    let totalWins = 0, totalLosses = 0, sdWins = 0, sdLosses = 0;
    let homeWins = 0, homeLosses = 0;
    let totalGoalsFor = 0, totalGoalsAgainst = 0;
    let fiftyClub = 0, lockdowns = 0, cleanSheets = 0, nailBiters = 0, giantSlayers = 0;
    let maxStreak = 0, currentStreak = 0;
    let biggestWinMargin = 0;

    const h2hMap = new Map<string, { name: string, wins: number, losses: number, matches: number }>();

    allMatches.forEach(m => {
        totalGoalsFor += m.teamPoints;
        totalGoalsAgainst += m.oppPoints;

        const isWin = m.teamPoints > m.oppPoints;
        const margin = Math.abs(m.teamPoints - m.oppPoints);

        if (!h2hMap.has(m.oppTeam.id)) h2hMap.set(m.oppTeam.id, { name: m.oppTeam.name, wins: 0, losses: 0, matches: 0 });
        const h2h = h2hMap.get(m.oppTeam.id)!;
        h2h.matches += 1;

        if (isWin) {
            totalWins++;
            h2h.wins += 1;
            currentStreak++;
            if (currentStreak > maxStreak) maxStreak = currentStreak;

            if (m.isHome) homeWins++;
            if (m.isSuddenDeath) sdWins++;

            if (margin > biggestWinMargin) { biggestWinMargin = margin; }
            if (m.teamPoints >= 50) fiftyClub++;
            if (m.oppPoints < 15 && m.oppPoints > 0) lockdowns++;
            if (m.oppPoints === 0) cleanSheets++;
            if (margin <= 3) nailBiters++;

            const oppElo = m.oppTeam.currentElo;
            if (oppElo - team.currentElo >= 150) giantSlayers++;
        } else {
            totalLosses++;
            h2h.losses += 1;
            currentStreak = 0;
            if (m.isHome) homeLosses++;
            if (m.isSuddenDeath) sdLosses++;
        }
    });

    let nemesis = { name: '-', winRate: 100, matches: 0 };
    let favorite = { name: '-', winRate: 0, matches: 0 };
    h2hMap.forEach(stats => {
        if (stats.matches >= 2) { 
            const winRate = (stats.wins / stats.matches) * 100;
            if (winRate < nemesis.winRate) nemesis = { name: stats.name, winRate, matches: stats.matches };
            if (winRate > favorite.winRate) favorite = { name: stats.name, winRate, matches: stats.matches };
        }
    });

    const allTimeRatio = totalGoalsAgainst > 0 ? (totalGoalsFor / totalGoalsAgainst).toFixed(2) : totalGoalsFor.toString();
    const sdPercentage = (sdWins + sdLosses) > 0 ? Math.round((sdWins / (sdWins + sdLosses)) * 100) : 0;

    // --- NY LOGIK FÖR ELO-GRAFEN (MAKRO-TREND) ---
    const seasonSummary: {elo: number, seasonName: string}[] = [{ elo: 1200, seasonName: 'Start' }];
    let lastSeenSeason = "";
    let lastEloForSeason = 1200;

    team.eloHistory.forEach((h, index) => {
        const sName = h.match?.season?.name || 'Okänd';
        
        // Om vi byter till en ny säsong i loopen, spara den förra säsongens sista Elo
        if (sName !== lastSeenSeason && lastSeenSeason !== "") {
            seasonSummary.push({ elo: lastEloForSeason, seasonName: lastSeenSeason });
        }
        
        lastSeenSeason = sName;
        lastEloForSeason = h.elo;

        // Pucha alltid in absolut sista värdet som nuvarande status
        if (index === team.eloHistory.length - 1) {
             seasonSummary.push({ elo: h.elo, seasonName: sName });
        }
    });

    if (team.eloHistory.length === 0) {
        seasonSummary.push({ elo: team.currentElo, seasonName: activeSeason?.name || 'Nuvarande' });
    }

    const elos = seasonSummary.map(h => h.elo);
    const minElo = Math.min(...elos) - 20;
    const maxElo = Math.max(...elos) + 20;
    const range = maxElo - minElo === 0 ? 40 : maxElo - minElo;
    
    const graphHeight = 180; 
    const pointsList = seasonSummary.map((d, index) => {
        const x = seasonSummary.length === 1 ? 500 : (index / (seasonSummary.length - 1)) * 1000;
        const y = graphHeight - (((d.elo - minElo) / range) * graphHeight) + 10;
        return { x, y, elo: d.elo, seasonName: d.seasonName };
    });
    
    const pointsString = pointsList.map(p => `${p.x},${p.y}`).join(' ');
    const fillPolygon = `0,${graphHeight + 10} ${pointsString} 1000,${graphHeight + 10}`;

    const c1 = team.primaryColor;
    const c2 = team.secondaryColor || team.primaryColor;
    const c3 = team.tertiaryColor || team.secondaryColor || team.primaryColor;

    const sortedTrophies = [...team.trophies].sort((a,b) => {
        let idxA = TROPHY_ORDER.indexOf(a.name);
        let idxB = TROPHY_ORDER.indexOf(b.name);
        if (idxA === -1) idxA = 99; if (idxB === -1) idxB = 99;
        return idxA - idxB;
    });

    const Badge = ({ icon, count, title, desc }: { icon: string, count: number, title: string, desc: string }) => {
        if (count === 0) return null;
        return (
            <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center gap-5 shadow-xl border border-slate-800 min-w-[200px]" title={desc}>
                <div className="text-4xl drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">{icon}</div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{title}</span>
                    <span className="font-black text-2xl flex items-baseline gap-1 text-slate-100">x{count}</span>
                </div>
            </div>
        )
    };

    const FormIcon = ({ result }: { result: string }) => {
        let bgColor = 'bg-slate-700';
        if (result === 'W') bgColor = 'bg-green-600';
        if (result === 'OTW') bgColor = 'bg-blue-600';
        if (result === 'OTL') bgColor = 'bg-orange-600';
        if (result === 'L') bgColor = 'bg-red-600';
        return <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] text-white font-bold shadow-sm ${bgColor}`} title={result}>{result.replace('OT', 'S')[0]}</div>
    };

    return (
        <main className="min-h-screen bg-slate-950 pb-24 font-sans selection:bg-[var(--c1)] selection:text-slate-900" style={{ '--c1': c1, '--c2': c2, '--c3': c3 } as React.CSSProperties}>
            
            <style dangerouslySetInnerHTML={{__html: `
                .swirl-hero {
                    background: radial-gradient(circle at 30% 30%, var(--c1) 0%, transparent 60%),
                                radial-gradient(circle at 70% 70%, var(--c2) 0%, transparent 60%),
                                radial-gradient(circle at 50% 50%, var(--c3) 0%, transparent 80%);
                    opacity: 0.3;
                    filter: blur(60px);
                    animation: swirl 15s ease-in-out infinite alternate;
                }
                .swirl-glow {
                    background: linear-gradient(45deg, var(--c1), var(--c2), var(--c3));
                    background-size: 200% 200%;
                    animation: glowMove 8s ease infinite;
                }
                @keyframes swirl {
                    0% { transform: scale(1) rotate(0deg); }
                    50% { transform: scale(1.1) rotate(10deg); }
                    100% { transform: scale(1) rotate(-5deg); }
                }
                @keyframes glowMove {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
            `}} />

            <div className="relative pt-12 pb-32 overflow-hidden flex flex-col items-center border-b border-slate-900 shadow-2xl">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] swirl-hero pointer-events-none rounded-full"></div>
                
                <div className="w-full max-w-[1200px] mx-auto px-6 relative z-20 flex justify-between items-center mb-8">
                    <BackButton />
                </div>

                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="relative flex justify-center items-center mb-10 group">
                        <div className="absolute inset-0 swirl-glow blur-[100px] opacity-60 group-hover:opacity-100 transition-opacity duration-700 rounded-full scale-125"></div>
                        {team.logoPath ? ( 
                            <img src={team.logoPath} alt={team.name} className="w-64 h-64 md:w-80 md:h-80 object-contain relative z-20 drop-shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-transform duration-500 hover:scale-105" /> 
                        ) : ( 
                            <div className="w-64 h-64 md:w-80 md:h-80 rounded-full shadow-[0_0_50px_rgba(0,0,0,0.5)] border-4 border-slate-800 relative z-20 transition-transform duration-500 hover:scale-105" style={{ backgroundColor: team.primaryColor }}></div> 
                        )}
                    </div>
                    
                    <h1 className="text-6xl md:text-8xl font-black text-white uppercase tracking-tighter mb-6 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">{team.name}</h1>
                    
                    <div className="flex items-center justify-center gap-3 mb-10">
                        <span className="bg-slate-900 border border-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-widest px-6 py-2 rounded-full shadow-inner">{team.division}</span>
                    </div>

                    <div className="flex items-center justify-center gap-12 bg-slate-900/50 backdrop-blur-xl px-12 py-6 rounded-3xl shadow-2xl border border-slate-800/50 relative overflow-hidden">
                        <div className="absolute bottom-0 left-0 w-full h-1 swirl-glow"></div>
                        <div className="flex flex-col items-center relative z-10">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Aktuell Elo</span>
                            <span className="text-5xl font-black text-white drop-shadow-[0_0_15px_var(--c1)]">{Math.round(team.currentElo)}</span>
                        </div>
                        <div className="w-px h-16 bg-slate-800 relative z-10"></div>
                        <div className="flex flex-col items-center relative z-10">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Peak Elo</span>
                            <span className="text-5xl font-black text-slate-300">{team.peakElo}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1200px] mx-auto px-6 flex flex-col gap-20 relative z-30 -mt-10">
                
                <section className="flex flex-col items-center w-full">
                    <div className="flex overflow-x-auto gap-6 pb-6 snap-x hide-scrollbar w-full">
                        <Badge icon="🔥" count={fiftyClub} title="50's Club" desc="Gjort 50 poäng eller mer i en match" />
                        <Badge icon="🧱" count={lockdowns} title="Lockdown" desc="Hållit motståndaren under 15 poäng" />
                        <Badge icon="🧹" count={cleanSheets} title="Clean Sheet" desc="Hållit motståndaren på 0 poäng" />
                        <Badge icon="😬" count={nailBiters} title="Nail-Biter" desc="Vunnit med 3 poäng eller mindre" />
                        <Badge icon="🗡️" count={giantSlayers} title="Giant Slayer" desc="Slagit ett lag med 150+ mer i Elo" />
                        <Badge icon="🚀" count={maxStreak} title="Win Streak" desc="Flest vinster i rad historiskt" />
                    </div>
                </section>

                <section className="flex flex-col items-center w-full">
                    <h2 className="text-xl font-black uppercase tracking-widest text-slate-100 mb-8 border-b border-slate-800 pb-3 w-full max-w-4xl text-center">Makro Elo-Trend</h2>
                    <div className="w-full max-w-4xl bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 p-8 pt-12 pb-6 relative overflow-hidden h-[350px] flex items-end">
                        <div className="absolute top-6 left-8 text-[10px] font-black uppercase tracking-widest text-slate-500">Peak: {maxElo - 20}</div>
                        <div className="absolute top-1/2 left-8 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest text-slate-500">Min: {minElo + 20}</div>
                        
                        <svg viewBox="0 0 1000 230" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                            <defs>
                                <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="var(--c1)" stopOpacity="0.5" />
                                    <stop offset="100%" stopColor="var(--c2)" stopOpacity="0.0" />
                                </linearGradient>
                            </defs>
                            
                            <polygon points={fillPolygon} fill="url(#gradient)" />
                            <polyline points={pointsString} fill="none" stroke="var(--c1)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_10px_var(--c1)]" />
                            
                            {pointsList.map((p, i) => (
                                <g key={i}>
                                    <line x1={p.x} y1="10" x2={p.x} y2={graphHeight + 10} stroke="currentColor" strokeDasharray="4 4" className="text-slate-800" strokeWidth="2" />
                                    <text x={Math.min(Math.max(p.x, 30), 970)} y={graphHeight + 35} fill="currentColor" textAnchor="middle" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.seasonName}</text>
                                    <circle cx={p.x} cy={p.y} r="6" fill="var(--c1)" stroke="white" strokeWidth="2" className="drop-shadow-[0_0_8px_var(--c1)]" />
                                    <text x={Math.min(Math.max(p.x, 20), 980)} y={p.y - 15} fill="white" textAnchor="middle" className="text-[10px] font-black drop-shadow-md">{Math.round(p.elo)}</text>
                                </g>
                            ))}
                        </svg>
                    </div>
                </section>

                <section className="flex flex-col items-center w-full">
                    <h2 className="text-xl font-black uppercase tracking-widest text-slate-100 mb-8 border-b border-slate-800 pb-3 w-full max-w-5xl text-center">Nuvarande Säsong <span style={{color: c1}}>({activeSeason?.name})</span></h2>
                    <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 w-full max-w-5xl overflow-hidden flex flex-col">
                        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                            <div className="p-10 flex flex-col items-center text-center hover:bg-slate-800/50 transition-colors">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Spelade (I Ligan)</span>
                                <span className="text-5xl font-black text-white">{currentSeasonLeagueMatches.length}</span>
                            </div>
                            <div className="p-10 flex flex-col items-center text-center hover:bg-slate-800/50 transition-colors">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Vinst / Förlust</span>
                                <span className="text-5xl font-black text-white">{csWins + csOtWins}<span className="text-2xl text-slate-700 mx-2">-</span>{csLosses + csOtLosses}</span>
                            </div>
                            <div className="p-10 flex flex-col items-center text-center hover:bg-slate-800/50 transition-colors">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Gjorda / Insläppta</span>
                                <span className="text-5xl font-black text-white">{csGoalsFor}<span className="text-2xl text-slate-700 mx-2">:</span>{csGoalsAgainst}</span>
                            </div>
                            <div className="p-10 flex flex-col items-center text-center transition-colors group relative overflow-hidden swirl-glow text-white">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/80 mb-2 relative z-10">Tabellpoäng</span>
                                <span className="text-6xl font-black relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">{csPoints}</span>
                            </div>
                        </div>
                        <div className="bg-slate-950/50 border-t border-slate-800 p-6 flex flex-col sm:flex-row items-center justify-center gap-6">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Senaste 10 (Form)</span>
                            <div className="flex gap-2 items-center">
                                {formArray.length > 0 
                                    ? formArray.map((f, i) => <FormIcon key={i} result={f} />) 
                                    : <span className="text-xs text-slate-600 font-bold uppercase tracking-widest">Inga matcher spelade än</span>}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="flex flex-col items-center w-full">
                    <h2 className="text-xl font-black uppercase tracking-widest text-slate-100 mb-8 border-b border-slate-800 pb-3 w-full text-center">Historisk Prestation (All-Time)</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
                        <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 p-10 flex flex-col items-center text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1" style={{backgroundColor: c1}}></div>
                            <span className="text-5xl mb-6 drop-shadow-md">⚔️</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Totalt Record</span>
                            <span className="text-3xl font-black text-white">{totalWins} V <span className="text-slate-700">-</span> {totalLosses} F</span>
                            <span className="text-[10px] font-black text-slate-400 mt-3 bg-slate-950 px-3 py-1 rounded-full">{allMatches.length > 0 ? Math.round((totalWins/allMatches.length)*100) : 0}% Win Rate</span>
                        </div>
                        <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 p-10 flex flex-col items-center text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 swirl-glow"></div>
                            <span className="text-5xl mb-6 drop-shadow-md">⚖️</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">P-Ratio (Gjorda/Insl)</span>
                            <span className="text-4xl font-black text-white drop-shadow-[0_0_10px_var(--c1)]">{allTimeRatio}</span>
                            <span className="text-[10px] font-black text-slate-400 mt-3 bg-slate-950 px-3 py-1 rounded-full">{totalGoalsFor} p gjorda totalt</span>
                        </div>
                        <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 p-10 flex flex-col items-center text-center border-b-4 border-b-green-500">
                            <span className="text-5xl mb-6 drop-shadow-md">🎯</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Favoritmotståndare</span>
                            <span className="text-2xl font-black text-white truncate w-full">{favorite.name}</span>
                            <span className="text-[10px] font-black text-green-500 mt-3 bg-slate-950 px-3 py-1 rounded-full">{Math.round(favorite.winRate)}% Win Rate</span>
                        </div>
                        <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 p-10 flex flex-col items-center text-center border-b-4 border-b-red-500">
                            <span className="text-5xl mb-6 drop-shadow-md">☠️</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Nemesis</span>
                            <span className="text-2xl font-black text-white truncate w-full">{nemesis.name}</span>
                            <span className="text-[10px] font-black text-red-500 mt-3 bg-slate-950 px-3 py-1 rounded-full">{Math.round(100 - nemesis.winRate)}% Loss Rate</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mt-8">
                        <div className="bg-slate-950/50 rounded-2xl border border-slate-800 p-8 flex items-center justify-between shadow-inner">
                            <div>
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Sudden Death Kungar</h3>
                                <p className="text-lg font-black text-slate-200">{sdPercentage}% Vinst i SD</p>
                            </div>
                            <span className="text-xs font-black text-slate-400 bg-slate-900 px-4 py-2 rounded-lg border border-slate-700">{sdWins}V - {sdLosses}F</span>
                        </div>
                        <div className="bg-slate-950/50 rounded-2xl border border-slate-800 p-8 flex items-center justify-between shadow-inner">
                            <div>
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Hemmafästning</h3>
                                <p className="text-lg font-black text-slate-200">{homeWins}V - {homeLosses}F</p>
                            </div>
                            <span className="text-xs font-black text-slate-400 bg-slate-900 px-4 py-2 rounded-lg border border-slate-700 uppercase tracking-widest">På Hemmaplan</span>
                        </div>
                    </div>
                </section>

                <section className="flex flex-col items-center w-full">
                    <h2 className="text-xl font-black uppercase tracking-widest text-slate-100 mb-8 border-b border-slate-800 pb-3 w-full text-center">Hall of Fame</h2>
                    {sortedTrophies.length === 0 ? (
                        <div className="w-full bg-slate-900 rounded-3xl shadow-2xl border border-dashed border-slate-700 p-20 flex flex-col items-center text-center">
                            <span className="text-7xl opacity-20 mb-6 grayscale">🏆</span>
                            <h3 className="text-xl font-black text-slate-500 uppercase tracking-widest">Prisskåpet ekar tomt</h3>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
                            {sortedTrophies.map(t => (
                                <div key={t.id} className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 p-10 flex flex-col items-center text-center hover:border-[var(--c1)] transition-colors duration-500 group relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--c1)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                    {t.imageUrl.includes('/') ? (
                                        <img src={t.imageUrl} alt={t.name} className="w-32 h-32 mb-8 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform duration-500 relative z-10" />
                                    ) : (
                                        <div className="text-7xl mb-8 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform duration-500 relative z-10">{t.imageUrl}</div>
                                    )}
                                    <h4 className="font-black text-lg text-white uppercase tracking-wider leading-tight mb-4 relative z-10">{t.name}</h4>
                                    <span className="text-[10px] font-black text-[var(--c1)] bg-[var(--c1)]/10 px-4 py-1.5 rounded-full border border-[var(--c1)]/30 uppercase tracking-widest relative z-10">{t.season?.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

            </div>
        </main>
    )
}