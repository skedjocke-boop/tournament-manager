import { PrismaClient } from '@prisma/client';
// Antar att EloService ligger i en separat fil eller definieras här
import { EloService } from './elo.service'; 

export interface ResolveMatchDTO {
  matchId: string;
  homeScore: number;
  awayScore: number;
}

export class MatchService {
  private prisma: PrismaClient;
  private eloService: EloService;

  constructor(prismaClient: PrismaClient, eloService: EloService) {
    this.prisma = prismaClient;
    this.eloService = eloService;
  }
  
  async resolveMatch(payload: ResolveMatchDTO) {
    const { matchId, homeScore, awayScore } = payload;

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { homeTeam: true, awayTeam: true, series: true }
    });

    if (!match) throw new Error("Match hittades inte.");
    if (match.isLocked) throw new Error("Matchen är låst. Lagt kort ligger.");
    if (homeScore === awayScore) throw new Error("En match kan inte sluta oavgjort.");

    const homeWon = homeScore > awayScore;
    const matchWinnerId = homeWon ? match.homeTeamId : match.awayTeamId;

    try {
      await this.prisma.$transaction(async (tx) => {
        
        // 1. Lås matchen
        await tx.match.update({
          where: { id: matchId },
          data: {
            homeScore, awayScore, status: "COMPLETED", isLocked: true, playedAt: new Date()
          }
        });

        // 2. Elo och Säsongsstatistik (Hoppar över detaljerna här för att fokusera på Slutspelsträdet)
        // [Din tidigare logik för TeamSeasonStat, EloHistory och TeamRecord ligger kvar här...]

        // 3. THE BRACKET CONTROLLER (Endast om matchen tillhör ett slutspel)
        if (match.seriesId && match.series) {
          await this.handlePlayoffProgression(tx, match.series, matchWinnerId, match.seasonId, match.matchType);
        }
      });
      
      return { success: true, message: "Match registrerad." };
    } catch (error) {
      console.error("Transaction failed:", error);
      throw new Error("Kunde inte registrera matchen.");
    }
  }

  /**
   * Denna metod hanterar den komplexa kaskaden i slutspelsträdet.
   */
  private async handlePlayoffProgression(
    tx: any, 
    series: any, 
    matchWinnerId: string, 
    seasonId: string, 
    matchType: string
  ) {
    // 1. Vilket lag vann matchen i kontext av serien?
    const isTeamAWinner = matchWinnerId === series.teamAId;
    
    // 2. Uppdatera Seriens aggregerade win-count
    const updatedSeries = await tx.series.update({
      where: { id: series.id },
      data: {
        teamAWins: isTeamAWinner ? { increment: 1 } : undefined,
        teamBWins: !isTeamAWinner ? { increment: 1 } : undefined
      }
    });

    // 3. SCENARIO A: Blev serien exakt 1-1? (Båda lagen har vunnit en match)
    if (updatedSeries.teamAWins === 1 && updatedSeries.teamBWins === 1) {
      console.log(`Serien ${series.name} är 1-1. Genererar Match 3 (The Decider).`);
      await tx.match.create({
        data: {
          seasonId,
          seriesId: series.id,
          matchType,
          // Team A är alltid högst seedad i vår design, så de får hemmaplan i Match 3
          homeTeamId: series.teamAId, 
          awayTeamId: series.teamBId
        }
      });
      return; // Serien fortsätter, vi avbryter här.
    }

    // 4. SCENARIO B: Vann någon serien? (Någon har nått 2 vinster)
    if (updatedSeries.teamAWins === 2 || updatedSeries.teamBWins === 2) {
      const seriesWinnerId = updatedSeries.teamAWins === 2 ? series.teamAId : series.teamBId;
      console.log(`Serien ${series.name} är avgjord! Vinnare: ${seriesWinnerId}`);

      // Lås serien och utse vinnare
      await tx.series.update({
        where: { id: series.id },
        data: { winnerId: seriesWinnerId }
      });

      // 5. THE CASCADE: Skicka vinnaren vidare till nästa serie (om det inte är en final)
      if (series.nextSeriesId && series.nextSeriesSlot) {
        
        // Uppdatera nästa serie med vinnaren i rätt "slot"
        const nextSeriesData = series.nextSeriesSlot === "TEAM_A" 
          ? { teamAId: seriesWinnerId } 
          : { teamBId: seriesWinnerId };

        const nextSeries = await tx.series.update({
          where: { id: series.nextSeriesId },
          data: nextSeriesData
        });

        // 6. SCENARIO C: Blev nästa serie precis fulltalig? (Båda semifinallagen är nu klara)
        if (nextSeries.teamAId && nextSeries.teamBId) {
          console.log(`${nextSeries.name} är nu fulltalig! Genererar Match 1 & 2.`);
          
          await tx.match.createMany({
            data: [
              // M1: Högst seedad (Team A) har hemmaplan
              { seasonId, seriesId: nextSeries.id, matchType, homeTeamId: nextSeries.teamAId, awayTeamId: nextSeries.teamBId },
              // M2: Lägst seedad (Team B) har hemmaplan
              { seasonId, seriesId: nextSeries.id, matchType, homeTeamId: nextSeries.teamBId, awayTeamId: nextSeries.teamAId }
            ]
          });
        }
      }
    }
  }
}