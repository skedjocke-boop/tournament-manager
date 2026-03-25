# Projektstruktur och Docker-infrastruktur

Denna fil definierar hur kodbasen ska organiseras på din MacBook innan vi bygger Docker-containern för servern.

## 1. Mappstruktur (Next.js App Router)

```text
/tournament-manager
├── /app                  # Next.js Frontend & API (App Router)
│   ├── /admin            # Ritual Room & Uploads & Team Management
│   ├── /playoffs         # Slutspelsträdet
│   ├── /teams            # Lagprofiler
│   ├── layout.tsx        # Global Sidebar/Navigation
│   └── page.tsx          # Global Dashboard (Live Reporting)
├── /components           # Återanvändbara React-komponenter
│   ├── MatchCard.tsx
│   ├── StandingsTable.tsx
│   └── TeamBadge.tsx     # (Hanterar ev. fallbacks för saknade loggor/färger)
├── /prisma               # Databas och Seeding
│   ├── schema.prisma
│   └── seed.ts           # <-- DITT STARTMANUSKRIPT
├── /public               # Statiska assets
│   └── /logos            # (Denna mapp monteras ut i en Docker Volume)
├── docker-compose.yml    # Infrastruktur-definition
└── Dockerfile            # Instruktioner för att bygga containern
```

---

## 2. Seeding-Skript (`/prisma/seed.ts`)

Detta skript körs automatiskt av Docker *endast* om databasen är helt tom.
Här fyller vi BARA i den mest grundläggande informationen. Färgkoderna hanterar vi dynamiskt i UI:t senare.

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Master-data: Endast det som krävs för att starta systemet.
// Logik för färger och uppladdning bygger vi in i "Team Management" i UI:t.
const teamsData = [
  // --- HSL (Horizon Super League) ---
  { name: "Team Alpha", region: "HSL", logoPath: "/logos/hsl-team-alpha.png" },
  { name: "Neon Knights", region: "HSL", logoPath: "/logos/hsl-neon-knights.png" },
  // ... (12 till)
  
  // --- ASL (Arctic Super League) ---
  { name: "Frostbite FC", region: "ASL", logoPath: "/logos/asl-frostbite-fc.png" },
  { name: "Glacier Guards", region: "ASL", logoPath: "/logos/asl-glacier-guards.png" },
  // ... (12 till)
]

async function main() {
  console.log('Startar seeding av databas...')

  // Skapa alla lag med neutrala fallback-färger tills administratören ställer in dem
  for (const team of teamsData) {
    await prisma.team.upsert({
      where: { name: team.name },
      update: {},
      create: {
        name: team.name,
        region: team.region,
        logoPath: team.logoPath, 
        // Vi sätter gråa standardfärger initialt
        primaryColor: "#374151",   // Tailwind gray-700
        secondaryColor: "#1F2937", // Tailwind gray-800
        tertiaryColor: "#111827",  // Tailwind gray-900
      },
    })
  }

  // Skapa "Season 1" som PRE_SEASON
  const season1 = await prisma.season.create({
    data: {
      name: "Säsong 1",
      phase: "PRE_SEASON"
    }
  })

  console.log('Seeding klar. Redo för The Ritual Room.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

---

## 3. Infrastruktur (`docker-compose.yml`)

Här definierar vi hur servern ska köra applikationen och skydda din data.

```yaml
version: '3.8'

services:
  tournament-app:
    build: .
    ports:
      - "3005:3000"
    volumes:
      # Volym 1: Skyddar SQLite-databasen från att raderas vid omstart
      - ./data:/app/prisma/data 
      # Volym 2: Skyddar uppladdade loggor och assets
      - ./uploads:/app/public/logos 
    environment:
      - NODE_ENV=production
      # Sökvägen inuti containern där databasen fysiskt sparas
      - DATABASE_URL="file:/app/prisma/data/prod.db" 
    restart: unless-stopped