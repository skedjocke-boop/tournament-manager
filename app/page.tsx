import { Suspense } from "react";
import prisma from "@/lib/prisma";
import DashboardClient from "@/components/DashboardClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function calculateTeamStats(team: any, activeSeasonId: string) {
  let played = 0, wins = 0, otWins = 0, losses = 0, otLosses = 0;
  let goalsFor = 0, goalsAgainst = 0;

  // Hämtar alla historiska matcher
  const allCompletedMatches = [
    ...team.homeMatches.map((m: any) => ({ ...m, isHome: true, oppTeam: m.awayTeam })),
    ...team.awayMatches.map((m: any) => ({ ...m, isHome: false, oppTeam: m.homeTeam }))
  ].filter(m => m.status === 'COMPLETED' && m.homePoints !== null && m.awayPoints !== null && m.oppTeam?.name !== 'TBD');

  allCompletedMatches.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

  // Form ska sparas över säsonger (baseras på de absolut senaste matcherna oavsett säsong)
  const form: string[] = [];
  allCompletedMatches.forEach(match => {
    const teamPoints = match.isHome ? match.homePoints : match.awayPoints;
    const oppPoints = match.isHome ? match.awayPoints : match.homePoints;
    if (teamPoints > oppPoints) {
        if (match.isSuddenDeath) form.push('OTW'); else form.push('W');
    } else {
        if (match.isSuddenDeath) form.push('OTL'); else form.push('L');
    }
  });

  // FIX: LIGATABELLEN ska ENBART räkna poäng och matcher för den nuvarande aktiva säsongen
  const currentSeasonLeagueMatches = allCompletedMatches.filter(m => m.matchType === 'REGULAR' && m.seasonId === activeSeasonId);
  
  currentSeasonLeagueMatches.forEach(match => {
    played++;
    const teamPoints = match.isHome ? match.homePoints : match.awayPoints;
    const oppPoints = match.isHome ? match.awayPoints : match.homePoints;
    goalsFor += teamPoints;
    goalsAgainst += oppPoints;
    if (teamPoints > oppPoints) {
        if (match.isSuddenDeath) otWins++; else wins++;
    } else {
        if (match.isSuddenDeath) otLosses++; else losses++;
    }
  });

  const points = (wins * 3) + (otWins * 2) + (otLosses * 1);
  const goalDifference = goalsFor - goalsAgainst;

  return { played, wins, otWins, losses, otLosses, goalsFor, goalsAgainst, goalDifference, points, cleanSheets: 0, form: form.slice(-5) };
}

export default async function Home() {
  const activeSeason = await prisma.season.findFirst({
    where: { isActive: true },
    include: {
      matches: {
        include: { homeTeam: true, awayTeam: true },
        orderBy: { createdAt: 'asc' } 
      }
    }
  });

  const teamsData = await prisma.team.findMany({
    orderBy: { name: 'asc' },
    include: {
      homeMatches: { where: { status: 'COMPLETED' }, include: { awayTeam: true, season: true } },
      awayMatches: { where: { status: 'COMPLETED' }, include: { homeTeam: true, season: true } },
      trophies: { include: { season: true } },
    }
  });

  const initialTeams = teamsData.map(team => {
    return { ...team, stats: calculateTeamStats(team, activeSeason?.id || '') };
  });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      <Suspense fallback={<div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest animate-pulse mt-20">Laddar The Ritual Room...</div>}>
        <DashboardClient initialTeams={initialTeams} initialMatches={activeSeason?.matches || []} activeSeason={activeSeason} />
      </Suspense>
    </main>
  );
}