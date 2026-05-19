'use client'

import Link from 'next/link'

type DeepStats = {
  played: number;
  wins: number;
  otWins: number;
  losses: number;
  otLosses: number;
  goalsFor: number;
  goalsAgainst: number;
  winRate: string;
  seasonResults: any[];
}

type Team = {
  id: string;
  name: string;
  division: string;
  currentElo: number;
  primaryColor: string;
}

export default function TeamProfileClient({ team, deepStats }: { team: Team, deepStats: DeepStats }) {
  
  return (
    <div className="max-w-4xl mx-auto p-6 mt-10 bg-white rounded-xl shadow-lg">
      <Link href="/" className="text-blue-500 hover:underline mb-6 inline-block font-medium">
        ← Tillbaka till Dashboard
      </Link>
      
      <div className="flex justify-between items-start mb-8 border-b pb-6 border-gray-100">
        <div>
          <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight">{team.name}</h1>
          <div className="mt-4 flex gap-3">
             <span className="bg-slate-800 text-white font-bold px-4 py-1.5 rounded-full shadow-sm">
               Elo: {Math.round(team.currentElo)}
             </span>
             <span className={`font-bold px-4 py-1.5 rounded-full shadow-sm ${
                 team.division === 'ELITSERIEN' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
               }`}>
                 {team.division}
             </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col items-center justify-center">
          <div className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-1">Spelade</div>
          <div className="text-3xl font-black text-gray-800">{deepStats.played}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex flex-col items-center justify-center">
          <div className="text-green-600 text-xs uppercase font-bold tracking-wider mb-1">Win Rate</div>
          <div className="text-3xl font-black text-green-700">{deepStats.winRate}%</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col items-center justify-center col-span-2 md:col-span-2">
           <div className="text-blue-600 text-xs uppercase font-bold tracking-wider mb-1">Bordspoäng (Gjorda - Insläppta)</div>
           <div className="text-3xl font-black text-blue-800">{deepStats.goalsFor} - {deepStats.goalsAgainst}</div>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-2">Matchhistorik</h2>
      {deepStats.seasonResults.length === 0 ? (
        <div className="text-center p-8 bg-gray-50 rounded-xl border border-gray-100">
           <p className="text-gray-500 font-medium">Laget har inte spelat några matcher än denna säsong.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deepStats.seasonResults.map(match => {
            const isWin = match.result === 'W' || match.result === 'OTW';
            const isLoss = match.result === 'L' || match.result === 'OTL';
            
            return (
              <div key={match.id} className={`p-4 rounded-xl border flex justify-between items-center transition-all hover:shadow-md ${isWin ? 'bg-white border-green-200' : 'bg-white border-red-200'}`}>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wider">{new Date(match.date).toLocaleDateString()}</span>
                  <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${match.isHome ? 'bg-gray-100 text-gray-600' : 'bg-gray-800 text-white'}`}>
                          {match.isHome ? 'H' : 'B'}
                      </span>
                      <span className="font-bold text-gray-800">{match.opponent}</span>
                  </div>
                  {(match.result === 'OTW' || match.result === 'OTL') && 
                      <span className="text-xs font-bold text-purple-600 mt-1 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-purple-600 inline-block"></span> Sudden Death
                      </span>
                  }
                </div>
                <div className="flex flex-col items-end">
                    <div className={`text-2xl font-black ${isWin ? 'text-green-600' : 'text-red-600'}`}>
                      {match.teamScore} - {match.oppScore}
                    </div>
                    <span className={`text-xs font-bold uppercase ${isWin ? 'text-green-500' : 'text-red-500'}`}>
                        {match.result}
                    </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}