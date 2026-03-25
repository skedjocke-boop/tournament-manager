import React, { useState } from 'react';

// Datan vi får från databasen
interface MatchProps {
  matchId: string;
  homeTeam: { name: string; logoUrl: string; color: string };
  awayTeam: { name: string; logoUrl: string; color: string };
  initialStatus: "SCHEDULED" | "COMPLETED";
  initialHomeScore: number | null;
  initialAwayScore: number | null;
  initialIsOvertime: boolean;
}

export default function MatchCard({ 
  matchId, homeTeam, awayTeam, initialStatus, initialHomeScore, initialAwayScore, initialIsOvertime 
}: MatchProps) {
  
  const [isLocked, setIsLocked] = useState(initialStatus === "COMPLETED");
  
  const [homeScore, setHomeScore] = useState<number>(initialHomeScore || 0);
  const [awayScore, setAwayScore] = useState<number>(initialAwayScore || 0);
  const [isOT, setIsOT] = useState<boolean>(initialIsOvertime || false);

  // --- DERIVERAD STATE (Den smarta logiken) ---
  const isTie = homeScore === awayScore;
  const isOneGoalDiff = Math.abs(homeScore - awayScore) === 1;
  const canSave = !isTie && homeScore >= 0 && awayScore >= 0;

  const handleGoldenGoal = (winner: "HOME" | "AWAY") => {
    if (winner === "HOME") setHomeScore(prev => prev + 1);
    if (winner === "AWAY") setAwayScore(prev => prev + 1);
    setIsOT(true);
  };

  const handleSave = async () => {
    if (!canSave) return;
    
    // Här anropar vi servern
    // await saveMatchResult(matchId, homeScore, awayScore, isOT);
    
    setIsLocked(true);
  };

  // ==========================================
  // LÄGE 1: "MATCH RESULTAT-BRICKAN" (Låst)
  // ==========================================
  if (isLocked) {
    const homeWon = homeScore > awayScore;
    return (
      <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg shadow-lg border border-gray-800 relative overflow-hidden">
        {/* En subtil färgindikator för vinnaren på kanten */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${homeWon ? 'bg-green-500' : 'bg-red-500'}`} />
        
        <div className="flex items-center space-x-4 w-1/3 pl-2">
          <img src={homeTeam.logoUrl} alt={homeTeam.name} className="w-12 h-12 object-contain" />
          <span className={`font-bold text-lg ${homeWon ? 'text-white' : 'text-gray-400'}`}>{homeTeam.name}</span>
        </div>

        <div className="flex flex-col items-center justify-center w-1/3">
          <div className="text-3xl font-black text-white tracking-widest flex items-center space-x-3">
            <span className={homeWon ? 'text-white' : 'text-gray-500'}>{homeScore}</span>
            <span className="text-gray-600 text-xl">-</span>
            <span className={!homeWon ? 'text-white' : 'text-gray-500'}>{awayScore}</span>
          </div>
          {isOT && <span className="text-[10px] text-yellow-500 font-bold tracking-widest mt-1 uppercase bg-yellow-500/10 px-2 py-0.5 rounded">Golden Goal</span>}
        </div>

        <div className="flex items-center justify-end space-x-4 w-1/3">
          <span className={`font-bold text-lg ${!homeWon ? 'text-white' : 'text-gray-400'}`}>{awayTeam.name}</span>
          <img src={awayTeam.logoUrl} alt={awayTeam.name} className="w-12 h-12 object-contain" />
        </div>
      </div>
    );
  }

  // ==========================================
  // LÄGE 2: "INMATNINGS-LÄGET" (Edit Mode)
  // ==========================================
  return (
    <div className="flex flex-col p-4 bg-gray-800 rounded-lg shadow-md border border-gray-700 transition-all duration-300">
      
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-4 w-1/3">
          <img src={homeTeam.logoUrl} className="w-10 h-10 opacity-80 object-contain" />
          <span className="font-semibold text-gray-300">{homeTeam.name}</span>
        </div>

        <div className="flex items-center justify-center space-x-3 w-1/3">
          <input 
            type="number" min="0" 
            value={homeScore} 
            onChange={(e) => { setHomeScore(Number(e.target.value)); setIsOT(false); }}
            className="w-16 text-center text-2xl font-bold bg-gray-900 text-white rounded p-2 focus:ring-2 focus:ring-blue-500 border border-gray-700 outline-none"
          />
          <span className="text-gray-500 font-bold">-</span>
          <input 
            type="number" min="0" 
            value={awayScore} 
            onChange={(e) => { setAwayScore(Number(e.target.value)); setIsOT(false); }}
            className="w-16 text-center text-2xl font-bold bg-gray-900 text-white rounded p-2 focus:ring-2 focus:ring-blue-500 border border-gray-700 outline-none"
          />
        </div>

        <div className="flex items-center justify-end space-x-4 w-1/3">
          <span className="font-semibold text-gray-300">{awayTeam.name}</span>
          <img src={awayTeam.logoUrl} className="w-10 h-10 opacity-80 object-contain" />
        </div>
      </div>

      {/* SMART UI: Flöde 2 (När användaren matar in ex. 2-2) */}
      {isTie && (
        <div className="bg-gray-900/50 rounded p-3 mb-4 mt-2 border border-yellow-500/20 flex flex-col items-center animate-fade-in">
          <span className="text-sm text-yellow-500 font-semibold mb-2">Oavgjort vid full tid. Vem gjorde Golden Goal?</span>
          <div className="flex space-x-4">
            <button onClick={() => handleGoldenGoal("HOME")} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded border border-gray-600 transition-colors">
              +1 {homeTeam.name}
            </button>
            <button onClick={() => handleGoldenGoal("AWAY")} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded border border-gray-600 transition-colors">
              +1 {awayTeam.name}
            </button>
          </div>
        </div>
      )}

      {/* SMART UI: Flöde 1 (När användaren matar in ex. 3-2 direkt) */}
      {isOneGoalDiff && !isTie && (
        <div className="flex justify-center mb-4 mt-2 animate-fade-in">
          <label className="flex items-center space-x-2 text-sm text-gray-400 cursor-pointer hover:text-white transition-colors bg-gray-900 px-4 py-2 rounded-full border border-gray-700">
            <input 
              type="checkbox" 
              checked={isOT} 
              onChange={(e) => setIsOT(e.target.checked)}
              className="rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500 w-4 h-4"
            />
            <span className={isOT ? "text-yellow-500 font-semibold" : ""}>Avgjordes i Golden Goal (OT)?</span>
          </label>
        </div>
      )}

      <button 
        onClick={handleSave}
        disabled={!canSave}
        className={`w-full py-3 font-bold rounded transition-all duration-200 shadow-lg mt-2
          ${canSave 
            ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer' 
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
      >
        {isTie ? "VÄNTAR PÅ AVGÖRANDE..." : "LÅS RESULTAT"}
      </button>

    </div>
  );
}