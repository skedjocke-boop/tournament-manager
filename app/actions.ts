'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'

export async function getDashboardData() {
  const currentSeason = await prisma.season.findFirst({ where: { isActive: true } })
  if (!currentSeason) return { matches: [] }
  const allMatches = await prisma.match.findMany({
    where: { seasonId: currentSeason.id },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { createdAt: 'asc' } 
  })
  return { season: currentSeason, matches: allMatches }
}

export async function updateTeamIdentity(teamId: string, primaryColor: string, logoPath: string) {
    await prisma.team.update({
        where: { id: teamId },
        data: { primaryColor, logoPath: logoPath.trim() !== '' ? logoPath : null }
    });
    revalidatePath('/');
    revalidatePath(`/teams/${teamId}`);
    return { success: true };
}

async function checkAndAdvanceTournament(match: any, seasonId: string) {
    if (match.matchType !== 'CL' && match.matchType !== 'PLAYOFF' && match.matchType !== 'QUALIFIER' && match.matchType !== 'BOTTOM_BATTLE') return;

    const legs = await prisma.match.findMany({ where: { seasonId, matchType: match.matchType, playoffRound: match.playoffRound, round: match.round } });
    let teamA = legs[0].homeTeamId;
    let teamB = legs[0].awayTeamId;
    if (teamA === 'TBD' || teamB === 'TBD') teamA = legs[0].homeTeamId !== 'TBD' ? legs[0].homeTeamId : legs[0].awayTeamId;

    const isBestOf5 = match.matchType === 'PLAYOFF' || match.matchType === 'QUALIFIER' || match.matchType === 'BOTTOM_BATTLE' || (match.matchType === 'CL' && match.playoffRound === 'FINAL');
    let winnerId = null;
    let isSeriesFinished = false;

    if (isBestOf5) {
        let winsA = 0, winsB = 0;
        legs.filter(l => l.status === 'COMPLETED').forEach(l => {
            const aWon = l.homeTeamId === teamA ? l.homePoints! > l.awayPoints! : l.awayPoints! > l.homePoints!;
            if (aWon) winsA++; else winsB++;
        });

        if (winsA >= 3 || winsB >= 3) {
            winnerId = winsA >= 3 ? teamA : teamB;
            isSeriesFinished = true;
            await prisma.match.updateMany({
                where: { seasonId, matchType: match.matchType, playoffRound: match.playoffRound, round: match.round, status: 'SCHEDULED' },
                data: { status: 'CANCELLED' }
            });
        }
    } else {
        const allCompleted = legs.every(m => m.status === 'COMPLETED');
        if (allCompleted) {
            isSeriesFinished = true;
            let aPoints = 0, bPoints = 0;
            legs.forEach(l => {
                if (l.homeTeamId === teamA) { aPoints += (l.homePoints || 0); bPoints += (l.awayPoints || 0); }
                else { aPoints += (l.awayPoints || 0); bPoints += (l.homePoints || 0); }
            });
            if (bPoints > aPoints) winnerId = teamB;
            else if (bPoints === aPoints) {
                const lastLeg = legs.sort((a,b) => (b.gameNumber || 0) - (a.gameNumber || 0))[0];
                if (lastLeg.isSuddenDeath) winnerId = lastLeg.homePoints! > lastLeg.awayPoints! ? lastLeg.homeTeamId : lastLeg.awayTeamId;
                else winnerId = teamA; 
            } else winnerId = teamA;
        }
    }

    if (isSeriesFinished && winnerId && (match.matchType === 'CL' || match.matchType === 'PLAYOFF')) {
        const tournamentRounds = match.matchType === 'CL' ? ['RO32', 'RO16', 'QF', 'SF', 'FINAL'] : ['QF', 'SF', 'FINAL'];
        const currentIndex = tournamentRounds.indexOf(match.playoffRound!);
        if (currentIndex === -1 || currentIndex === tournamentRounds.length - 1) return; 

        const nextRound = tournamentRounds[currentIndex + 1];
        const nextSlot = Math.ceil(match.round / 2);
        const isTeamAInNextSlot = match.round % 2 !== 0; 

        const nextMatches = await prisma.match.findMany({ where: { seasonId, matchType: match.matchType, playoffRound: nextRound, round: nextSlot } });

        if (nextMatches.length > 0) {
            const tbdTeam = await prisma.team.findFirst({ where: { name: 'TBD' } });
            
            const leg1 = nextMatches.find(m => m.gameNumber === 1) || nextMatches[0];
            let baseTeamA = leg1.homeTeamId;
            let baseTeamB = leg1.awayTeamId;

            if (isTeamAInNextSlot) baseTeamA = winnerId;
            else baseTeamB = winnerId;

            if (baseTeamA !== tbdTeam?.id && baseTeamB !== tbdTeam?.id) {
                const t1 = await prisma.team.findUnique({where:{id:baseTeamA}});
                const t2 = await prisma.team.findUnique({where:{id:baseTeamB}});
                if (t1 && t2 && t1.currentElo < t2.currentElo) { 
                    const temp = baseTeamA; baseTeamA = baseTeamB; baseTeamB = temp; 
                }
            }

            for (const m of nextMatches) {
                let finalHome = baseTeamA;
                let finalAway = baseTeamB;
                
                const isBestOf5Next = match.matchType === 'PLAYOFF' || (match.matchType === 'CL' && nextRound === 'FINAL');
                if (isBestOf5Next) {
                    if (m.gameNumber === 3 || m.gameNumber === 4) { finalHome = baseTeamB; finalAway = baseTeamA; }
                } else {
                    if ((m.gameNumber || 1) % 2 === 0) { finalHome = baseTeamB; finalAway = baseTeamA; }
                }

                await prisma.match.update({ where: { id: m.id }, data: { homeTeamId: finalHome, awayTeamId: finalAway } });
            }
        }
    }
}

export async function saveMatch(matchId: string, homePoints: number, awayPoints: number, isSuddenDeath: boolean) {
  if (homePoints === awayPoints) throw new Error("En match kan inte sluta oavgjort. Ge Sudden Death poängen till vinnaren.");

  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true } })
  if (!match || match.status === 'COMPLETED' || match.status === 'CANCELLED') throw new Error("Match hittades inte eller är redan avklarad")

  const K = 32
  const homeExpected = 1 / (1 + Math.pow(10, (match.awayTeam.currentElo - match.homeTeam.currentElo) / 400))
  const awayExpected = 1 / (1 + Math.pow(10, (match.homeTeam.currentElo - match.awayTeam.currentElo) / 400))

  const homeWon = homePoints > awayPoints
  const homeActual = homeWon ? 1 : 0
  const awayActual = homeWon ? 0 : 1
  const margin = Math.abs(homePoints - awayPoints)
  const marginMultiplier = isSuddenDeath ? 1 : Math.max(1, Math.log10(margin + 1))

  const newHomeElo = Math.round(match.homeTeam.currentElo + K * marginMultiplier * (homeActual - homeExpected))
  const newAwayElo = Math.round(match.awayTeam.currentElo + K * marginMultiplier * (awayActual - awayExpected))

  const updatedMatch = await prisma.$transaction(async (tx) => {
    const updated = await tx.match.update({ where: { id: matchId }, data: { homePoints, awayPoints, isSuddenDeath, status: 'COMPLETED' } });
    
    if (match.homeTeam.name !== 'TBD') {
        const homePeak = Math.max(match.homeTeam.peakElo || 1200, newHomeElo);
        await tx.team.update({ where: { id: match.homeTeamId }, data: { currentElo: newHomeElo, peakElo: homePeak } });
        await tx.eloHistory.create({ data: { teamId: match.homeTeamId, matchId: match.id, elo: newHomeElo }});
    }
    
    if (match.awayTeam.name !== 'TBD') {
        const awayPeak = Math.max(match.awayTeam.peakElo || 1200, newAwayElo);
        await tx.team.update({ where: { id: match.awayTeamId }, data: { currentElo: newAwayElo, peakElo: awayPeak } });
        await tx.eloHistory.create({ data: { teamId: match.awayTeamId, matchId: match.id, elo: newAwayElo }});
    }
    return updated;
  });

  await checkAndAdvanceTournament(updatedMatch, updatedMatch.seasonId);
  revalidatePath('/')
  return { success: true }
}

export async function updateSeasonPhase(seasonId: string, newPhase: string) {
  await prisma.season.update({ where: { id: seasonId }, data: { phase: newPhase } })
  revalidatePath('/')
}

async function getCalculatedTables(seasonId: string) {
    const allTeams = await prisma.team.findMany({ 
        where: { isActive: true, name: { not: 'TBD' } },
        include: { homeMatches: { where: { seasonId, matchType: 'REGULAR', status: 'COMPLETED' } }, awayMatches: { where: { seasonId, matchType: 'REGULAR', status: 'COMPLETED' } } }
    });

    const calculatedTeams = allTeams.map(t => {
        let wins = 0, otWins = 0, losses = 0, otLosses = 0, goalsFor = 0, goalsAgainst = 0;
        const matches = [...t.homeMatches.map(m=>({...m, isHome:true})), ...t.awayMatches.map(m=>({...m, isHome:false}))];
        matches.forEach(m => {
            const teamPoints = m.isHome ? m.homePoints! : m.awayPoints!;
            const oppPoints = m.isHome ? m.awayPoints! : m.homePoints!;
            goalsFor += teamPoints; goalsAgainst += oppPoints;
            if (teamPoints > oppPoints) { if (m.isSuddenDeath) otWins++; else wins++; } else { if (m.isSuddenDeath) otLosses++; else losses++; }
        });
        const points = (wins * 3) + (otWins * 2) + (otLosses * 1);
        return { ...t, stats: { points, goalDifference: goalsFor - goalsAgainst, goalsFor } };
    });

    const sortFn = (a:any, b:any) => {
        if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points;
        if (b.stats.goalDifference !== a.stats.goalDifference) return b.stats.goalDifference - a.stats.goalDifference;
        if (b.stats.goalsFor !== a.stats.goalsFor) return b.stats.goalsFor - a.stats.goalsFor;
        return b.currentElo - a.currentElo;
    };

    return { elit: calculatedTeams.filter(t => t.division === 'ELITSERIEN').sort(sortFn), superettan: calculatedTeams.filter(t => t.division === 'SUPERETTAN').sort(sortFn) };
}

function getBo5WinnerAndLoser(matches: any[]) {
    let teamA = matches[0].homeTeamId, teamB = matches[0].awayTeamId;
    let winsA = 0, winsB = 0;
    matches.filter(m => m.status === 'COMPLETED').forEach(m => {
        const aWon = m.homeTeamId === teamA ? m.homePoints! > m.awayPoints! : m.awayPoints! > m.homePoints!;
        if (aWon) winsA++; else winsB++;
    });
    if (winsA >= 3) return { winner: teamA, loser: teamB };
    if (winsB >= 3) return { winner: teamB, loser: teamA };
    return null;
}

export async function triggerAwardCeremony(seasonId: string) {
    const existingTrophies = await prisma.trophy.count({ where: { seasonId }});
    if (existingTrophies > 0) throw new Error("Priser har redan delats ut för denna säsong.");

    const { elit, superettan } = await getCalculatedTables(seasonId);
    if (!elit[0] || !superettan[0]) throw new Error("Kunde inte kalkylera tabellen.");

    const trophiesToCreate: any[] = [];
    const elitserienWinnerId = elit[0].id;

    const playoffFinals = await prisma.match.findMany({ where: { seasonId, matchType: 'PLAYOFF', playoffRound: 'FINAL' }});
    const playoffResult = getBo5WinnerAndLoser(playoffFinals);
    const playoffWinnerId = playoffResult?.winner;

    const clFinals = await prisma.match.findMany({ where: { seasonId, matchType: 'CL', playoffRound: 'FINAL' }});
    const clResult = getBo5WinnerAndLoser(clFinals);
    const clWinnerId = clResult?.winner;

    // --- RÄTTA POKAL-NAMN ---
    if (elitserienWinnerId === playoffWinnerId && playoffWinnerId === clWinnerId) {
        trophiesToCreate.push({ seasonId, teamId: elitserienWinnerId, name: 'THE TRI-FECTA', imageUrl: '/prices/TRItrophy.png' });
    }

    if (clWinnerId) {
        trophiesToCreate.push({ seasonId, teamId: clWinnerId, name: 'Champions League Vinnare', imageUrl: '/prices/CLtrophy.png' });
    }

    if (playoffWinnerId) {
        trophiesToCreate.push({ seasonId, teamId: playoffWinnerId, name: 'Världsmästare', imageUrl: '/prices/WCtrophy.png' });
    }

    trophiesToCreate.push({ seasonId, teamId: elitserienWinnerId, name: 'Vinnare Elitserien', imageUrl: '/prices/elitserien.png' });
    trophiesToCreate.push({ seasonId, teamId: superettan[0].id, name: 'Vinnare Superettan', imageUrl: '/prices/superettan.png' });

    const bottenFinals = await prisma.match.findMany({ where: { seasonId, matchType: 'BOTTOM_BATTLE' }});
    const bottenResult = getBo5WinnerAndLoser(bottenFinals);
    if (bottenResult?.loser) {
        trophiesToCreate.push({ seasonId, teamId: bottenResult.loser, name: 'Sämst', imageUrl: '/prices/looser.png' });
    }

    await prisma.trophy.createMany({ data: trophiesToCreate });
    await prisma.season.update({ where: { id: seasonId }, data: { phase: 'OFF_SEASON' }});
    revalidatePath('/');
    return { success: true };
}

export async function startNextSeason(oldSeasonId: string) {
    const { elit, superettan } = await getCalculatedTables(oldSeasonId);

    const relegatedDirect = elit[13].id; 
    const promotedDirect = superettan[0].id; 

    const kval1Matches = await prisma.match.findMany({ where: { seasonId: oldSeasonId, matchType: 'QUALIFIER', playoffRound: 'KVAL_1' }});
    const kval1Res = getBo5WinnerAndLoser(kval1Matches);
    const kval2Matches = await prisma.match.findMany({ where: { seasonId: oldSeasonId, matchType: 'QUALIFIER', playoffRound: 'KVAL_2' }});
    const kval2Res = getBo5WinnerAndLoser(kval2Matches);

    await prisma.$transaction(async (tx) => {
        await tx.team.update({ where: { id: relegatedDirect }, data: { division: 'SUPERETTAN' }});
        await tx.team.update({ where: { id: promotedDirect }, data: { division: 'ELITSERIEN' }});
        if (kval1Res) {
            await tx.team.update({ where: { id: kval1Res.winner }, data: { division: 'ELITSERIEN' }});
            await tx.team.update({ where: { id: kval1Res.loser }, data: { division: 'SUPERETTAN' }});
        }
        if (kval2Res) {
            await tx.team.update({ where: { id: kval2Res.winner }, data: { division: 'ELITSERIEN' }});
            await tx.team.update({ where: { id: kval2Res.loser }, data: { division: 'SUPERETTAN' }});
        }

        const oldSeason = await tx.season.update({ where: { id: oldSeasonId }, data: { isActive: false }});
        const nextSeasonNumber = parseInt(oldSeason.name.replace('Säsong ', '')) + 1 || 99;
        await tx.season.create({ data: { name: `Säsong ${nextSeasonNumber}`, startDate: new Date(), isActive: true, phase: 'PRE_SEASON' }});
    });

    revalidatePath('/');
    return { success: true };
}

function createBo5Matches(tA_id: string, tB_id: string, seasonId: string, matchType: string, playoffRound: string, roundSlot: number) {
    const matches = [];
    for (let i = 1; i <= 5; i++) {
        const isTeamAHome = i === 1 || i === 2 || i === 5;
        matches.push({ seasonId, round: roundSlot, matchType, playoffRound, gameNumber: i, homeTeamId: isTeamAHome ? tA_id : tB_id, awayTeamId: isTeamAHome ? tB_id : tA_id, status: 'SCHEDULED' });
    }
    return matches;
}

export async function initiatePlayoffs(seasonId: string) {
    const existingPlayoff = await prisma.match.count({ where: { seasonId, matchType: 'PLAYOFF' } });
    if (existingPlayoff > 0) throw new Error("Slutspelet är redan initierat.");

    const { elit, superettan } = await getCalculatedTables(seasonId);
    if (elit.length < 14 || superettan.length < 14) throw new Error("För få lag för att generera ett komplett slutspel.");

    let tbdTeam = await prisma.team.findFirst({ where: { name: 'TBD' } });
    let matchesToCreate: any[] = [];
    
    const elitMatchups = [ [0, 7], [3, 4], [2, 5], [1, 6] ]; 
    for (let slot = 0; slot < 4; slot++) {
        const tA = elit[elitMatchups[slot][0]]; 
        const tB = elit[elitMatchups[slot][1]];
        matchesToCreate.push(...createBo5Matches(tA.id, tB.id, seasonId, 'PLAYOFF', 'QF', slot + 1));
    }

    const tbdRounds = [ { round: 'SF', slots: 2 }, { round: 'FINAL', slots: 1 } ];
    tbdRounds.forEach(r => { for(let s=1; s<=r.slots; s++){ matchesToCreate.push(...createBo5Matches(tbdTeam!.id, tbdTeam!.id, seasonId, 'PLAYOFF', r.round, s)); } });

    matchesToCreate.push(...createBo5Matches(superettan[1].id, elit[12].id, seasonId, 'QUALIFIER', 'KVAL_1', 1));
    matchesToCreate.push(...createBo5Matches(superettan[2].id, elit[11].id, seasonId, 'QUALIFIER', 'KVAL_2', 2));
    matchesToCreate.push(...createBo5Matches(superettan[12].id, superettan[13].id, seasonId, 'BOTTOM_BATTLE', 'BOTTENSTRID', 1));

    await prisma.match.createMany({ data: matchesToCreate });
    await prisma.season.update({ where: { id: seasonId }, data: { phase: 'PLAYOFFS' } });

    revalidatePath('/');
    return { success: true };
}

export async function generateRegularSeasonSchedule(seasonId: string) {
  const season = await prisma.season.findUnique({ where: { id: seasonId } })
  if (!season) throw new Error("Säsong hittades inte")

  const existingMatches = await prisma.match.count({ where: { seasonId, matchType: 'REGULAR' } })
  if (existingMatches > 0) throw new Error("Spelschema finns redan skapat.")

  const allTeams = await prisma.team.findMany({ where: { isActive: true } });
  
  let tbdTeam = await prisma.team.findUnique({ where: { name: 'TBD' } });
  if (!tbdTeam) { tbdTeam = await prisma.team.create({ data: { name: 'TBD', division: 'NONE', currentElo: 0, peakElo: 0, isActive: false, primaryColor: '#f8fafc' } }); }

  const elitserien = allTeams.filter(t => t.division === 'ELITSERIEN' && t.name !== 'TBD');
  const superettan = allTeams.filter(t => t.division === 'SUPERETTAN' && t.name !== 'TBD');
  let matchesToCreate: any[] = []
  
  const generateDivisionSchedule = (teams: any[]) => {
      const divisionTeams = [...teams];
      if (divisionTeams.length % 2 !== 0) divisionTeams.push({ id: 'BYE_REGULAR', name: 'BYE' } as any);

      const numTeams = divisionTeams.length
      const numRounds = numTeams - 1
      const halfSize = numTeams / 2

      for (let round = 0; round < numRounds; round++) {
        for (let i = 0; i < halfSize; i++) {
          const home = divisionTeams[i]
          const away = divisionTeams[numTeams - 1 - i]
          if (home.id !== 'BYE_REGULAR' && away.id !== 'BYE_REGULAR') {
            matchesToCreate.push({ homeTeamId: home.id, awayTeamId: away.id, seasonId: season.id, round: round + 1, matchType: 'REGULAR', status: 'SCHEDULED' })
            matchesToCreate.push({ homeTeamId: away.id, awayTeamId: home.id, seasonId: season.id, round: round + 1 + numRounds, matchType: 'REGULAR', status: 'SCHEDULED' })
          }
        }
        divisionTeams.splice(1, 0, divisionTeams.pop() as any)
      }
  };
  generateDivisionSchedule(elitserien);
  generateDivisionSchedule(superettan);

  const clTeams = allTeams.filter(t => t.isActive && t.name !== 'TBD');
  const shuffledClTeams = clTeams.sort(() => Math.random() - 0.5); 

  let clTeamIndex = 0;
  const numByes = 32 - clTeams.length; 
  const byeSlots: number[] = [];
  if (numByes > 0) {
      const step = 16 / numByes;
      for (let i = 0; i < numByes; i++) { byeSlots.push(Math.floor(i * step) + 1); }
  }

  const ro32Matches: any[] = []; 
  
  for (let slot = 1; slot <= 16; slot++) {
      let tA, tB;
      if (byeSlots.includes(slot) && clTeamIndex < shuffledClTeams.length) {
          tA = shuffledClTeams[clTeamIndex++]; tB = tbdTeam; 
          ro32Matches.push({ seasonId: season.id, round: slot, matchType: 'CL', playoffRound: 'RO32', gameNumber: 1, homeTeamId: tA.id, awayTeamId: tB.id, status: 'COMPLETED', homePoints: 1, awayPoints: 0, isSuddenDeath: false });
          ro32Matches.push({ seasonId: season.id, round: slot, matchType: 'CL', playoffRound: 'RO32', gameNumber: 2, homeTeamId: tB.id, awayTeamId: tA.id, status: 'COMPLETED', homePoints: 0, awayPoints: 1, isSuddenDeath: false });
      } else if (clTeamIndex < shuffledClTeams.length - 1) {
          tA = shuffledClTeams[clTeamIndex++]; tB = shuffledClTeams[clTeamIndex++];
          let home1 = tA, away1 = tB;
          if (tA.currentElo > tB.currentElo) { home1 = tB; away1 = tA; } 
          ro32Matches.push({ seasonId: season.id, round: slot, matchType: 'CL', playoffRound: 'RO32', gameNumber: 1, homeTeamId: home1.id, awayTeamId: away1.id, status: 'SCHEDULED' });
          ro32Matches.push({ seasonId: season.id, round: slot, matchType: 'CL', playoffRound: 'RO32', gameNumber: 2, homeTeamId: away1.id, awayTeamId: home1.id, status: 'SCHEDULED' });
      }
  }
  
  const futureMatches: any[] = []; 
  [ { round: 'RO16', slots: 8, games: 2 }, { round: 'QF', slots: 4, games: 2 }, { round: 'SF', slots: 2, games: 2 } ].forEach(r => {
      for(let s=1; s<=r.slots; s++){ for(let g=1; g<=r.games; g++){ futureMatches.push({ seasonId: season.id, round: s, matchType: 'CL', playoffRound: r.round, gameNumber: g, homeTeamId: tbdTeam!.id, awayTeamId: tbdTeam!.id, status: 'SCHEDULED' }); } }
  });
  for(let g=1; g<=5; g++){ futureMatches.push({ seasonId: season.id, round: 1, matchType: 'CL', playoffRound: 'FINAL', gameNumber: g, homeTeamId: tbdTeam!.id, awayTeamId: tbdTeam!.id, status: 'SCHEDULED' }); }

  await prisma.match.createMany({ data: [...matchesToCreate, ...ro32Matches, ...futureMatches] });

  const byeRecords = await prisma.match.findMany({ where: { seasonId: season.id, matchType: 'CL', playoffRound: 'RO32', awayTeamId: tbdTeam.id } });
  for (const bm of byeRecords) { await checkAndAdvanceTournament(bm, season.id); }

  await prisma.season.update({ where: { id: seasonId }, data: { phase: 'REGULAR_SEASON' } });
  revalidatePath('/');
  return { success: true, count: matchesToCreate.length }
}