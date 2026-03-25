import { prisma } from '@/lib/prisma';
import DashboardClient from '@/components/DashboardClient';

// FIXEN: Tvingar Next.js att rendera sidan live vid varje sidladdning, 
// istället för att försöka bygga den statiskt under Docker build-fasen.
export const dynamic = 'force-dynamic';

export default async function HQ() {
  const teamsData = await prisma.team.findMany({
    orderBy: { name: 'asc' },
    include: {
      homeMatches: { where: { status: 'COMPLETED' } },
      awayMatches: { where: { status: 'COMPLETED' } },
      trophies: { include: { season: true } }
    }
  });

  const activeSeason = await prisma.season.findFirst({
    where: { phase: { not: 'ARCHIVED' } },
    orderBy: { createdAt: 'desc' },
    include: {
      matches: {
        include: { homeTeam: true, awayTeam: true },
        orderBy: [{ round: 'asc' }, { gameNumber: 'asc' }]
      }
    }
  });

  const enrichedTeams = teamsData.map(team => {
    const regularMatches = [...team.homeMatches, ...team.awayMatches]
      .filter(m => m.matchType === 'REGULAR' && m.seasonId === activeSeason?.id)
      .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

    let points = 0, wins = 0, otWins = 0, losses = 0, otLosses = 0, goalsFor = 0, goalsAgainst = 0, cleanSheets = 0;
    let form: ('W' | 'L' | 'OTW' | 'OTL')[] = [];

    for (const match of regularMatches) {
      const isHome = match.homeTeamId === team.id;
      const myScore = isHome ? match.homeScore! : match.awayScore!;
      const oppScore = isHome ? match.awayScore! : match.homeScore!;
      const isOvertime = match.isOvertime;

      goalsFor += myScore;
      goalsAgainst += oppScore;
      if (oppScore === 0) cleanSheets++;

      if (myScore > oppScore) {
        if (isOvertime) { otWins++; points += 2; form.push('OTW'); } 
        else { wins++; points += 3; form.push('W'); }
      } else {
        if (isOvertime) { otLosses++; points += 1; form.push('OTL'); } 
        else { losses++; points += 0; form.push('L'); }
      }
    }

    return {
      ...team,
      stats: { played: wins + otWins + losses + otLosses, wins, otWins, losses, otLosses, goalsFor, goalsAgainst, goalDifference: goalsFor - goalsAgainst, points, form: form.slice(-5), cleanSheets }
    };
  });

  const seasonMatches = activeSeason?.matches || [];
  const currentPhase = activeSeason?.phase || 'PRE_SEASON';
  const currentSeasonName = activeSeason?.name || 'Säsong 1';

  return <DashboardClient initialTeams={enrichedTeams} matches={seasonMatches} seasonPhase={currentPhase} seasonName={currentSeasonName} />;
}