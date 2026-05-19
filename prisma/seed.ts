import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const teams = [
    // --- ELITSERIEN ---
    { name: "Spain", currentElo: 1341, peakElo: 1341, division: "ELITSERIEN", primaryColor: "#AA151B", secondaryColor: "#F1BF00", tertiaryColor: "#8A1116", logoPath: "/logos/spain.png" },
    { name: "Georgia", currentElo: 1279, peakElo: 1279, division: "ELITSERIEN", primaryColor: "#FFFFFF", secondaryColor: "#FF0000", tertiaryColor: "#990000", logoPath: "/logos/georgia.png" },
    { name: "Croatia", currentElo: 1263, peakElo: 1263, division: "ELITSERIEN", primaryColor: "#FF0000", secondaryColor: "#FFFFFF", tertiaryColor: "#0051BA", logoPath: "/logos/croatia.png" },
    { name: "Portugal", currentElo: 1245, peakElo: 1245, division: "ELITSERIEN", primaryColor: "#FF0000", secondaryColor: "#006600", tertiaryColor: "#FFDF00", logoPath: "/logos/portugal.png" },
    { name: "Hungary", currentElo: 1242, peakElo: 1242, division: "ELITSERIEN", primaryColor: "#CE1126", secondaryColor: "#FFFFFF", tertiaryColor: "#008751", logoPath: "/logos/hungary.png" },
    { name: "Argentina", currentElo: 1239, peakElo: 1239, division: "ELITSERIEN", primaryColor: "#75AADB", secondaryColor: "#FFFFFF", tertiaryColor: "#FCBF49", logoPath: "/logos/argentina.png" },
    { name: "Morocco", currentElo: 1236, peakElo: 1236, division: "ELITSERIEN", primaryColor: "#C1272D", secondaryColor: "#006233", tertiaryColor: "#801A1E", logoPath: "/logos/morocco.png" },
    { name: "South Africa", currentElo: 1236, peakElo: 1236, division: "ELITSERIEN", primaryColor: "#007749", secondaryColor: "#FFC627", tertiaryColor: "#E03C31", logoPath: "/logos/south-africa.png" },
    { name: "United Kingdom", currentElo: 1217, peakElo: 1217, division: "ELITSERIEN", primaryColor: "#012169", secondaryColor: "#C8102E", tertiaryColor: "#FFFFFF", logoPath: "/logos/united-kingdom.png" },
    { name: "Jamaica", currentElo: 1215, peakElo: 1215, division: "ELITSERIEN", primaryColor: "#009B3A", secondaryColor: "#FED100", tertiaryColor: "#000000", logoPath: "/logos/jamaica.png" },
    { name: "New Zealand", currentElo: 1214, peakElo: 1214, division: "ELITSERIEN", primaryColor: "#00247D", secondaryColor: "#CC142B", tertiaryColor: "#FFFFFF", logoPath: "/logos/new-zealand.png" },
    { name: "India", currentElo: 1211, peakElo: 1211, division: "ELITSERIEN", primaryColor: "#FF9933", secondaryColor: "#FFFFFF", tertiaryColor: "#138808", logoPath: "/logos/india.png" },
    { name: "Canada", currentElo: 1206, peakElo: 1206, division: "ELITSERIEN", primaryColor: "#FF0000", secondaryColor: "#FFFFFF", tertiaryColor: "#CC0000", logoPath: "/logos/canada.png" },
    { name: "Norway", currentElo: 1204, peakElo: 1204, division: "ELITSERIEN", primaryColor: "#BA0C2F", secondaryColor: "#00205B", tertiaryColor: "#FFFFFF", logoPath: "/logos/norway.png" },

    // --- SUPERETTAN ---
    { name: "Singapore", currentElo: 1194, peakElo: 1194, division: "SUPERETTAN", primaryColor: "#ED2939", secondaryColor: "#FFFFFF", tertiaryColor: "#CC2331", logoPath: "/logos/singapore.png" },
    { name: "Egypt", currentElo: 1192, peakElo: 1192, division: "SUPERETTAN", primaryColor: "#CE1126", secondaryColor: "#FFFFFF", tertiaryColor: "#000000", logoPath: "/logos/egypt.png" },
    { name: "Sweden", currentElo: 1184, peakElo: 1184, division: "SUPERETTAN", primaryColor: "#004B87", secondaryColor: "#FFCD00", tertiaryColor: "#00335D", logoPath: "/logos/sweden.png" },
    { name: "Albania", currentElo: 1183, peakElo: 1183, division: "SUPERETTAN", primaryColor: "#FF0000", secondaryColor: "#000000", tertiaryColor: "#CC0000", logoPath: "/logos/albania.png" },
    { name: "Germany", currentElo: 1180, peakElo: 1180, division: "SUPERETTAN", primaryColor: "#000000", secondaryColor: "#FF0000", tertiaryColor: "#FFCC00", logoPath: "/logos/germany.png" },
    { name: "Brazil", currentElo: 1175, peakElo: 1175, division: "SUPERETTAN", primaryColor: "#009B3A", secondaryColor: "#FEDF00", tertiaryColor: "#002776", logoPath: "/logos/brazil.png" },
    { name: "Nepal", currentElo: 1168, peakElo: 1168, division: "SUPERETTAN", primaryColor: "#DC143C", secondaryColor: "#003893", tertiaryColor: "#FFFFFF", logoPath: "/logos/nepal.png" },
    { name: "China", currentElo: 1165, peakElo: 1165, division: "SUPERETTAN", primaryColor: "#EE1C25", secondaryColor: "#FFFF00", tertiaryColor: "#C8102E", logoPath: "/logos/china.png" },
    { name: "Russia", currentElo: 1156, peakElo: 1156, division: "SUPERETTAN", primaryColor: "#FFFFFF", secondaryColor: "#0033A0", tertiaryColor: "#DA291C", logoPath: "/logos/russia.png" },
    { name: "Kenya", currentElo: 1154, peakElo: 1154, division: "SUPERETTAN", primaryColor: "#000000", secondaryColor: "#BB0000", tertiaryColor: "#006600", logoPath: "/logos/kenya.png" },
    { name: "Japan", currentElo: 1148, peakElo: 1148, division: "SUPERETTAN", primaryColor: "#FFFFFF", secondaryColor: "#BC002D", tertiaryColor: "#990024", logoPath: "/logos/japan.png" },
    { name: "Australia", currentElo: 1125, peakElo: 1125, division: "SUPERETTAN", primaryColor: "#00008B", secondaryColor: "#FF0000", tertiaryColor: "#FFFFFF", logoPath: "/logos/australia.png" },
    { name: "USA", currentElo: 1114, peakElo: 1114, division: "SUPERETTAN", primaryColor: "#3C3B6E", secondaryColor: "#B22234", tertiaryColor: "#FFFFFF", logoPath: "/logos/usa.png" },
    { name: "South Korea", currentElo: 1114, peakElo: 1114, division: "SUPERETTAN", primaryColor: "#FFFFFF", secondaryColor: "#CD2E3A", tertiaryColor: "#0F64CD", logoPath: "/logos/south-korea.png" }
  ]

  for (const t of teams) {
    await prisma.team.upsert({
      where: { name: t.name },
      update: {
          currentElo: t.currentElo,
          peakElo: t.peakElo,
          division: t.division,
          primaryColor: t.primaryColor,
          secondaryColor: t.secondaryColor,
          tertiaryColor: t.tertiaryColor,
          logoPath: t.logoPath
      },
      create: {
        name: t.name,
        currentElo: t.currentElo,
        peakElo: t.peakElo,
        division: t.division,
        primaryColor: t.primaryColor,
        secondaryColor: t.secondaryColor,
        tertiaryColor: t.tertiaryColor,
        logoPath: t.logoPath
      }
    })
  }

  const existingSeason = await prisma.season.findFirst({ where: { isActive: true } });
  if (!existingSeason) {
      await prisma.season.create({ data: { name: "Säsong 1", phase: "PRE_SEASON", isActive: true } });
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); })