# Buggranskning av Riptide RPG, 2026-09-23

Granskad version: `86e0aec`. Rapporten ersätter granskningen från 2026-09-11; alla åtta punkter som var öppna där fanns kvar och ingår nedan.

## Status: rättade samma dag

Alla 52 punkter nedan är rättade, liksom de misstänkta punkter som visade sig vara verkliga. Ändringarna ligger i arbetskopian och är inte committade. Exe-filen i `dist/` och webbversionen har den gamla koden tills de byggs om.

Så verifierades rättningarna:

- De åtta granskarna körde om sina testskript mot den nya koden. Varje fynd gav rätt beteende.
- En ny testfil, `tests/bug-review-2026-09-23.test.cjs`, låser rättningarna. Alla 667 tester går igenom.
- Spelet kördes headless genom alla 36 zoner och 39 paneler utan ett enda fel.
- Minnet vid zoom på gården stannar nu vid en fast budget: +132 MB i stället för +1 505 MB när zoomen passerar hela intervallet.

Ändringar som påverkar balansen:

- Lorderna i onlineraider får de +50 % HP som koden alltid avsett. Onlineraider blir alltså svårare än förut.
- Föremål och legendariska vapen skalar i nav-zonerna efter hjältens progression. Det gäller Moonshine, altaret, gården, staden, tronsalen, hamnen, Wasteland och dess grottor. Drops i grottorna blir därmed svagare än förut. Slutspelszonerna på nivå 60 är oförändrade.
- Kistor från kasinot rullar efter hjältens progression, var de än öppnas.
- Köpta gårdsdjur börjar mätta. Första måltiden kommer efter en till två timmar, och en kalv tar ungefär tre timmar att växa upp i stället för två.
- En halväten höbal eller fröhög ger tillbaka de tuggor som är kvar, inte alltid fem.
- Försäljning mot fullt valv går till överflödet i stället för att försvinna.

Verifieringen hittade några följdfel och ett gammalt fel som missades första gången. Alla är rättade:

- Ride the Bus kastade ett fel efter varje rätt första gissning, så 2x gick inte att casha ut. Det felet fanns redan före granskningen.
- En duell mellan en ny och en äldre version tappade den äldre spelarens insats.
- Gäster utan WebRTC fick aldrig lordens närstrid, eftersom målet inte lästes från Firestore.
- En gäst som stängt spelet i raidlobbyn blockerade START. Lobbyn har nu ett hjärtslag.
- Säsongsbytet kunde pensionera den nya säsongens hjältar om en gammal exe fanns kvar. Hjältar märks nu med sin säsong.
- Handkontrollspelare fastnade vid Final Hour-portalen utan Ice Armor.
- Ett köpt Slots-bonus försvann om spelet stängdes mitt i snurren.

Medvetet orört:

- Firestores skrivtakt i raidernas reservväg, var 400:e till 450:e ms per dokument. Att sänka den gör spelet trögare för gäster utan WebRTC, så det är ett avvägningsbeslut.
- Tides-träning som står still efter att klockan hoppat framåt. Det är ett medvetet skydd mot att vrida klockan bakåt.
- En Cow Level-runda som avbryts levande räknas inte. Det kan vara avsiktligt.
- Två webbflikar där den ena loggar ut, och ett smalt kapplöpningsfall i hämtningen av hjältar som ligger före. Båda kräver REST-läge eller mycket exakt timing och rättas bäst tillsammans med en större översyn av molnkoden.
- Informationsrutan i Slots beskriver hjulen, medan vinsten styrs av en utfallstabell. Rutan säger det själv, så det räknas som design.

P1 betyder säkerhetshål, fusk som skapar guld eller föremål, förlorad sparning, blockerad progression eller möjlig krasch. P2 är ett konkret fel som en spelare kan råka ut för. P3 är mindre. Radnumren gäller `86e0aec`.

"Bekräftat" betyder att felet återskapades med ett skript som kör de riktiga funktionerna ur nuvarande `game.js` i Node. "Spårat" betyder att felet följdes rad för rad i koden men inte kördes.

## De allvarligaste

1. Punkt 1: andra spelares namn kan köra skript hos alla i samma raid- eller duellrum.
2. Punkt 2: Sebbes bägarspel ger i praktiken obegränsat guld.
3. Punkt 3: Gamble against friend betalar ut insatser som aldrig drogs.
4. Punkt 26: gårdens kundvagn ger nästa hjälte gratis djur och byggnader.
5. Punkt 34: en resa mitt i kröningen eller avrättningen fryser spelet.
6. Punkt 17: Ice Armor kan försvinna för gott, och då stängs Final Hour.
7. Punkt 36: raidgäster utan WebRTC får aldrig slutbelöningen.
8. Punkt 43: zoomning på gården kan äta hundratals MB till över 1,5 GB minne.
9. Punkt 11 och 12: molnsparningen tappar framsteg vid karaktärsbyte och kan väcka en död hardcore-hjälte.

## Säkerhet

1. **P1 – Andra spelares namn skrivs in i sidan utan escaping.** [game.js:1240](game.js#L1240)
   Raidlobbyn och Gamble against friend (13157, 13161, 13175, 13198, 13294) lägger namnen direkt i `innerHTML`, och duellens resultatrad går samma väg via `log()` till nyhetsraden (10192). Namnet kontrolleras bara av inmatningsfältets längd, och sidan saknar Content-Security-Policy. En spelare som skriver sin egen rumspost kan sätta namnet till `<img src=x onerror=…>`. Skriptet körs då hos alla som går med, med deras inloggning, och kan till exempel tömma deras hjältar i molnet och på enheten eller anropa `window.desktop` i exe-filen.
   Test: bekräftat av tre granskare oberoende av varandra; koden är även kontrollläst.
   Åtgärd: kör namnen genom den befintliga `esc()` på alla ställen, och neka `<>&"` i nya namn och vid namnbyte.

## Guld, kasino och handel

2. **P1 – Sebbes bägarspel: insatsen kan höjas efter betalning, och vinsten räknas på den höjda insatsen.** [game.js:12854](game.js#L12854)
   `cupStart` drar `CUP_BETS[cupBetI]`, men `cupPick` läser om samma index. Knapparna − och + är aktiva medan "Pick a cup" visas, eftersom `cupUI` bara räknar 'shuffling' och 'reveal' som upptaget.
   Scenario: satsa 500, vänta tills blandningen är klar, tryck + till 50 000 och välj bägare. Träff ger 140 000 fast 500 drogs. Miss visar "−50 000" men kostar 500. Vinsten går via `addGoldOverflow`, så valvtaket stoppar inget.
   Test: bekräftat, +139 500 netto på en runda; koden är även kontrollläst.
   Åtgärd: spara insatsen i `cupStart` och använd den i `cupPick`, och räkna 'picking' som upptaget för insatsknapparna.

3. **P1 – Gamble against friend betalar ut insatser som aldrig drogs.** [game.js:13282](game.js#L13282)
   Varje klient drar bara sin egen insats när den själv ritar 'roll'-läget (13191), men potten räknas som insats gånger antal spelare. En spelare vars klient inte är igång när duellen startar, eller vars betalning misslyckas, räknas ändå med.
   Scenario: B låser 500 000 och stänger spelet. A låser, duellen startar, B uteblir, och A trycker "claim the pot" efter två minuter. A får 1 000 000 och har skapat 500 000 ur tomma luften. Det går att upprepa.
   Test: bekräftat av två granskare oberoende av varandra.
   Åtgärd: låt varje klient skriva `paid.<pid>` efter lyckad betalning, och betala bara ut det som faktiskt betalats.

4. **P2 – "Scrap Chest Gear" skrotar även föremål från tidigare sessioner.** [game.js:11390](game.js#L11390)
   Kistföremål märks med `_lid=lootUID++`, men `lootUID` börjar om på 1 vid varje start och `_lid` sparas med föremålet. Knappen väljer föremål på id, så nya id:n krockar med gamla.
   Scenario: behåll en epic från en kista, starta om, öppna en ny kista och tryck Scrap. Den gamla epicen skrotas också.
   Test: bekräftat av två granskare oberoende av varandra.
   Åtgärd: håll reda på kistans föremål som objektreferenser i stället för numeriska id:n.

5. **P2 – Blackjack sparar inte insatsen förrän handen är klar.** [game.js:12516](game.js#L12516)
   Roulette och Ride the Bus sparar när insatsen dras, men `bjDeal` och `bjDouble` gör det inte. Den som stänger fönstret på en dålig hand har insatsen kvar vid nästa start.
   Test: bekräftat: 85 000 i minnet men 100 000 på disk efter given.
   Åtgärd: `save()` direkt efter `spendGold` i `bjDeal` och `bjDouble`, och likadant i `spinSlots` och `spinSea`.

6. **P2 – Frispel i Slots försvinner när maskinen stängs.** [game.js:12360](game.js#L12360)
   `openSea` nollställer `seaFree`, och Close är bara spärrad under en manuell snurr. En bonus som landar samtidigt som en vinst på minst 10x delas ut först efter firandet, och Close avbryter den timern.
   Test: bekräftat: 10 frispel, 9 efter ett, 0 efter att maskinen öppnats igen.
   Åtgärd: spärra Close medan frispel återstår, eller spara frispelen på karaktären.

7. **P2 – Den som lämnar Sebbes bord mitt i en runda förlorar insatsen utan besked.** [game.js:12881](game.js#L12881)
   Blackjack och Ride the Bus vägrar stänga mitt i en runda, men `closeCupGame` gör det inte, och handkontrollens B-knapp stänger också.
   Test: bekräftat: 50 000 borta och ingen rad i loggen.
   Åtgärd: vägra stänga i 'shuffling' och 'picking', eller avgör rundan först.

8. **P2 – Gamble against friend: förloraren kan stänga rummet innan vinnaren fått betalt.** [game.js:13359](game.js#L13359)
   Leave stänger rummet för varje avgjord spelare, och vinnarens klient betalar först när sista hjulet stannat. Om förloraren hinner före försvinner båda insatserna.
   Test: bekräftat.
   Åtgärd: en avgjord spelares Leave ska bara ta bort spelaren, inte stänga rummet.

9. **P2 – Gamble against friend: två spelare som går med samtidigt tappar en av dem ur turordningen.** [game.js:13123](game.js#L13123)
   Turordningen byggs från en inaktuell läsning. Den som tappas betalar men kan aldrig vinna.
   Test: bekräftat.
   Åtgärd: `arrayUnion`/`arrayRemove`, och ingen betalning för den som saknas i turordningen.

10. **P3 – Försäljning mot fullt valv förstör intäkten, men loggen visar hela summan.** [game.js:11317](game.js#L11317)
    Försäljning använder `Math.min(goldCap(),…)` utan överflöd. Samma sak gäller Sell All och gårdsförsäljning (11145, 11182, 11361, 3946, 7196).
    Test: bekräftat: husdjuret är borta, guldet oförändrat, loggen säger "+25 000".
    Åtgärd: betala via `addGoldOverflow`, eller vägra sälja och säg att valvet är fullt.

## Sparning, moln och konton

11. **P2 – "Change Character" tappar den förra hjältens väntande molnsparning.** [game.js:16309](game.js#L16309)
    Knappen anropar den strypta `save()`, och `FB.pushDirty` är en enda flagga för hela kontot. När nästa hjälte sparas skickas bara den, och flaggan släcks. Upp till en minut av den förra hjältens spel når aldrig molnet.
    Scenario: spela A på datorn, byt karaktär, spela A på telefonen från den gamla molnkopian. Vid datorns nästa inloggning har telefonens kopia högre rev och ersätter datorns framsteg.
    Test: bekräftat på både SDK- och REST-vägen.
    Åtgärd: håll smutsflaggan per hjälte, eller använd `saveNow()` i knappen på samma sätt som Exit.

12. **P2 – En hardcore-död tvingas inte till molnet, så hjälten kan komma tillbaka levande.** [game.js:6107](game.js#L6107)
    `hcDeath()` anropar bara den strypta `save()`. Byter man hjälte eller avslutar inom en minut har molnet kvar `hcDead:false`, och den kopian vinner sedan över den döda.
    Test: hjältebytet bekräftat; avslutsvägen spårad.
    Åtgärd: `saveNow()` i `hcDeath`, och låt Exit spara så länge `S` finns.

13. **P2 – Ett sessionsanspråk som misslyckas vid inloggning görs aldrig om.** [game.js:15526](game.js#L15526)
    Startar exe-filen innan nätverket är uppe är skyddet mot två samtidiga enheter avstängt hela sessionen. Datorn och telefonen kan då spela samma hjälte och skriva över varandra.
    Test: bekräftat.
    Åtgärd: försök igen från den befintliga femsekunderstimern tills anspråket lyckas.

14. **P2 – Äldre versioner av spelet förstör data de inte känner igen.**
    Sparfiler följer kontot men versionerna gör det inte, och webbversionen kan ligga efter exe-filen. Samma mönster som zonkraschen 2026-09-19 finns kvar på fler ställen:
    - Hybrid-Tides tas bort om arten är okänd eller hybrids.js inte laddats, och nästa sparning skriver bort dem ([assets/tides/core.js:134](assets/tides/core.js#L134)). Bekräftat: en nivå 30-hybrid försvinner och sparningen skriver bara kvar den vilda Tiden. `Mounts.normalize` släpper okända riddjur på samma sätt.
    - En stad från en nyare ekonomiversion behandlas som gammal och nollställs, och nästa sparning skriver över den riktiga ([assets/city/economy.js:471](assets/city/economy.js#L471)). Spårat.
    - En okänd ras eller klass kastar fel i `renderSelect` och tömmer hela hjältelistan ([game.js:16177](game.js#L16177)). Spårat.
    Åtgärd: behåll okända poster orörda i stället för att släppa dem, och låt en äldre version vägra skriva över en sparfil med högre version.

15. **P2 – Ett byte av `SEASON` väcker förra säsongens hjältar till liv.** [game.js:15867](game.js#L15867)
    Första sparningen märker om det gamla molndokumentet med `merge:true` och behåller `chars`, så nästa hämtning tar in de gamla hjältarna igen. Gäller först när `SEASON` ändras.
    Test: bekräftat på båda vägarna.
    Åtgärd: nollställ dokumentet en gång när säsongen inte stämmer, innan något skickas.

16. **P3 – Mindre sparfel.**
    - Topplistans skrivning saknar `isWrite`, så en köad äldre post kan landa ovanpå en nyare ([game.js:15954](game.js#L15954)). Bekräftat.
    - Att dölja eller stänga fönstret sparar inte lokalt först, och molnkopian skickas under den gamla rev:en. På mobilen kan en äldre kopia vinna ([game.js:15424](game.js#L15424)). Bekräftat.
    - `saveNow()` sätter aldrig smutsflaggan, så en studsad eller misslyckad sparning görs inte om ([game.js:15410](game.js#L15410)). Bekräftat.
    - Om Firebase-skripten inte laddas en gång fastnar inloggningen tills omstart, eftersom `FB.tried` aldrig nollställs ([game.js:15570](game.js#L15570)). Spårat.

## Strid, bossar och progression

17. **P1 – Ice Armor försvinner för alltid om spelet stängs innan "Take it".** [game.js:3056](game.js#L3056)
    Ritualen sätter `ritualDone=true` och sparar medan rustningen bara finns i `ritualArmor`. Efter omstart går ritualen inte att göra om, och Final Hour kräver Ice Armor.
    Test: bekräftat: sparfilen har `ritualDone=true` och ingen Ice Armor, och en ny ritual startar inte.
    Åtgärd: lägg rustningen på hjälten eller i väskan innan `save()`, och reparera drabbade sparfiler i `migrate()`.

18. **P2 – En fördröjd Multi-Shot- eller Arcane Barrage-pil kan rensa raiden efter ett zonbyte.** [game.js:5869](game.js#L5869)
    Pil två och tre skjuts med `setTimeout` och kontrollerar bara att målet lever. `buildZone` rensar inte väntande timers, så pilen landar i den nya zonen, och `killEnemy` räknar kvarvarande bossar där.
    Scenario: solo i Violet Halls med Fel Lord nästan död, tryck 2 och sedan Home inom 90 ms. I Moonshine dör Fel Lord och spelet säger "THE SANCTUM IS CLEARED!" med kista och lockout, fast två lorder aldrig rördes.
    Test: bekräftat.
    Åtgärd: kräv `enemies.includes(t)` i timern.

19. **P2 – Equip i väskan, och husdjurens Equip och Unequip, kringgår utrustningslåset.** [game.js:11304](game.js#L11304)
    `gearSwapTo` nekas under bosstrid och i Cow Level, men dessa tre knappar kontrollerar inte samma sak.
    Test: bekräftat.
    Åtgärd: samma kontroll av `inBossFight()` och `cowLocked()` i alla tre hanterarna.

20. **P2 – Att gå in i Final Hour-portalen startar slutstriden utan bekräftelse.** [game.js:7542](game.js#L7542)
    Klick och handkontroll går via `openFinalGate()`, men att gå in i portalen anropar `goToZone()` direkt. I hardcore går det sedan inte att fly.
    Test: bekräftat.
    Åtgärd: anropa `openFinalGate()` en gång per närmande.

21. **P3 – Prestige låter en hardcore-hjälte fly från en bosstrid.** [game.js:6162](game.js#L6162)
    Karta, Home och karaktärsbyte är spärrade, men `doPrestige()` flyttar hjälten levande till zon 0, även från Thor. Bekräftat.
    Åtgärd: börja `doPrestige` med `if(hcNoFlee())return;`.

22. **P3 – Legendariska vapens attack beror på vilken zon man står i.** [game.js:2130](game.js#L2130)
    `bestNormalWeaponAtk()` använder `Math.max(S.zone,progZone(S))`, och specialzonerna har index 17 till 35. En P0-hjälte på nivå 12 har Rimfrost 133 i zon 3, 480 i Moonshine och 644 i Briarhollow. Bekräftat.
    Åtgärd: använd bara `progZone(S)`.

23. **P3 – Segern över Warlord Krev utlöses aldrig, och HUD säger "Press Continue" utan knapp.** [game.js:6138](game.js#L6138)
    `ZONES[17]` finns och räknas därför som nästa zon, så `S.finished` sätts aldrig. Bekräftat.
    Åtgärd: behandla en specialzon som "ingen nästa zon" på båda ställena.

24. **P3 – Ringreceptet för 500 000 kan köpas igen medan ringen smids.** [game.js:14898](game.js#L14898)
    Smedjan rensar receptet när jobbet startar men sätter `ringForged` först när det är klart, och butiken tittar bara på de flaggorna. Spårat.
    Åtgärd: räkna ett pågående ringjobb som smitt.

25. **P3 – Skillbarens knappar fungerar när spelet är pausat.** [game.js:10383](game.js#L10383)
    Tangenterna kräver `!gamePaused`, knapparna gör det inte, så man kan hela sig och kasta besvärjelser medan bossen står frusen. Spårat.
    Åtgärd: returnera tidigt i `cast()` och `usePot()` när spelet är pausat.

## Gården, gruvan och Tides

26. **P1 – Gårdens kundvagn följer med till nästa hjälte, som får allt gratis.** [game.js:7267](game.js#L7267)
    `farmCart` är global och töms bara av `exitBuildMode` och kassan. Karaktärsbyte anropar ingen av dem, 🛒-knappen ligger kvar, och kassan sätter saknat lager till 0 i stället för att vägra.
    Scenario: hjälte A placerar tre kalvar, en tjur och två höbalar, byter till hjälte B och trycker Buy. B får allt för 0 guld och A behåller sitt lager.
    Test: bekräftat; koden är även kontrollläst.
    Åtgärd: töm vagnen och byggläget i `showSelect()` och `beginGame()`, och låt kassan vägra när lagret inte räcker.

27. **P2 – Att lämna gården via kartan hoppar över `exitBuildMode`.** [game.js:10840](game.js#L10840)
    Betalar man vagnen efteråt byggs gårdens hus i den zon man står i, till exempel Moonshine, där de blockerar vägen. En påbörjad storleksändring följer med och ändrar storlek på en gårdsbit vid varje musrörelse i den nya zonen. Samma lucka finns i `mpTravelTo` och `doPrestige`.
    Test: bekräftat.
    Åtgärd: låt `applyZoneUI` anropa `exitBuildMode()` utanför gården, och låt `rebuildFarmItems` avbryta utanför gården.

28. **P2 – Nya gårdsdjur äter och växer aldrig medan man är i andra zoner.** [game.js:7276](game.js#L7276)
    Djur från kassan saknar `fed`, och bortasimuleringen räknar från en `lastSim` som flyttas fram var 30:e sekund.
    Test: bekräftat: fyra timmar borta gav 0 måltider, med `fed` satt blev kalven en vuxen ko.
    Åtgärd: sätt `fed:Date.now()` på djur i kassan.

29. **P2 – Gårdens Move, Pick up, Mirror och Resize hittar biten via arrayindex, som matningen kan flytta.** [game.js:7301](game.js#L7301)
    När en höbal äts upp tas den bort med `splice`, och indexet i den öppna rutan pekar då på fel byggnad. Pick up kan ta bort en lada i stället för tjuren, eller en inkubator med pågående avel, vilket låser två Tides för alltid.
    Test: bekräftat för fel byggnad; inkubatorfallet spårat.
    Åtgärd: spara objektreferensen och slå upp den med `indexOf` när knappen trycks.

30. **P3 – Halvätna höbalar och fröhögar ger tillbaka hela 5 poäng när de tas bort.** [game.js:3746](game.js#L3746)
    Maten tar aldrig slut om man flyttar balen innan den är uppäten. Bekräftat.
    Åtgärd: återbetala de tuggor som är kvar.

31. **P3 – Gruvhackan jagar förra zonens sten efter en resa.** [game.js:4183](game.js#L4183)
    Hjälten går till tom mark, hackar i luften och får kol. Bekräftat.
    Åtgärd: nollställ `mineTarget` i `buildZone()`.

32. **P3 – Efter omladdning är en Tide utrustad som spelaren inte valt.** [assets/tides/core.js:148](assets/tides/core.js#L148)
    När en Tide lämnats till träning är `equippedId` null med flit, men laddningen faller tillbaka på den första Tiden. Bekräftat.
    Åtgärd: behåll ett uttryckligt `null`.

## Staden och Crown Ledger

33. **P2 – Kröningen kan visa kronan medan böckerna vägrar den.** [game.js:13984](game.js#L13984)
    Kraven kontrolleras när man trycker "Take it", men `claimCrown` körs cirka 30 sekunder senare, och ledgerklockan går under scenen. En stängning i det fönstret kan sänka favör eller förtroende under gränsen. Scenen visar ändå "All hail" medan `crowned` förblir false, och vid nästa besök sitter kungen på tronen igen. Ungefär var tionde kröning drabbas.
    Test: bekräftat för både fängelse och exil; kontrollkörningen utan stängning kröns.
    Åtgärd: pausa ledgerklockan under scener, eller avsluta scenen med kungen kvar när `claimCrown` misslyckas.

34. **P1 – Kröning och avrättning avbryts aldrig: en resa mitt i scenen fryser spelet, och ett hjältebyte låter scenen ta över nästa hjälte.** [game.js:13864](game.js#L13864)
    Scenerna lever i de globala `coronation` och `execution`, som `update()` kör varje bildruta (7526), och inget nollställer dem vid kartresa, Home eller karaktärsbyte. Efter den första svärtan går kartan och "Change Character" att klicka i ungefär 45 sekunder.
    - Reser man till en zon utan invånare, till exempel en levelzon, en bossarena eller gården, kastar `coronationTick` fel på `world.npcs.find` ([game.js:13961](game.js#L13961)). Bildloopen saknar felskydd, så spelet fryser. Galgscenen kastar felet efter att avrättningen redan gjorts i minnet men före sparningen, och den svarta överlagringen blir kvar över hela fönstret, så exe-filen måste dödas.
    - Byter man hjälte mitt i scenen fortsätter den på den nya hjälten. Den hjälten står fast i 40 till 75 sekunder, kan krönas utan att ha tryckt på något, kan fastna för gott vid hamntrappan, och galgscenen hänger den nya hjältens kung och flyttar hjälten in i fängelset. En frusen hjälte i en stridszon kan dö, vilket är permanent i hardcore.
    Test: bekräftat av två granskare oberoende av varandra, både frysningen och hjältebytet.
    Åtgärd: nollställ `coronation`, `execution` och `hallScene` och dölj `#ritualFx` i `showSelect`, `showLogin` och `beginGame`, och spärra kartresa och Home medan en scen pågår.

35. **P3 – Mindre stadsfel.**
    - Hela Crown Ledger förblir öppen och går att ändra i efter ett zonbyte via kartan ([game.js:14762](game.js#L14762)). Spårat.
    - Under en protestmarsch fortsätter folkmassan vid galgen att marschera ([game.js:14074](game.js#L14074)). Bekräftat.
    - Erbjudandet om kungliga kläder går inte att stänga med handkontroll, eftersom `outfitFx` saknas i `PAD_PANELS` ([game.js:6684](game.js#L6684)). Spårat.
    - Bankfliken visar fel ränta under en "Dear money"-säsong ([assets/city/economy.js:1086](assets/city/economy.js#L1086)). Bekräftat.
    - Färdiga Royal Gardens blockerar tills staden byggs om, eftersom kollisionsrutnätet inte rensas ([game.js:13648](game.js#L13648)). Bekräftat; samma typ av fel som rättades på gården.

## Raider och samspel

36. **P1 – Raidgäster får ingen slutbelöning när bossens död kommer via Firestore.** [game.js:1254](game.js#L1254)
    Firestore-vägen markerar bossen död utan `killEnemy()`, och ett senare RTC-meddelande hoppar över den eftersom den redan är död. Gäster utan WebRTC-länk, till exempel telefoner på mobildata, går miste om kista, raidpotion och lockout vid varje rensning.
    Test: bekräftat: 0 kistor via Firestore, 1 via RTC.
    Åtgärd: gör som RTC-vägen, `e.netDead=true;killEnemy(e);`.

37. **P2 – Raidbossens närstrid skadar alla raiders, var de än står.** [game.js:7931](game.js#L7931)
    Avståndet mäts mot bossens mål, men skadan går alltid till den lokala hjälten.
    Test: bekräftat: träffar på 1 273 enheters avstånd, inga i solokontrollen.
    Åtgärd: slå bara lokalt om bossen når den lokala hjälten.

38. **P2 – Den som lämnar en onlineraid via kartan eller karaktärsbyte lämnar aldrig rummet.** [game.js:10805](game.js#L10805)
    Lyssnare och skrivningar fortsätter. Gästen dras senare hem från en helt annan zon, en solo-Violet Halls byggs med 1,5x HP som inte går att skada, och om värden gör så fryser gästernas lorder.
    Test: bekräftat.
    Åtgärd: `if(mp.on)mpLeave(false)` vid kartresa och karaktärsbyte, eller centralt i `buildZone`.

39. **P2 – En raider som dör utanför en förseglad kammare kan aldrig attackera igen under raiden.** [game.js:6076](game.js#L6076)
    `hero.deadWait` rensas bara när ett rum förseglas på den egna skärmen.
    Test: bekräftat: 0 slag på fem sekunder efteråt.
    Åtgärd: rensa `deadWait` när någon lord dör eller ingen lord är vaken.

40. **P2 – Gästens skada hamnar på fel lord och väcker den.** [game.js:5817](game.js#L5817)
    Skademeddelandet saknar boss-id, och värden lägger skadan på första vakna lord.
    Test: bekräftat.
    Åtgärd: skicka med boss-id och håll totalen per boss.

41. **P2 – Samma raidträff kan räknas två gånger.** [game.js:1429](game.js#L1429)
    RTC lägger på varje träff, Firestore lägger på den kumulativa totalen, och inget delat löpnummer hindrar dubbelräkning.
    Test: bekräftat: en träff på 100 tog 200 HP.
    Åtgärd: skicka den kumulativa totalen även över RTC.

42. **P3 – Mindre raidfel.**
    - Dubbelklick på "Join Room" lämnar en spelare som aldrig blir redo, så START visas aldrig ([game.js:1596](game.js#L1596)). Bekräftat.
    - "+50 % HP i onlineraider" tillämpas aldrig, eftersom zonen byggs innan raiden startat ([game.js:1644](game.js#L1644)). Bekräftat.
    - Gästers Flames- och Thorns-skada på raidlorder visas men dras aldrig av ([game.js:5778](game.js#L5778)). Bekräftat.

## Minne och stabilitet

43. **P1 – Skarphetscachen för sprites växer med varje zoomnivå och släpps aldrig.** [game.js:8782](game.js#L8782)
    `crisp()` sparar en ny canvas i full storlek för varje 2-pixelssteg av ritstorleken, per bild. Mushjul, pinch och högerspak ger nästan kontinuerliga zoomvärden, så cachen fylls på. Gårdshuset ritas med `crisp()` i upp till cirka 1 000 pixlars bredd. Kommentaren säger 4 pixlar men koden använder 2.
    Mätt i den riktiga spelsidan i headless Edge på gården:

    | Fall | Cachade canvasar | Pixeldata | Renderarens minne |
    |---|---|---|---|
    | 400 mushjulssteg, 100 % skalning | 209 | 212 MB | ej mätt |
    | 400 mushjulssteg, 150 % skalning | 240 | 471 MB | +337 MB |
    | Zoom genom hela intervallet, 150 % skalning | 555 | 1 658 MB | +1 505 MB |

    Staden och zonbyten läcker inte nämnvärt. Felloggen har två renderer-krascher 2026-09-21. Det är inte bevisat att cachen orsakade dem, men det är den största minnesväxt granskningen hittade.
    Åtgärd: avrunda storleken grövre, till exempel i steg om 10 %, och behåll bara de senaste två eller tre storlekarna per bild.

44. **P3 – Två robusthetsluckor.**
    - Bildloopen saknar felskydd, så ett enda undantag i `update()` eller `draw()` stoppar `requestAnimationFrame` och fryser spelet ([game.js:16741](game.js#L16741)). Punkt 34 är ett konkret fall; svepet genom zoner och paneler hittade inga fler.
    - När renderaren kraschar loggar main.js bara händelsen, och fönstret förblir tomt tills spelaren startar om ([main.js:173](main.js#L173)).

## Ljud

45. **P2 – Efter ett fel i ljudenheten förblir musiken i vanliga zoner tyst.** [game.js:2420](game.js#L2420)
    Felloggen har sex sådana rader, till exempel när hörlurar dras ur eller datorn vaknar. `ambAudio.onerror` kastar spåret, och eftersom profilen fortfarande heter 'world' startas det aldrig om i vanliga zoner. Kasinospåret saknar felhanterare. Inget lyssnar på ljudkontextens fel- eller statusändringar.
    Test: bekräftat med falsk AudioContext. Antagandet är att Chromium även skickar `error` till mediaelementet; det gick inte att köra i Electron.
    Åtgärd: sätt `AC.prof=null` i felhanterarna och starta om zonens spår vid nästa tangent eller klick.

46. **P3 – Mindre ljudfel.**
    - Ljudeffekter köas medan ljudkontexten är avstängd och spelas alla på en gång när den startar igen ([game.js:2383](game.js#L2383)).
    - "Pause game and audio" låter vanliga zoners musik spela vidare ([game.js:16595](game.js#L16595)).
    - Varje klick eller tangent häver ljudpausen ([game.js:2342](game.js#L2342)).
    - Odins tema spelar ungefär sju sekunder in i nästa zon och dubblas om man går in igen ([game.js:2674](game.js#L2674)).
    - På iPhone och iPad spelas Cow Level- och Final Hour-musiken trots avstängd musik ([game.js:2430](game.js#L2430)).

## Inmatning och kamera

47. **P2 – Rörelsetangenter fastnar när fönstret tappar fokus.** [game.js:6859](game.js#L6859)
    `keys` töms bara vid keyup, och inget lyssnar på `blur` eller `visibilitychange`. Exe-filen kör vidare i bakgrunden (`backgroundThrottling:false` i [main.js:149](main.js#L149)).
    Scenario: håll D och tryck Alt+Tab. Hjälten fortsätter gå österut medan du är borta, rakt in i fiender, och en hardcore-hjälte kan dö. När du kommer tillbaka går den tills du trycker D igen.
    Test: bekräftat.
    Åtgärd: töm `keys` och sätt `holdMove=null` vid `blur` och när sidan blir dold.

48. **P2 – På pekskärm räknas ett finger på en HUD-knapp som en nypning, och en avbruten nypning gör kartan död för tryck.** [game.js:7377](game.js#L7377)
    Pekhanterarna läser `e.touches`, alltså alla fingrar på skärmen, i stället för `e.targetTouches`, och `touchcancel` hanteras inte. Den som styr med vänster tumme och trycker på en besvärjelse med höger får zoomen att hoppa, och ett tryck på kartan medan en tumme vilar på en knapp avbryter promenaden. Avbryts en nypning av en systemgest eller ett samtal ignoreras alla senare tryck tills nästa hela nypning.
    Test: bekräftat.
    Åtgärd: använd `e.targetTouches` och lägg till en `touchcancel`-hanterare som gör samma sak som `touchend`.

49. **P3 – Enter loggar inte in medan man skriver i inloggningsfälten.** [game.js:6866](game.js#L6866)
    Den tidiga returen för fokuserade inmatningsfält kommer före Enter-grenen, och fälten ligger inte i ett formulär. Eftersom lösenordet skrivs vid varje start måste man klicka på Sign in varje gång.
    Test: bekräftat.
    Åtgärd: hantera Enter på inloggningsskärmen före den tidiga returen.

50. **P3 – Sidopanelens storlekshandtag sväljer alla tangenter efter en dragning.** [assets/ui/sidebar-resize.js:72](assets/ui/sidebar-resize.js#L72)
    Handtaget tar fokus och stoppar varje tangent innan det kollar vilken det är. W, 1, E och Esc gör ingenting, och piltangenterna ändrar panelens bredd, tills man klickar på kartan.
    Test: bekräftat.
    Åtgärd: stoppa bara piltangenterna, Home och End, eller släpp fokus när dragningen är klar.

51. **P3 – Handkontrollens knappar läses från fel enhet.** [game.js:6636](game.js#L6636)
    Knappar läses med standardindex även från kontroller utan standardmappning, så fel knappar öppnar inställningar eller sidopanelen. Med två enheter, till exempel Steams virtuella kontroll plus den riktiga, fungerar A, B och Start bara medan spaken är utböjd.
    Test: bekräftat.
    Åtgärd: läs bara knappar när `p.mapping==='standard'`, och byt enhet bara när den faktiskt gett utslag.

52. **P3 – Mindre inmatningsfel.** Alla spårade.
    - Bekräftelserutan som handkontrollens B öppnar i duellen saknas i `PAD_PANELS`, precis som erbjudandet om kungliga kläder i punkt 35, så handkontrollen kan inte svara på den ([game.js:6684](game.js#L6684)).
    - När spelet är pausat körs handkontrollen bara medan guiden är öppen, så pausade rutor som `sharkFx` går inte att stänga med den ([game.js:16756](game.js#L16756)).
    - Vänster spak går med hjälten bakom öppna paneler, även där tangentbordets rörelse medvetet är fryst ([game.js:7661](game.js#L7661)).
    - Sidledes scroll, till exempel Shift+hjul, tolkas som utzoomning ([game.js:7373](game.js#L7373)).
    - Kameran ignorerar zoomen vid zonbyte, så hjälten hamnar ur centrum och kameran sveper in ([game.js:5381](game.js#L5381)).

## Status för granskningen 2026-09-11

| Punkt då | Fel | Status | Punkt nu |
|---|---|---|---|
| 1 | Ice Armor försvinner före "Take it" | Kvar | 17 |
| 2 | Raidbossens närstrid träffar på avstånd | Kvar | 37 |
| 3 | Raidgäster utan slutbelöning | Kvar | 36 |
| 4 | Flyttade gårdsbyggnader lämnar osynliga hinder | Rättad sedan tidigare | – |
| 5 | Nya gårdsdjur växer inte i andra zoner | Kvar | 28 |
| 6 | Samma raidträff räknas två gånger | Kvar | 41 |
| 7 | Equip i väskan kringgår utrustningslåset | Kvar | 19 |
| 8 | Final Hour-portalen utan bekräftelse | Kvar | 20 |
| 9 | Gamla molnkaraktärer återkommer efter säsongsbyte | Kvar | 15 |

## Misstänkt men inte bekräftat

- Värdshusets lyckohjul väljer resultatet vid klick men sparar först när hjulet stannat, så en omladdning ger ett nytt försök.
- Att sälja ett enskilt föremål kontrollerar inte Cow Level-låset, till skillnad från Sell All och Scrap.
- Ett dubbelklick i Ride the Bus kan landa på nästa rundas knapp.
- Ett dubbelklick på Deal i blackjack efter en direkt blackjack delar och tar betalt för en ny hand.
- Faror och fiendeprojektiler finns kvar när en boss dör. I hardcore kan man dö efter segern, och vid Thor skrivs "won" över med "died".
- Kartresa fungerar medan hjälten är död.
- En klocka som gått bakåt, eller en sparfil från en enhet med framåtställd klocka, får gården, smältugnen och Tides-träningen att stå still tills klockan hunnit ikapp.
- `simFarmAway` är deklarerad två gånger (3586 och 3641); den första är död kod.
- En långsam sparning under en raid kan växla till REST och stänga av Firestore-nätverket, vilket tyst stoppar raidens lyssnare.
- Raider jämför en annan enhets klocka med den lokala, så en peer med fel klocka kan bli osynlig.
- Reservvägen via Firestore skriver bossläget var 400:e ms och spelardokumentet var 450:e ms, vilket överstiger Firestores rekommenderade takt per dokument.
- Spelare med bara handkontroll anropar aldrig `initAudio`, så efter ett ljudfel kommer ljudet inte tillbaka förrän de rör tangentbord eller mus.
- En vild strid anropar `saveNow()` två gånger i rad, och en guildserie tvingar fem till sju molnsparningar.
- `migrate()` kastar fel på felformade fält, och eftersom det körs utanför felhanteringen per hjälte avbryter en trasig molnhjälte hela hämtningen.
- main.js saknar `requestSingleInstanceLock()`, så två exe-fönster delar samma lokala sparningar.
- Firebase-skripten laddas utan tidsgräns, så en hängande CDN-förfrågan kan hindra starten.
- Tar man kronan med tolv fångar blir de tretton, och vid omladdning släpps den sista tyst.
- Handkontrollens A-knapp kan öppna anslagstavlan eller upprepa kungens repliker mitt i en scen.
- Topplistan publicerar Throne Hall och Harbour som zon 34 och 35 i stället för staden.
- Automatisk gruvdrift ger aldrig upp en sten som inte går att nå.
- `goHomeAfter` jämför bara zonnumret, så en hjälte man bytt till inom tre sekunder i samma zon skickas hem.
- Esc mitt i en panorering i byggläget öppnar inställningarna, och panoreringen fortsätter utan nedtryckt knapp tills nästa klick.
- Ritualens timer på 5,8 sekunder ändrar den hjälte som är laddad just då, även om spelaren hunnit byta.

## Kontrollerat utan fynd

- Alla 655 tester går igenom, och `node --check` godkänner all JavaScript.
- Alla 36 zoner laddades i den riktiga spelsidan med en provocerad strid och en slumpvis promenad i varje. Det gav inga undantag, inga konsolfel, inga misslyckade filhämtningar, ingen frusen bildloop och inga NaN i hjälte, kamera eller guld.
- 39 paneler öppnades: sidoflikarna, alla kasinospel, banken, anslagstavlan, smedjan, hallarna, talangerna och alla Crown Ledger-flikar. Ingen visade undefined, NaN eller [object i texten.
- Tolv varv genom nio zoner höll JS-minnet stilla på 6 till 8 MB.
- Crown Ledgers HTML i sex slumpade genomspelningar var ren. Dubbelklick, Enter och A-knappen kan inte ta betalt två gånger i ledgern, och den skrivskyddade vyn kan inte utföra något.
- Wasteland-generering, dungeons nåbarhet, bosstimers, riddjurslogiken och Tides strid, avel och guild höll för granskningen.
- Varje hjältesparning maskar `chars.<id>`, och inget som tickar anropar `saveNow()`.
- Alla tillgångssökvägar i koden finns och är incheckade, och exe-paketet innehåller bara spelets egna filer.

## Så gjordes granskningen

Åtta granskare läste var sitt område parallellt och återskapade varje fynd i Node mot nuvarande `game.js`. Inga riktiga konton, molndokument eller spelarsparningar användes. Spelet kördes dessutom headless i Edge med en inbyggd startkrok, och minnet mättes som renderarprocessens privata minne.

Skripten finns i sessionens tillfälliga mapp och kan försvinna: `C:\Users\App-L\AppData\Local\Temp\claude\c--RiptideRPG-Riptide-Game\91cf9305-e11b-4043-bf53-6c77ab5a8d0c\scratchpad\`, en undermapp per område och `sweep` för körningarna i spelet.

Inte täckt: riktiga raider mellan två datorer, Electron med GPU-accelererade canvasar och iOS.
