# Buggranskning av Riptide RPG, 2026-11-24

Granskad version: `c0be5b3`. Rapporten ersätter granskningen från 2026-09-23 (alla 52 punkter där är rättade och låsta av `tests/bug-review-2026-09-23.test.cjs`). Den här gången låg tyngden på allt som byggts sedan dess: Cow Run, skill tree, enchants, raidstriderna, hamnstäderna, kasinoshowen, WebGL-renderaren, språklagret och handkontrollen.

## Status

46 punkter hittades. 45 är rättade samma dag, en är medvetet lämnad (punkt 37). Ändringarna ligger i arbetskopian och är inte committade. Exe-filen i `dist/` och webbversionen har den gamla koden tills de byggs om.

Så verifierades rättningarna:

- Varje granskare körde om sina återskapningsskript mot den nya koden; varje fynd gav rätt beteende.
- Åtta nya testfiler låser rättningarna. Hela sviten går igenom, 1 308 av 1 308.
- Renderarens rättningar kördes mot riktig WebGL i en fristående testrigg; bilden på den normala vägen är oförändrad i alla 31 jämförelsescener.
- **Inte gjort:** en ny headless-körning av hela spelet mot den rättade koden påbörjades men avbröts på begäran. Rättningarna för hjältebyte, utkastning och Cow Run (punkt 2, 3, 43–46) är därför bara bevisade i tester, inte i det körande spelet.

Så gick granskningen till: åtta granskare, en per område. Sju läste kod och återskapade varje fynd med skript som kör de riktiga funktionerna ur `game.js` i Node. Den åttonde körde det riktiga spelet headless genom 41 zoner, cirka 50 fönster, sju språk, alla kasinospel, 25 stadstillstånd och alla övergångar (3 563 steg). Samma granskare rättade sedan sina egna områden och körde om sina skript mot den nya koden.

P1 betyder förlorade föremål eller framsteg, förlorat guld eller krasch. P2 är ett konkret fel en spelare kan råka ut för. P3 är mindre. "Bekräftat" betyder återskapat med skript eller i det körande spelet, "spårat" att felet följdes rad för rad men inte kördes.

## De allvarligaste

1. Punkt 1: Ringen förstörs om smedjan blir klar under en Cow Run.
2. Punkt 2: utkastning eller utloggning mitt i en Cow Run låter den döda rundan skriva på nästa hjälte, som kan förlora sitt vapen.
3. Punkt 20: Five Five Five äter upp en bonus som just vunnits eller köpts (upp till 500 000 guld).
4. Punkt 39: att lämna en hamnraid mitt i striden återupplivar hela styrkan, så en förlorande strid kan göras om gratis.
5. Punkt 14: räddningarna i skill tree ("en gång var tredje minut") laddas om på pausskärmen, även i hardcore.
6. Punkt 22: Space i raidlobbyn startar raidzonen bakom lobbyfönstret.
7. Punkt 36: en okänd ras från en annan spelare kraschar bildrutan för alla i rummet.

## Cow Run

| # | Allv. | Fel | Rättning |
|---|---|---|---|
| 1 | P1 | Ringen smids klart under en runda, sätts på rundans tomma utrustning och skrivs över när rundan slutar. Bekräftat. | Ringen binds till hjältens riktiga utrustning. En hjälte som redan drabbats får tillbaka en Ring (+0) i väskan vid laddning. |
| 2 | P1 | Utkastning ("öppnad på annan enhet"), utloggning eller fjärradering mitt i en runda avslutar inte rundan. Ett kort som väljs efteråt sparar rundans bonusar på nästa hjälte; ett legendariskt kort byter hjältens vapen mot rundans attrapp. Bekräftat i tre oberoende granskningar. | Rundan avslutas innan hjälten lämnas; korten vägrar när rundans ägare inte är hjälten i spel; laddningen städar bort kvarlämnade spår. |
| 3 | P2 | Rundans sammanfattning ligger kvar efter Change Character. Nästa hjälte står fryst, och "Run again" släpper in vilken hjälte som helst utan Prestige 5 och nivå 60. Bekräftat. | Sammanfattningen stängs alltid; "Run again" har kartans krav och gäller bara rundans egen hjälte. |
| 4 | P2 | Skill tree går att öppna och fylla i rundan (visar alla poäng som ospenderade). Bekräftat i tre granskningar. | Trädet är låst under en runda och visar hjältens eget träd. |
| 5 | P2 | Prestige går att ta mitt i en runda som nått nivå 60; hjälten kommer ut på nivå 60 i nästa prestige. Mekanismen bekräftad. | Prestige vägrar under en runda. |
| 6 | P2 | Att lämna rundan via Home eller kartan ger rundans hälsa, 0,4–1,4 % av den riktiga. Farligt för hardcore. Bekräftat. | Hälsa och mana följer med som andel (50 % i rundan blir 50 % utanför). |
| 7 | P3 | Samma runda betalar cirka 9 % svagare epics när man går ut än när man dör. Bekräftat. | Epics rullas alltid på Cow Levels nivå. |
| 8 | P3 | Fel Glaives tredje och fjärde glav ligger exakt på de två första. Bekräftat. | Glavarna sprids jämnt. Nivå 8+ blir starkare, som kortet lovar. |
| 9 | P3 | På "Replace which?" visar ruta 5 och 6 tangenter som inte gör något. Spårat. | 5 och 6 väljer ruta medan korten är uppe. |
| 10 | P3 | En utbytt War Totem lämnar sina stolpar kvar resten av rundan. Spårat. | Stolparna tas bort. |
| 11 | P2 | Handlaren säljer trolldrycker mitt i rundan; de helar där och försvinner sedan med rundan. Bekräftat. | Köpet vägras under en runda. |
| 12 | P3 | Esc eller Start med korten uppe öppnar Settings bakom korten, och 1–4 slutar välja kort. Spårat. | Settings öppnas inte medan korten är uppe. |

## Strid och skill tree

| # | Allv. | Fel | Rättning |
|---|---|---|---|
| 13 | P2 | Holy Beam med Wrath of Heaven kallar en pelare per fiende på linjen i stället för en. Bekräftat. | En pelare, på målet. Mindre skada mot en rad fiender än förut. |
| 14 | P2 | Trädets nedkylningar går på väggklockan: Unyielding, Ice Block, Guardian Spirit med flera laddas om på pausskärmen, och Reset nollställer dem. Bekräftat. | Nedkylningarna räknar stridstid och överlever Reset. Fördröjda talanger väntar ut pausen och landar en gång. |
| 15 | P3 | En dödad fiende behåller brännskada, Living Bomb och frysning, som går av när den reser sig. Bekräftat. | Allt sådant släpps vid döden. |
| 16 | P3 | Piercing Shot godtas på längre håll än lansen når: mana och nedkylning går åt, ingen skada. Bekräftat. | Lansen når alltid målet. |
| 17 | P3 | Dubbelklick på "Bind to weapon" förbrukar två likadana enchants. Bekräftat. | Valet nollställs efter en bindning. |
| 18 | P3 | Fortunes guld stämplas på fienderna när zonen byggs, inte vid dödandet. Spårat. | Gäller direkt när talangen lärs eller återställs. |
| 19 | P3 | Trädets markzoner (Blizzard, Consecration, fällor) följer med till nästa zon. Spårat. | Zonerna töms vid zonbyte. |

## Kasino

| # | Allv. | Fel | Rättning |
|---|---|---|---|
| 20 | P1 | Five Five Five: under fanfaren efter en bonus är Spin, köpknapparna, Auto och insatsen aktiva. En ny bonus skriver över den som väntar. Bekräftat, 32 av 400 slumpade sessioner. | En väntande bonus låser maskinen. 0 av 400 efter rättningen. |
| 21 | P3 | "Free spins over – X in all" räknar för lågt efter ett besök i hjältelistan. Bekräftat. | Summan läses från sparningen. |

## Paus, språk och handkontroll

| # | Allv. | Fel | Rättning |
|---|---|---|---|
| 22 | P2 | Space slår av pausen som raidlobbyn, altarritualen och hajrutan äger. Raidzonen körs bakom lobbyn. Bekräftat i två granskningar. | En scens paus kan inte växlas av spelaren; efteråt är spel, ljud och knapp i takt. |
| 23 | P2 | Hjälte- och spelarnamn som är spelord översätts (Hunter blir "Jäger", Max blir "最大"). Bekräftat. | Namn märks där de visas och översätts aldrig; samma ord som etikett översätts fortfarande. |
| 24 | P3 | Översättningslagrets HTML-cache begränsas efter antal, inte storlek. Spårat. | Stora sidor sparas inte; taket gäller också total storlek. |
| 25 | P3 | Kontrollen av öppna fönster för handkontrollen görs flera gånger per bildruta (5–9,5 % av huvudtråden i staden). Uppmätt. | En gång per bildruta, med omedelbar omläsning när ett fönster öppnas eller stängs. |

## Renderaren

| # | Allv. | Fel | Rättning |
|---|---|---|---|
| 26 | P2 | Vilda Tide-strider har ingen bakgrund på WebGL, bara en platt mörkgrön yta. Bekräftat. | Bilden skrivs ut innan den kopieras. |
| 27 | P2 | Efter att WebGL-kontexten tappats och återställts är nattlampor, bloom och ljusstrålar borta till omstart. Bekräftat. | Tilläggen efterfrågas på nytt vid återställning. |
| 28 | P2 | Om kontexten aldrig återställs förblir skärmen död. Spårat. | Efter fem sekunder flyttar skärmen till 2D-ritning. |
| 29 | P3 | Var 512:e nya gradient ritas i en annan gradients färger i en bildruta. Bekräftat. | Ordningen i tabellskrivningen är rättad. |
| 30 | P3 | Text bredare än 2048 pixlar ritas inte (Forsaken Ones intro på 4K med 250 % skalning). Bekräftat. | Texten skalas ned och sträcks ut. |
| 31 | P3 | `error.log` läser sidfel bara via Electrons gamla argumentordning. Bekräftat. | Båda formerna läses. |

## Sparning och multiplayer

| # | Allv. | Fel | Rättning |
|---|---|---|---|
| 32 | P3 | Inga trollformelseffekter eller auror når andra spelare: aurans nyckel skriver över pakettypen. Bekräftat. | Auran skickas i ett eget fält. |
| 33 | P3 | `migrate()` kastar fel eller hänger sig på trasiga fält, och en trasig hjälte kan tömma hela hjältelistan. Bekräftat, 11 felställen. | Skydd på varje ställe; 0 fel på över 12 000 varianter. |
| 34 | P3 | Ett felformat skadepaket gör en raidlord odödlig (HP blir NaN). Bekräftat. | Alla tal från andra spelare kontrolleras. |
| 35 | P3 | En version från 23–25 september som öppnar dagens hjälte nollar legoknektar, krig och goodwill. Bekräftat. | Se punkt 37. |
| 36 | P1 | En okänd ras från en annan spelare kastar fel varje bildruta för alla i rummet, och i hjältelistan för en topplisterad. Bekräftat, hittat under rättningen. | Okänd ras eller klass ritas som människa och krigare. |
| 37 | – | Stadens versionsnummer höjdes **inte**. Det skulle bara skydda mot versioner från 23 september–2 oktober, men låsa staden i alla dagens versioner tills de uppdateras och få ännu äldre versioner att tömma hela staden. | Ett test slår larm när ett nytt fält läggs till i staden utan att sparningen känner till det. |

## Raider och staden

| # | Allv. | Fel | Rättning |
|---|---|---|---|
| 38 | P2 | Raidens knappar sväljer klick eftersom knappraden skrivs om var 0,4:e sekund. 37–54 av 60 klick gick fram. Bekräftat. | Knapparna skapas en gång och agerar på trycket. 60 av 60. |
| 39 | P2 | Att lämna en raid mitt i striden och komma tillbaka återupplivar hela styrkan och garnisonen. Bekräftat. | En raid som lämnas mitt i räknas som reträtt med de stupade bokförda. |
| 40 | P3 | Reträtt inom 1,4 s efter att palatsportarna fallit drar ändå in hjälten i palatset. Bekräftat. | Väntan avbryts när raiden är över. |
| 41 | P3 | Prestige är inte spärrat utomlands. Spårat. | Samma spärr som Home och kartan. |
| 42 | P3 | En expedition som aldrig hann slåss (spelet stängt under överfarten) avgörs på odds och får skadade. Bekräftat. | Ingen skadas när inget utkämpats; annars bokförs de som faktiskt föll. |

## Hjältebyte, utkastning och utloggning

| # | Allv. | Fel | Rättning |
|---|---|---|---|
| 43 | P2 | En överfart överlever en utkastning: nästa hjälte hamnar i hamnstaden. Bekräftat i spelet. | Överfarten avbryts när hjälten lämnas. |
| 44 | P2 | Bankfönstret kastar ett fel varje sekund efter en utkastning med banken öppen. Bekräftat i spelet. | Kontroll att en hjälte finns. |
| 45 | P3 | Utkastning stänger mycket färre fönster än Change Character. Namnbytesrutan står kvar med förra hjältens namn. Bekräftat i spelet. | En gemensam städrutin för båda vägarna. |
| 46 | P3 | Ljudmiljön kunde förbli tyst efter en utkastning, och en raderad hjälte med en byggnad i handen på gården kunde kasta fel. Spårat, hittat under rättningen. | Ingår i samma städrutin. |

## Ändringar som påverkar balansen

- Holy Beam med Wrath of Heaven gör mindre skada mot en rad fiender: en pelare på 300 % i stället för en per fiende.
- Trädets räddningar och nedkylningar går inte att vänta ut på pausskärmen, i en Tide-strid eller med fönstret dolt, och Reset laddar inte om dem.
- Fel Glaives på nivå 8 och uppåt täcker ny mark med glav 3 och 4.
- En Cow Run går inte längre att förstärka med skill tree eller köpta trolldrycker.
- En raid som lämnas mitt i striden (även vid krasch) är över: de stupade är skadade i två bokslut, och expeditionen vilar i två. Förut var det en gratis ny strid.
- En expedition som aldrig slogs kommer hem utan skadade.
- Raidens knappar agerar på trycket, inte på släppet.

## Medvetet orört eller öppet

- Gäster i en onlineraid godtar bosspaket från vilken spelare som helst, inte bara värden. En modifierad klient kan döda lorder för andra gäster. Kräver avsändarkontroll och test med riktiga spelare.
- En hjälte som heter som sin klass (Hunter som är Hunter) läser "Hunter the Hunter" i vissa meningar på andra språk än engelska.
- Byter man språk mitt i en raid behåller de tre raidknapparna det gamla språket tills raiden är över.
- Goldrunes tvillingslag kan landa ett slag 140 ms in i en paus. Ofarligt.
- De stupade i en raid når disken med autosparningen var tolfte sekund. En hård krasch kan tappa de sista sekundernas förluster, men raiden räknas ändå som reträtt.
- Cow Run-texterna är inte översatta (känt sedan tidigare).
- Från förra granskningen står kvar: Firestores skrivtakt i raidernas reservväg, Tides-träning efter klockhopp, två webbflikar där den ena loggar ut, och kasinots enhetsbyte.

## Tester

Åtta nya testfiler låser rättningarna: `tests/bug-review-2026-11-24-{cow,combat,casino,ui,render,save,city,handover}.test.cjs`. Hela sviten: 1 308 av 1 308.
