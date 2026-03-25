import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import TeamProfileClient from '@/components/TeamProfileClient';

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const teamId = resolvedParams.id;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      homeMatches: { where: { status: 'COMPLETED' }, include: { homeTeam: true, awayTeam: true, season: true }, orderBy: { updatedAt: 'asc' } },
      awayMatches: { where: { status: 'COMPLETED' }, include: { homeTeam: true, awayTeam: true, season: true }, orderBy: { updatedAt: 'asc' } },
      trophies: { include: { season: true } }, // Inkluderar säsongsnamnet
      seasonResults: { include: { season: true }, orderBy: { season: { createdAt: 'asc' } } }
    }
  });

  if (!team) notFound();

  const activeSeason = await prisma.season.findFirst({ where: { phase: { not: 'ARCHIVED' } }, orderBy: { createdAt: 'desc' } });
  const allMatches = [...team.homeMatches, ...team.awayMatches].sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
  const currentSeasonMatches = allMatches.filter(m => m.seasonId === activeSeason?.id);

  // Hjälpfunktion för att räkna stats (Används för både All-Time och Current Season)
  const calcStats = (matchesToCalc: typeof allMatches) => {
    let biggestWin = { margin: 0, match: null as any };
    let biggestLoss = { margin: 0, match: null as any };
    let currentWinStreak = 0; let maxWinStreak = 0; let cleanSheets = 0;
    let goalsFor = 0; let goalsAgainst = 0;
    const opponentStats: Record<string, { name: string; wins: number; losses: number; matches: number }> = {};

    matchesToCalc.forEach((match) => {
      const isHome = match.homeTeamId === team.id;
      const myScore = isHome ? match.homeScore! : match.awayScore!;
      const oppScore = isHome ? match.awayScore! : match.homeScore!;
      const opponent = isHome ? match.awayTeam : match.homeTeam;

      goalsFor += myScore;
      goalsAgainst += oppScore;

      if (!opponentStats[opponent.id]) opponentStats[opponent.id] = { name: opponent.name, wins: 0, losses: 0, matches: 0 };
      opponentStats[opponent.id].matches++;

      const margin = Math.abs(myScore - oppScore);
      const won = myScore > oppScore;

      if (won) {
        opponentStats[opponent.id].wins++; currentWinStreak++;
        if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
        if (margin > biggestWin.margin) biggestWin = { margin, match: { opponent: opponent.name, score: `${myScore}-${oppScore}` } };
      } else {
        opponentStats[opponent.id].losses++; currentWinStreak = 0;
        if (margin > biggestLoss.margin) biggestLoss = { margin, match: { opponent: opponent.name, score: `${myScore}-${oppScore}` } };
      }
      if (oppScore === 0) cleanSheets++;
    });

    let favoriteOpponent = { name: 'N/A', wins: 0 };
    Object.values(opponentStats).forEach(opp => {
      if (opp.wins > favoriteOpponent.wins) favoriteOpponent = { name: opp.name, wins: opp.wins };
    });

    return { biggestWin: biggestWin.match, biggestLoss: biggestLoss.match, maxWinStreak, cleanSheets, goalsFor, goalsAgainst, favoriteOpponent };
  };

  const allTimeStats = calcStats(allMatches);
  const currentSeasonStats = calcStats(currentSeasonMatches);

  // -- THE HERITAGE CHART DATA (Säsong för Säsong) --
  const heritageData = [{ seasonName: 'Start', elo: 1000 }];
  team.seasonResults.forEach(sr => {
    heritageData.push({ seasonName: sr.season.name, elo: sr.finalElo });
  });
  if (activeSeason) {
    heritageData.push({ seasonName: `${activeSeason.name} (Live)`, elo: team.currentElo });
  }

  // Denna säsongs formkurva
  const recentForm = currentSeasonMatches.slice(-5).map(m => {
    const isHome = m.homeTeamId === team.id;
    const won = isHome ? m.homeScore! > m.awayScore! : m.awayScore! > m.homeScore!;
    return { opponent: isHome ? m.awayTeam.name : m.homeTeam.name, result: won ? 'W' : 'L' };
  });

  const deepStats = {
    allTime: { ...allTimeStats, totalMatches: allMatches.length },
    currentSeason: { ...currentSeasonStats, totalMatches: currentSeasonMatches.length },
    heritageData, recentForm, activeSeasonName: activeSeason?.name || 'Säsong 1'
  };

  return <TeamProfileClient team={team} deepStats={deepStats} />;
}