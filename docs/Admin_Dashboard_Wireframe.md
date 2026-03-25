Wireframe: The Admin Cockpit (Flik 2)

Denna layout är optimerad för en widescreen-skärm (MacBook/Extern skärm) för att ge total kontroll över spelkvällen.

1. Top Navigation Bar

[ 📊 Spectator View ]  [ ⚙️ Admin & Live Reporting ] (Aktiv)  [ 📚 Season History ]  [ 🌍 Power Rankings ]

2. The League Toggle (The Focus)

En massiv, snygg switch som dikterar vad HELA skärmen visar. Färgerna anpassas (t.ex. Blå för HSL, Röd för ASL).
[ 🔵 HORIZON SUPER LEAGUE (HSL) ]  |  [ ⚪ ARCTIC SUPER LEAGUE (ASL) ]

3. The Main Grid (Split 60/40)

Vänster Kolumn: Inmatning (60% bredd)

Detta är din primära arbetsyta.

Round Selector: (En horisontell scroll med piller)
[ ✓ 1 ] [ ✓ 2 ] [ 3 (Aktiv) ] [ 4 ] [ 5 ] ... [ 26 ]

(Auto-Advance Banner syns här i 3 sekunder när match 7 låses - drivs av Backend State)
> 🏆 Omgång 3 Komplett! Laddar Omgång 4... (3s)

Match List (7 matcher per omgång):

[ MatchCard: Låst Resultat-bricka (COMPLETED) ]

[ MatchCard: Låst Resultat-bricka (COMPLETED) ]

[ MatchCard: Låst Resultat-bricka (COMPLETED) ]

[ MatchCard: Öppet Inmatningsformulär (SCHEDULED) ] <-- Här arbetar du just nu

[ MatchCard: Öppet Inmatningsformulär (SCHEDULED) ]

[ MatchCard: Öppet Inmatningsformulär (SCHEDULED) ]

[ MatchCard: Öppet Inmatningsformulär (SCHEDULED) ]

Höger Kolumn: Realtids-kontext (40% bredd)

Denna kolumn uppdateras blixtsnabbt (via revalidatePath) varje gång du låser en match till vänster.

Kort 1: Live Tabell (Standings)
Visar Top 14 för den valda ligan (HSL/ASL).
Rader: Rank | Lag | P | Målskillnad (+/-) | Form (Cirklar)
Denna är fristående och låter dig se hur dina inmatningar påverkar streckstriden direkt.

Kort 2: Veckans Elo-Raketer (Optional)
Ett litet kort som visar vilka 3 lag i ligan som ökat mest i Elo under den aktiva omgången. (Skapar en rolig snackis under spelkvällen).