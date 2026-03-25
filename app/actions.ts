'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

// --- HJÄLPARE: Hämta Grundseriens Tabell för Seeding ---
async function getStandings(seasonId: string) {
  const teamsData = await prisma.team.findMany({
    include: {
      homeMatches: { where: { status: 'COMPLETED', matchType: 'REGULAR', seasonId } },
      awayMatches: { where: { status: 'COMPLETED', matchType: 'REGULAR', seasonId } }
    }
  });

  const enrichedTeams = teamsData.map(team => {
    let points = 0, goalsFor = 0, goalsAgainst = 0;
    for (const m of [...team.homeMatches, ...team.awayMatches]) {
      const isHome = m.homeTeamId === team.id;
      const myScore = isHome ? m.homeScore! : m.awayScore!;
      const oppScore = isHome ? m.awayScore! : m.homeScore!;
      goalsFor += myScore; goalsAgainst += oppScore;
      if (myScore > oppScore) points += m.isOvertime ? 2 : 3;
      else points += m.isOvertime ? 1 : 0;
    }
    return { ...team, points, goalDifference: goalsFor - goalsAgainst, goalsFor };
  });

  const sortFn = (a: any, b: any) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  };

  return {
    hsl: enrichedTeams.filter(t => t.region === 'HSL').sort(sortFn),
    asl: enrichedTeams.filter(t => t.region === 'ASL').sort(sortFn),
    all: enrichedTeams.sort(sortFn)
  };
}

export async function generateSchedule() {
  const teams = await prisma.team.findMany();
  if (teams.length !== 28) throw new Error("Måste finnas exakt 28 lag.");

  let season = await prisma.season.findFirst({ where: { phase: 'PRE_SEASON' } });
  if (season) season = await prisma.season.update({ where: { id: season.id }, data: { phase: 'REGULAR_SEASON' } });
  else season = await prisma.season.create({ data: { name: 'Säsong 1', phase: 'REGULAR_SEASON' } });

  const existingMatches = await prisma.match.count({ where: { seasonId: season.id } });
  if (existingMatches > 0) return;

  const hslTeams = teams.filter(t => t.region === 'HSL');
  const aslTeams = teams.filter(t => t.region === 'ASL');

  const createLeagueSchedule = async (leagueTeams: typeof teams) => {
    const n = leagueTeams.length;
    const rounds = n - 1;
    let matchesData = [];

    for (let round = 0; round < rounds * 2; round++) {
      const isReturnMatch = round >= rounds;
      const actualRound = round % rounds;

      for (let i = 0; i < n / 2; i++) {
        const homeIdx = (actualRound + i) % (n - 1);
        let awayIdx = (n - 1 - i + actualRound) % (n - 1);
        if (i === 0) awayIdx = n - 1;

        let homeTeam = leagueTeams[homeIdx];
        let awayTeam = leagueTeams[awayIdx];

        if (isReturnMatch || (i === 0 && actualRound % 2 === 1)) {
          const temp = homeTeam; homeTeam = awayTeam; awayTeam = temp;
        }

        matchesData.push({
          seasonId: season!.id, homeTeamId: homeTeam.id, awayTeamId: awayTeam.id,
          round: round + 1, status: 'SCHEDULED', isOvertime: false, matchType: 'REGULAR'
        });
      }
    }
    return matchesData;
  };

  await prisma.match.createMany({ data: [...await createLeagueSchedule(hslTeams), ...await createLeagueSchedule(aslTeams)] });
  revalidatePath('/');
}

export async function saveMatchResult(matchId: string, homeScore: number, awayScore: number, isOvertime: boolean) {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true } });
  if (!match || match.status === 'COMPLETED') return;

  const K = 24;
  const homeWon = homeScore > awayScore;
  const expectedHome = 1 / (1 + Math.pow(10, (match.awayTeam.currentElo - match.homeTeam.currentElo) / 400));
  const expectedAway = 1 / (1 + Math.pow(10, (match.homeTeam.currentElo - match.awayTeam.currentElo) / 400));
  const actualHome = homeWon ? 1 : 0;
  const actualAway = homeWon ? 0 : 1;

  let homeEloChange = Math.round(K * (actualHome - expectedHome));
  let awayEloChange = Math.round(K * (actualAway - expectedAway));

  if (homeEloChange < 0 && match.homeTeam.currentElo + homeEloChange < 0) {
    homeEloChange = -match.homeTeam.currentElo; awayEloChange = Math.abs(homeEloChange);
  } else if (awayEloChange < 0 && match.awayTeam.currentElo + awayEloChange < 0) {
    awayEloChange = -match.awayTeam.currentElo; homeEloChange = Math.abs(awayEloChange);
  }

  await prisma.$transaction([
    prisma.match.update({ where: { id: matchId }, data: { status: 'COMPLETED', homeScore, awayScore, isOvertime } }),
    prisma.team.update({ where: { id: match.homeTeamId }, data: { currentElo: match.homeTeam.currentElo + homeEloChange } }),
    prisma.team.update({ where: { id: match.awayTeamId }, data: { currentElo: match.awayTeam.currentElo + awayEloChange } })
  ]);
  revalidatePath('/');
}

export async function initiatePlayoffs() {
  const season = await prisma.season.findFirst({ where: { phase: 'REGULAR_SEASON' } });
  if (!season) return;

  const standings = await getStandings(season.id);
  const playoffMatches: any[] = [];
  
  const createMatch = (home: any, away: any, matchType: string, playoffRound: string, gameNumber: number, roundNum: number) => {
    if(!home || !away) return;
    playoffMatches.push({ seasonId: season.id, homeTeamId: home.id, awayTeamId: away.id, status: 'SCHEDULED', matchType, playoffRound, gameNumber, round: roundNum, isOvertime: false });
  };

  createMatch(standings.hsl[0], standings.hsl[7], 'HSL_PLAYOFF', 'QF', 1, 1);
  createMatch(standings.hsl[3], standings.hsl[4], 'HSL_PLAYOFF', 'QF', 1, 1);
  createMatch(standings.hsl[2], standings.hsl[5], 'HSL_PLAYOFF', 'QF', 1, 1);
  createMatch(standings.hsl[1], standings.hsl[6], 'HSL_PLAYOFF', 'QF', 1, 1);
  createMatch(standings.asl[0], standings.asl[7], 'ASL_PLAYOFF', 'QF', 1, 1);
  createMatch(standings.asl[3], standings.asl[4], 'ASL_PLAYOFF', 'QF', 1, 1);
  createMatch(standings.asl[2], standings.asl[5], 'ASL_PLAYOFF', 'QF', 1, 1);
  createMatch(standings.asl[1], standings.asl[6], 'ASL_PLAYOFF', 'QF', 1, 1);

  createMatch(standings.hsl[0], standings.asl[3], 'CHAMPIONS_LEAGUE', 'QF', 1, 2);
  createMatch(standings.asl[1], standings.hsl[2], 'CHAMPIONS_LEAGUE', 'QF', 1, 2);
  createMatch(standings.asl[0], standings.hsl[3], 'CHAMPIONS_LEAGUE', 'QF', 1, 2);
  createMatch(standings.hsl[1], standings.asl[2], 'CHAMPIONS_LEAGUE', 'QF', 1, 2);

  createMatch(standings.hsl[7], standings.hsl[0], 'HSL_PLAYOFF', 'QF', 2, 3);
  createMatch(standings.hsl[4], standings.hsl[3], 'HSL_PLAYOFF', 'QF', 2, 3);
  createMatch(standings.hsl[5], standings.hsl[2], 'HSL_PLAYOFF', 'QF', 2, 3);
  createMatch(standings.hsl[6], standings.hsl[1], 'HSL_PLAYOFF', 'QF', 2, 3);
  createMatch(standings.asl[7], standings.asl[0], 'ASL_PLAYOFF', 'QF', 2, 3);
  createMatch(standings.asl[4], standings.asl[3], 'ASL_PLAYOFF', 'QF', 2, 3);
  createMatch(standings.asl[5], standings.asl[2], 'ASL_PLAYOFF', 'QF', 2, 3);
  createMatch(standings.asl[6], standings.asl[1], 'ASL_PLAYOFF', 'QF', 2, 3);

  createMatch(standings.asl[3], standings.hsl[0], 'CHAMPIONS_LEAGUE', 'QF', 2, 4);
  createMatch(standings.hsl[2], standings.asl[1], 'CHAMPIONS_LEAGUE', 'QF', 2, 4);
  createMatch(standings.hsl[3], standings.asl[0], 'CHAMPIONS_LEAGUE', 'QF', 2, 4);
  createMatch(standings.asl[2], standings.hsl[1], 'CHAMPIONS_LEAGUE', 'QF', 2, 4);

  await prisma.season.update({ where: { id: season.id }, data: { phase: 'PLAYOFFS' } });
  await prisma.match.createMany({ data: playoffMatches });
  revalidatePath('/');
}

export async function advancePlayoffs() {
  const season = await prisma.season.findFirst({ where: { phase: 'PLAYOFFS' } });
  if (!season) return;

  const playoffMatches = await prisma.match.findMany({ where: { seasonId: season.id, matchType: { not: 'REGULAR' } } });
  if (playoffMatches.filter(m => m.status === 'SCHEDULED').length > 0) return;

  let currentStage = 'QF';
  if (playoffMatches.some(m => m.playoffRound === 'FINAL')) currentStage = 'FINAL';
  else if (playoffMatches.some(m => m.playoffRound === 'SF')) currentStage = 'SF';

  const stageMatches = playoffMatches.filter(m => m.playoffRound === currentStage);
  
  const seriesMap = new Map();
  for (const m of stageMatches) {
    const pair = [m.homeTeamId, m.awayTeamId].sort().join('_');
    if (!seriesMap.has(pair)) seriesMap.set(pair, { matches: [], matchType: m.matchType });
    if (m.gameNumber === 1) { 
      seriesMap.get(pair).highSeedId = m.homeTeamId;
      seriesMap.get(pair).lowSeedId = m.awayTeamId;
    }
    seriesMap.get(pair).matches.push(m);
  }

  const needGame3Domestic: any[] = [];
  const needGame3CL: any[] = [];
  const winnersHSL: string[] = [];
  const winnersASL: string[] = [];
  const winnersCL: string[] = [];

  for (const data of seriesMap.values()) {
    let highWins = 0, lowWins = 0;
    for (const m of data.matches) {
      if (m.status === 'COMPLETED') {
        const winnerId = m.homeScore! > m.awayScore! ? m.homeTeamId : m.awayTeamId;
        if (winnerId === data.highSeedId) highWins++; else lowWins++;
      }
    }
    
    if (highWins === 2) {
      if (data.matchType === 'HSL_PLAYOFF') winnersHSL.push(data.highSeedId);
      else if (data.matchType === 'ASL_PLAYOFF') winnersASL.push(data.highSeedId);
      else winnersCL.push(data.highSeedId);
    } else if (lowWins === 2) {
      if (data.matchType === 'HSL_PLAYOFF') winnersHSL.push(data.lowSeedId);
      else if (data.matchType === 'ASL_PLAYOFF') winnersASL.push(data.lowSeedId);
      else winnersCL.push(data.lowSeedId);
    } else if (data.matches.length === 2) { 
      if (data.matchType === 'CHAMPIONS_LEAGUE') needGame3CL.push(data);
      else needGame3Domestic.push(data);
    }
  }

  let maxRound = Math.max(...playoffMatches.map(m => m.round));
  const newMatches: any[] = [];

  if (needGame3Domestic.length > 0 || needGame3CL.length > 0) {
    if (needGame3Domestic.length > 0) {
      maxRound++;
      needGame3Domestic.forEach(s => newMatches.push({ seasonId: season.id, homeTeamId: s.highSeedId, awayTeamId: s.lowSeedId, status: 'SCHEDULED', matchType: s.matchType, playoffRound: currentStage, gameNumber: 3, round: maxRound, isOvertime: false }));
    }
    if (needGame3CL.length > 0) {
      maxRound++;
      needGame3CL.forEach(s => newMatches.push({ seasonId: season.id, homeTeamId: s.highSeedId, awayTeamId: s.lowSeedId, status: 'SCHEDULED', matchType: s.matchType, playoffRound: currentStage, gameNumber: 3, round: maxRound, isOvertime: false }));
    }
    await prisma.match.createMany({ data: newMatches });
    revalidatePath('/');
    return;
  }

  if (currentStage === 'FINAL') {
    await prisma.season.update({ where: { id: season.id }, data: { phase: 'AWARDS' } });
    revalidatePath('/');
    return;
  }

  const standings = await getStandings(season.id);
  const getSortedWinners = (winnerIds: string[], leagueData: any[]) => {
    return winnerIds.map(id => leagueData.find(t => t.id === id)).sort((a, b) => leagueData.indexOf(a) - leagueData.indexOf(b));
  };

  const nextStage = currentStage === 'QF' ? 'SF' : 'FINAL';
  const hslNext = getSortedWinners(winnersHSL, standings.hsl);
  const aslNext = getSortedWinners(winnersASL, standings.asl);
  const clNext = getSortedWinners(winnersCL, standings.all);

  const domGame1Round = maxRound + 1;
  const clGame1Round = maxRound + 2;
  const domGame2Round = maxRound + 3;
  const clGame2Round = maxRound + 4;

  const createMatch = (high: any, low: any, type: string, gameNum: number, targetRound: number) => {
    if (!high || !low) return;
    newMatches.push({ seasonId: season.id, homeTeamId: gameNum === 1 ? high.id : low.id, awayTeamId: gameNum === 1 ? low.id : high.id, status: 'SCHEDULED', matchType: type, playoffRound: nextStage, gameNumber: gameNum, round: targetRound, isOvertime: false });
  };

  if (nextStage === 'SF') {
    createMatch(hslNext[0], hslNext[3], 'HSL_PLAYOFF', 1, domGame1Round);
    createMatch(hslNext[1], hslNext[2], 'HSL_PLAYOFF', 1, domGame1Round);
    createMatch(aslNext[0], aslNext[3], 'ASL_PLAYOFF', 1, domGame1Round);
    createMatch(aslNext[1], aslNext[2], 'ASL_PLAYOFF', 1, domGame1Round);
    createMatch(clNext[0], clNext[3], 'CHAMPIONS_LEAGUE', 1, clGame1Round);
    createMatch(clNext[1], clNext[2], 'CHAMPIONS_LEAGUE', 1, clGame1Round);

    createMatch(hslNext[0], hslNext[3], 'HSL_PLAYOFF', 2, domGame2Round);
    createMatch(hslNext[1], hslNext[2], 'HSL_PLAYOFF', 2, domGame2Round);
    createMatch(aslNext[0], aslNext[3], 'ASL_PLAYOFF', 2, domGame2Round);
    createMatch(aslNext[1], aslNext[2], 'ASL_PLAYOFF', 2, domGame2Round);
    createMatch(clNext[0], clNext[3], 'CHAMPIONS_LEAGUE', 2, clGame2Round);
    createMatch(clNext[1], clNext[2], 'CHAMPIONS_LEAGUE', 2, clGame2Round);

  } else if (nextStage === 'FINAL') {
    createMatch(hslNext[0], hslNext[1], 'HSL_PLAYOFF', 1, domGame1Round);
    createMatch(aslNext[0], aslNext[1], 'ASL_PLAYOFF', 1, domGame1Round);
    createMatch(clNext[0], clNext[1], 'CHAMPIONS_LEAGUE', 1, clGame1Round);

    createMatch(hslNext[0], hslNext[1], 'HSL_PLAYOFF', 2, domGame2Round);
    createMatch(aslNext[0], aslNext[1], 'ASL_PLAYOFF', 2, domGame2Round);
    createMatch(clNext[0], clNext[1], 'CHAMPIONS_LEAGUE', 2, clGame2Round);
  }

  await prisma.match.createMany({ data: newMatches });
  revalidatePath('/');
}

export async function distributeAwards() {
  const season = await prisma.season.findFirst({ where: { phase: 'AWARDS' }, include: { matches: true } });
  if (!season) return;

  const standings = await getStandings(season.id);
  const hslRegWinner = standings.hsl[0].id;
  const aslRegWinner = standings.asl[0].id;

  const finalMatches = season.matches.filter(m => m.playoffRound === 'FINAL' && m.status === 'COMPLETED');
  const getSeriesWinner = (type: string) => {
    const matches = finalMatches.filter(m => m.matchType === type);
    if(matches.length === 0) return null;
    let w1 = 0, w2 = 0;
    const team1 = matches[0].homeTeamId;
    const team2 = matches[0].awayTeamId;
    
    matches.forEach(m => {
      const winnerId = m.homeScore! > m.awayScore! ? m.homeTeamId : m.awayTeamId;
      if(winnerId === team1) w1++; else w2++;
    });
    return w1 === 2 ? team1 : (w2 === 2 ? team2 : null);
  };

  const hslPlayoffWinner = getSeriesWinner('HSL_PLAYOFF');
  const aslPlayoffWinner = getSeriesWinner('ASL_PLAYOFF');
  const clWinner = getSeriesWinner('CHAMPIONS_LEAGUE');

  const trophiesToCreate = [];

  trophiesToCreate.push({ seasonId: season.id, teamId: hslRegWinner, name: "HSL Grundserievinnare", type: "REGULAR_HSL", imagePath: "/prices/HSLtrophy1.png" });
  trophiesToCreate.push({ seasonId: season.id, teamId: aslRegWinner, name: "ASL Grundserievinnare", type: "REGULAR_ASL", imagePath: "/prices/ASLtrophy1.png" });

  if(hslPlayoffWinner) trophiesToCreate.push({ seasonId: season.id, teamId: hslPlayoffWinner, name: "HSL Slutspelsmästare", type: "PLAYOFF_HSL", imagePath: "/prices/HSLtrophy2.png" });
  if(aslPlayoffWinner) trophiesToCreate.push({ seasonId: season.id, teamId: aslPlayoffWinner, name: "ASL Slutspelsmästare", type: "PLAYOFF_ASL", imagePath: "/prices/ASLtrophy2.png" });
  if(clWinner) trophiesToCreate.push({ seasonId: season.id, teamId: clWinner, name: "Champions League Mästare", type: "CL", imagePath: "/prices/CLtrophy.png" });

  if (hslRegWinner === hslPlayoffWinner && hslPlayoffWinner === clWinner) {
    trophiesToCreate.push({ seasonId: season.id, teamId: hslRegWinner, name: "Tri-fecta Champion", type: "TRIFECTA", imagePath: "/prices/TRItrophy.png" });
  } else if (aslRegWinner === aslPlayoffWinner && aslPlayoffWinner === clWinner) {
    trophiesToCreate.push({ seasonId: season.id, teamId: aslRegWinner, name: "Tri-fecta Champion", type: "TRIFECTA", imagePath: "/prices/TRItrophy.png" });
  }

  const allTeams = await prisma.team.findMany();
  const eloSnapshots = allTeams.map(t => ({
    seasonId: season.id,
    teamId: t.id,
    finalElo: t.currentElo
  }));

  await prisma.$transaction([
    prisma.trophy.createMany({ data: trophiesToCreate }),
    prisma.seasonResult.createMany({ data: eloSnapshots }),
    prisma.season.update({ where: { id: season.id }, data: { phase: 'OFF_SEASON' } })
  ]);

  revalidatePath('/');
}

export async function startNextSeason() {
  const oldSeason = await prisma.season.findFirst({ where: { phase: 'OFF_SEASON' } });
  if (!oldSeason) return;

  const match = oldSeason.name.match(/\d+/);
  const nextNumber = match ? parseInt(match[0]) + 1 : 2;

  await prisma.$transaction([
    prisma.season.update({ where: { id: oldSeason.id }, data: { phase: 'ARCHIVED' } }),
    prisma.season.create({ data: { name: `Säsong ${nextNumber}`, phase: 'PRE_SEASON' } })
  ]);
  
  revalidatePath('/');
}

export async function updateTeamColors(teamId: string, primaryColor: string, secondaryColor: string) {
  await prisma.team.update({
    where: { id: teamId },
    data: { primaryColor, secondaryColor }
  });
  revalidatePath('/');
}

// NY FUNKTION: EXPORTERA HELA DATABASEN (BACKUP)
export async function exportDatabase() {
  const teams = await prisma.team.findMany({ include: { trophies: true, seasonResults: true } });
  const seasons = await prisma.season.findMany({ include: { matches: true } });
  
  const backupData = {
    timestamp: new Date().toISOString(),
    version: "1.0",
    data: { teams, seasons }
  };

  return JSON.stringify(backupData, null, 2);
}