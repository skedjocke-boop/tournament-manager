Frontend Architecture & Routing Plan (Next.js App Router)

Denna fil kartlägger hur din UI-vision översätts till en modern React/Next.js-struktur.

1. Global Layout (/app/layout.tsx)

Detta är "skalet" kring hela applikationen.

Navigation (App Shell): * För MacBook (Desktop): En fast, mörk och maffig Sidebar till vänster med ikoner för Dashboard, Teams, Playoffs, Ritual Room.

För S23 Ultra (Mobile): En fast Bottom Navigation Bar för enhandsbruk (tumvänligt).

Global Theming: Stöd för Dark Mode (vilket ofta får logotyper och neonfärger att "poppa" mycket bättre i sport-appar).

2. The Global Dashboard (/app/page.tsx)

Här landar du när du öppnar appen. Uppdelad för att separera ren överblick från administration.

Flik 1: Spectator View (Överblick)

Innehåll: Endast aktuell omgångs matcher och livetabell.

Layout: Delad i HSL och ASL. Rent, avskalat och maximerat för visuell tydlighet (inga inmatningsfält).

Flik 2: Admin & Live Reporting (Kontrollrummet)

Innehåll: Live-rapportering (input-fält) för aktuell omgång, samt lista/dragspel över kommande omgångar.

Layout: Delad i HSL och ASL. Detta är din arbetsyta under spelkvällarna.

Flik 3: Season History (Arkivet)

Innehåll: Historiska (avklarade) matcher för den pågående säsongen.

Interaktion: Enkel filtrering på omgång eller lag för att snabbt kunna dubbelkolla tidigare resultat.

Flik 4: Global Power Rankings (Prestigen)

Innehåll: En massiv, blandad tabell (HSL + ASL) sorterad på ren Elo-rating.

Komponent: FormBadges: De 5 senaste matcherna visualiserade som färgade cirklar (Grön = Vinst inkl. OT, Röd = Förlust inkl. OT).

3. Teams & Identity (/app/teams/[id]/page.tsx)

Denna route är dynamisk baserat på lagets ID. Det är här vi bygger "stoltheten".

Den visuella kärnan: Sidan läser in team.primaryColor från databasen och injicerar den som en CSS-variabel. Knappar, flik-indikatorer och graflinjerna färgas i lagets unika färg.

Komponent: TeamHero

Stor logotyp, lagnamn i fet modern font, aktuell Elo i en "guld/neon"-badge, och en snabb summering av säsongen.

Flikar:

Tab 1: SeasonStats (Aktuell prestation)

Tab 2: TrophyCabinet (Visuell komponent med 3D-effekt eller lysande ikoner för achievements).

Tab 3: History & Form

Komponent: EloChart (En Recharts-linjegraf över säsongens Elo-utveckling).

Komponent: TeamRecords (Visar "Longest Win Streak", "Biggest Win", etc. i snygga kort).

4. Playoff Bracket (/app/playoffs/page.tsx)

En renodlad visuell upplevelse.

Utmaning: Brackets kräver mycket horisontellt utrymme.

Komponent: TournamentTree

Panorerbar och zoombar (särskilt för mobil).

Har tre sub-vyer (Tabs): HSL Playoff, ASL Playoff, CL Playoff.

Lag som är utslagna renderas med lägre opacitet (gråas ut).

Visar "Bäst av 3"-status direkt i noden.

5. The Ritual Room (/app/admin/page.tsx)

Administratörens kommandocentral.

Stora, tydliga och "farliga" knappar (kräver konfirmerings-modal innan de körs).

Komponenter:

GenerateScheduleButton (Endast klickbar i PRE_SEASON).

MidSeasonReviewCard (Visar vinnarna av grundserien och aktiverar "Generate Playoffs"-knappen).

EndSeasonButton (Triggar snapshot, delar ut achievements och nollställer tabeller).

6. Trophy Ceremony (/app/history/[seasonId]/page.tsx)

När The Ritual Room stänger en säsong, skapas denna statiska, immutabla sida.

En digital tidskapsel. Visar exakt hur "Season 1" slutade.

Vinnare av CL, vinnare av ligorna, slutgiltig Elo-ställning.