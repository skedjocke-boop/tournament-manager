import { PrismaClient } from '@prisma/client';

export type SeasonPhase = "PRE_SEASON" | "REGULAR_SEASON" | "PLAYOFFS" | "COMPLETED";

export class SeasonService {
  private prisma: PrismaClient;

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
  }

  async advanceSeasonPhase(seasonId: string, expectedCurrentPhase: SeasonPhase, newPhase: SeasonPhase) {
    const season = await this.prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) throw new Error("Säsongen hittades inte.");
    if (season.phase !== expectedCurrentPhase) {
      throw new Error(`Felaktig fas. Förväntade ${expectedCurrentPhase} men säsongen är i ${season.phase}.`);
    }

    if (newPhase === "REGULAR_SEASON") {
      // Ny fasövergång: Generera hela spelschemat när vi lämnar Pre-Season
      await this.generateRegularSeasonSchedule(seasonId);
    }
    else if (newPhase === "PLAYOFFS") {
      await this.generatePlayoffBracket(seasonId);
    } 
    else if (newPhase === "COMPLETED") {
      await this.finalizeSeason(seasonId);
    }

    await this.prisma.season.update({
      where: { id: seasonId },
      data: { phase: newPhase }
    });

    return { success: true, message: `Säsongen har övergått till ${newPhase}.` };
  }

  async calculateStandings(seasonId: string, region: "HSL" | "ASL") {
    const stats = await this.prisma.teamSeasonStat.findMany({
      where: { seasonId: seasonId, team: { region: region } },
      include: { team: true }
    });

    const standings = stats.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const diffA = a.goalsFor - a.goalsAgainst;
      const diffB = b.goalsFor - b.goalsAgainst;
      if (diffB !== diffA) return diffB - diffA;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      if (b.team.currentElo !== a.team.currentElo) return b.team.currentElo - a.team.currentElo;
      return a.team.name.localeCompare(b.team.name);
    });

    return standings.map((stat, index) => ({
      rank: index + 1,
      teamId: stat.team.id,
      teamName: stat.team.name,
      points: stat.points,
      goalDifference: stat.goalsFor - stat.goalsAgainst,
      goalsFor: stat.goalsFor,
      elo: stat.team.currentElo
    }));
  }

  /**
   * Genererar spelschema via randomiserad Circle Method (Round Robin x2)
   */
  private async generateRegularSeasonSchedule(seasonId: string) {
    console.log("Genererar spelschema för grundserien...");

    const generateForRegion = async (region: string) => {
      // 1. Hämta alla lag för regionen
      const teams = await this.prisma.team.findMany({ where: { region } });
      if (teams.length !== 14) throw new Error(`Måste finnas exakt 14 lag i ${region}. Hittade ${teams.length}.`);

      // 2. Fisher-Yates Shuffle (Skapar det unika schemat varje säsong)
      const shuffledTeams = [...teams];
      for (let i = shuffledTeams.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledTeams[i], shuffledTeams[j]] = [shuffledTeams[j], shuffledTeams[i]];
      }

      const numTeams = shuffledTeams.length;
      const rounds = numTeams - 1; // 13 omgångar för halva serien
      const matchesPerRound = numTeams / 2;
      const allMatchesData = [];

      // 3. Circle Method - Halvlek 1 (Omgång 1-13)
      for (let round = 0; round < rounds; round++) {
        for (let match = 0; match < matchesPerRound; match++) {
          const home = (round + match) % (numTeams - 1);
          let away = (numTeams - 1 - match + round) % (numTeams - 1);
          
          if (match === 0) {
            away = numTeams - 1; // Det sista laget är "låst" i mitten av cirkeln
          }

          // Varannan omgång byter det låsta laget hemma/borta för att jämna ut fördelen
          const homeTeam = match === 0 && round % 2 === 1 ? shuffledTeams[away] : shuffledTeams[home];
          const awayTeam = match === 0 && round % 2 === 1 ? shuffledTeams[home] : shuffledTeams[away];

          allMatchesData.push({
            seasonId,
            matchType: "REGULAR",
            roundNumber: round + 1,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
          });
        }
      }

      // 4. Halvlek 2 (Omgång 14-26) - Spegelvänd hemma/borta
      const secondHalf = allMatchesData.map(m => ({
        ...m,
        roundNumber: m.roundNumber + 13,
        homeTeamId: m.awayTeamId,
        awayTeamId: m.homeTeamId
      }));

      // Skicka in alla 182 matcher (per region) i databasen
      await this.prisma.match.createMany({ data: [...allMatchesData, ...secondHalf] });
    };

    await this.prisma.$transaction(async () => {
      await generateForRegion("HSL");
      await generateForRegion("ASL");
    });

    console.log("Spelschema genererat (26 omgångar, 364 matcher)!");
  }

  private async generatePlayoffBracket(seasonId: string) {
    console.log("Genererar slutspelsträd...");
    
    const hslStandings = await this.calculateStandings(seasonId, "HSL");
    const aslStandings = await this.calculateStandings(seasonId, "ASL");
    
    // Top 8 för regionala
    const hsl = hslStandings.slice(0, 8);
    const asl = aslStandings.slice(0, 8);

    // Top 4 för CL
    const clHsl = hslStandings.slice(0, 4);
    const clAsl = aslStandings.slice(0, 4);

    await this.prisma.$transaction(async (tx) => {
      
      // --- HJÄLPMETOD: Skapar Serie och ev. Matcher (Alternativ C) ---
      const createSeries = async (
        matchType: string, name: string, round: number, 
        nextId: string | null = null, nextSlot: string | null = null, 
        teamAId: string | null = null, teamBId: string | null = null
      ) => {
        const series = await tx.series.create({
          data: {
            seasonId, matchType, name, round,
            nextSeriesId: nextId, nextSeriesSlot: nextSlot,
            teamAId, teamBId
          }
        });

        // Om vi vet lagen (Kvartsfinal), skapa M1 och M2 direkt (Alternativ C)
        if (teamAId && teamBId) {
          await tx.match.createMany({
            data: [
              // M1: Högst seedad (Team A) har hemmaplan
              { seasonId, seriesId: series.id, matchType, homeTeamId: teamAId, awayTeamId: teamBId },
              // M2: Lägst seedad (Team B) har hemmaplan
              { seasonId, seriesId: series.id, matchType, homeTeamId: teamBId, awayTeamId: teamAId }
            ]
          });
        }
        return series;
      };

      // --- 1. CHAMPIONS LEAGUE (Baklänges) ---
      const clFinal = await createSeries("CHAMPIONS_LEAGUE", "CL Final", 3);
      
      const clSemi1 = await createSeries("CHAMPIONS_LEAGUE", "CL Semifinal 1", 2, clFinal.id, "TEAM_A");
      const clSemi2 = await createSeries("CHAMPIONS_LEAGUE", "CL Semifinal 2", 2, clFinal.id, "TEAM_B");

      // CL Kvartsfinaler: HSL 1 vs ASL 4, HSL 4 vs ASL 1, osv.
      await createSeries("CHAMPIONS_LEAGUE", "CL Kvartsfinal 1", 1, clSemi1.id, "TEAM_A", clHsl[0].teamId, clAsl[3].teamId);
      await createSeries("CHAMPIONS_LEAGUE", "CL Kvartsfinal 2", 1, clSemi1.id, "TEAM_B", clHsl[3].teamId, clAsl[0].teamId);
      await createSeries("CHAMPIONS_LEAGUE", "CL Kvartsfinal 3", 1, clSemi2.id, "TEAM_A", clHsl[2].teamId, clAsl[1].teamId);
      await createSeries("CHAMPIONS_LEAGUE", "CL Kvartsfinal 4", 1, clSemi2.id, "TEAM_B", clHsl[1].teamId, clAsl[2].teamId);

      // --- 2. HSL PLAYOFFS ---
      const hslFinal = await createSeries("PLAYOFF_HSL", "HSL Final", 3);
      
      const hslSemi1 = await createSeries("PLAYOFF_HSL", "HSL Semifinal 1", 2, hslFinal.id, "TEAM_A");
      const hslSemi2 = await createSeries("PLAYOFF_HSL", "HSL Semifinal 2", 2, hslFinal.id, "TEAM_B");

      await createSeries("PLAYOFF_HSL", "HSL Kvartsfinal 1", 1, hslSemi1.id, "TEAM_A", hsl[0].teamId, hsl[7].teamId);
      await createSeries("PLAYOFF_HSL", "HSL Kvartsfinal 2", 1, hslSemi1.id, "TEAM_B", hsl[3].teamId, hsl[4].teamId);
      await createSeries("PLAYOFF_HSL", "HSL Kvartsfinal 3", 1, hslSemi2.id, "TEAM_A", hsl[2].teamId, hsl[5].teamId);
      await createSeries("PLAYOFF_HSL", "HSL Kvartsfinal 4", 1, hslSemi2.id, "TEAM_B", hsl[1].teamId, hsl[6].teamId);

      // --- 3. ASL PLAYOFFS ---
      const aslFinal = await createSeries("PLAYOFF_ASL", "ASL Final", 3);
      
      const aslSemi1 = await createSeries("PLAYOFF_ASL", "ASL Semifinal 1", 2, aslFinal.id, "TEAM_A");
      const aslSemi2 = await createSeries("PLAYOFF_ASL", "ASL Semifinal 2", 2, aslFinal.id, "TEAM_B");

      await createSeries("PLAYOFF_ASL", "ASL Kvartsfinal 1", 1, aslSemi1.id, "TEAM_A", asl[0].teamId, asl[7].teamId);
      await createSeries("PLAYOFF_ASL", "ASL Kvartsfinal 2", 1, aslSemi1.id, "TEAM_B", asl[3].teamId, asl[4].teamId);
      await createSeries("PLAYOFF_ASL", "ASL Kvartsfinal 3", 1, aslSemi2.id, "TEAM_A", asl[2].teamId, asl[5].teamId);
      await createSeries("PLAYOFF_ASL", "ASL Kvartsfinal 4", 1, aslSemi2.id, "TEAM_B", asl[1].teamId, asl[6].teamId);

    });

    console.log("Slutspelsträd framgångsrikt genererat!");
  }

  private async finalizeSeason(seasonId: string) {
    console.log("Avslutar säsong, tar snapshots av Elo...");
    // Logik för snapshot och achievements
  }
}