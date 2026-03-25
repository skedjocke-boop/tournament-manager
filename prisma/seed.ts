import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ------------------------------------------------------------------
// DIN UPPGIFT: Fyll i dina 28 lag här.
// logoPath förutsätter att du döper filerna till t.ex. "team-alpha.png" 
// och senare lägger dem i mappen public/logos/
// ------------------------------------------------------------------
const teamsData = [
  // --- HSL (Horizon Super League) - 14 lag ---
  { name: "Aether", region: "HSL", logoPath: "/logos/Aether.png" },
  { name: "Apollo", region: "HSL", logoPath: "/logos/Apollo.png" },
  { name: "Artemis", region: "HSL", logoPath: "/logos/Artemis.png" },
  { name: "Chi", region: "HSL", logoPath: "/logos/Chi.png" },
  { name: "Demeter", region: "HSL", logoPath: "/logos/Demeter.png" },
  { name: "Eleuthia", region: "HSL", logoPath: "/logos/Eleuthia.png" },
  { name: "GAIA", region: "HSL", logoPath: "/logos/Gaia.png" },
  { name: "Gemini", region: "HSL", logoPath: "/logos/Gemini.png" },
  { name: "Hades", region: "HSL", logoPath: "/logos/Hades.png" },
  { name: "Hephaestus", region: "HSL", logoPath: "/logos/Hephaestus.png" },
  { name: "Minerva", region: "HSL", logoPath: "/logos/Minerva.png" },
  { name: "Poseidon", region: "HSL", logoPath: "/logos/Poseidon.png" },
  { name: "Sigma", region: "HSL", logoPath: "/logos/Sigma.png" },
  { name: "XI", region: "HSL", logoPath: "/logos/XI.png" },
  
  // --- ASL (Arctic Super League) - 14 lag ---
  { name: "Aegir", region: "ASL", logoPath: "/logos/Aegir.png" },
  { name: "Altair", region: "ASL", logoPath: "/logos/Altair.png" },
  { name: "Delling", region: "ASL", logoPath: "/logos/Delling.png" },
  { name: "Fenrir", region: "ASL", logoPath: "/logos/Fenrir.png" },
  { name: "Lundi", region: "ASL", logoPath: "/logos/Lundi.png" },
  { name: "Magni", region: "ASL", logoPath: "/logos/Magni.png" },
  { name: "Nomad", region: "ASL", logoPath: "/logos/Nomad.png" },
  { name: "NYSL", region: "ASL", logoPath: "/logos/NYSL.png" },
  { name: "Orca", region: "ASL", logoPath: "/logos/Orca.png" },
  { name: "Otr", region: "ASL", logoPath: "/logos/Otr.png" },
  { name: "Sven", region: "ASL", logoPath: "/logos/Sven.png" },
  { name: "Ursa", region: "ASL", logoPath: "/logos/Ursa.png" },
  { name: "Vili", region: "ASL", logoPath: "/logos/Vili.png" },
  { name: "Wolverine", region: "ASL", logoPath: "/logos/Wolverine.png" },
];

async function main() {
  console.log('Startar seeding av databas...')

  // 1. Skapa Lagen
  for (const team of teamsData) {
    await prisma.team.upsert({
      where: { name: team.name },
      update: {
        // HÄR ÄR FIXEN: Uppdatera loggan om laget redan finns!
        logoPath: team.logoPath
      },
      create: {
        name: team.name,
        region: team.region,
        logoPath: team.logoPath,
        // Standardfärg (mörkgrå) tills du ställer in färgerna via Team Management UI:t
        primaryColor: "#374151",   
      },
    })
  }
  console.log(`✔️ ${teamsData.length} lag inlagda/uppdaterade.`)

  // 2. Skapa Säsong 1
  // Vi anger ett ID för att skriptet ska vara "idempotent" (säkert att köra flera gånger)
  const season1 = await prisma.season.upsert({
    where: { id: "season-1" },
    update: {},
    create: {
      id: "season-1",
      name: "Säsong 1",
      phase: "PRE_SEASON"
    }
  })
  console.log(`✔️ ${season1.name} skapad/verifierad (Status: ${season1.phase}).`)

  console.log('====================================')
  console.log('🏆 SEEDING KLAR. DATABASEN ÄR REDO.')
  console.log('====================================')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })