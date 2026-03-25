The Tournament Manager: Single Source of Truth (SSOT)

Detta dokument definierar den absoluta affärslogiken, regelverket och UI-arkitekturen för The Tournament Manager.

1. Matchregler & Poängsystem (NHL-modellen)

Vinst under ordinarie tid: 3 poäng till vinnaren, 0 poäng till förloraren.

Oavgjort vid full tid: Matchen går till förlängning (Sudden Death).

Vinst i förlängning (OTW): 2 poäng till vinnaren.

Förlust i förlängning (OTL): 1 poäng till förloraren.

2. Elo-Motorn (Rating System)

Startvärde: 1000 Elo för alla lag.

K-faktor (Volatilitet): K = 24.

Ekonomisk Modell: Strict Zero-Sum (Alternativ A). Vinnaren kan aldrig absorbera mer Elo än vad förloraren har på sitt konto (Min Elo = 0). Elo uppdateras för alla matcher, även slutspel och Champions League.

3. Säsongsstruktur & Spelschema

Grundserien: 14 lag per liga (HSL / ASL). Round Robin x2 (26 omgångar totalt).

Slutspelsformat (Playoffs)

De 8 bäst placerade lagen i respektive liga går vidare till slutspelet (HSL Playoffs & ASL Playoffs).

Format: Bäst av 3.

Hemmafördel: Bäst rankade laget börjar hemma (Hemma - Borta - Hemma).

Matchups: Rank 1 vs 8, Rank 4 vs 5, Rank 3 vs 6, Rank 2 vs 7.

Champions League

De 4 bäst placerade lagen från HSL möter de 4 bäst placerade från ASL.

Format: Bäst av 3.

Hemmafördel: Bäst rankade laget börjar hemma.

Matchups Kvartsfinal: - HSL Rank 1 vs ASL Rank 4

ASL Rank 2 vs HSL Rank 3

ASL Rank 1 vs HSL Rank 4

HSL Rank 2 vs ASL Rank 3

4. Prisutdelning (Awards)

Delas ut efter att hela slutspelet är avslutat. Priserna sparas i lagens Trophy Room på deras dynamiska lagsidor.

Trophies (Pokaler): Grundserievinnare (HSL/ASL), Slutspelsvinnare (HSL/ASL), Champions League-vinnare.

Hedersomnämnanden (Statistik): Flest hållna nollor, Längst win streak, Flest gjorda mål, Minst insläppta mål.