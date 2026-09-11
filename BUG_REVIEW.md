Bugggranskning av Riptide RPG, 2026-09-11

Nio verifierade logikfel i version `ea46697`, sorterade med de allvarligaste först. P1 betyder hög prioritet; P2 betyder ett konkret fel som bör rättas. Granskningen ändrade inte spelkoden. Punkt 4 har därefter rättats i samband med skuggor och klickytor; övriga punkter beskriver fortfarande kvarvarande fel. Radreferenserna gäller granskningsversionen.

Verifieringen använde originalfunktioner och händelsehanterare från `game.js` i isolerade Node VM-tester. UI, tid, nätverksmeddelanden och sparningar simulerades. Inga riktiga konton, molndokument eller spelarsparningar användes. `node --check` gick igenom för `game.js`, `main.js` och `preload.js`. En separat Electron-körning kunde inte starta renderaren korrekt i testmiljön (`ERR_FAILED` och GPU-processfel), så detta är inte en fullständig manuell spelgenomgång eller ett test mot riktiga multiplayeranslutningar.

1. **P1 – Ice Armor kan försvinna permanent efter ritualen.** [game.js:2517](game.js#L2517)

   När ritualen slutar sätts `theKnife=false` och `ritualDone=true`, varefter `save()` körs. Rustningen finns då bara i den tillfälliga variabeln `ritualArmor`. Den hamnar på karaktären först när spelaren trycker på “Take it”. Stängning eller omladdning däremellan lämnar en avslutad ritual utan rustning och utan möjlighet att upprepa ritualen. Det blockerar även kravet på Ice Armor för Final Hour.

   Test: ritualens faktiska slutcallback skapade Ice Armor, men det sparade tillståndet hade tom rustningsplats, tom väska och `ritualDone=true`. Kontrollfallet där “Take it” trycktes utan omladdning utrustade rustningen korrekt. Åtgärd: spara belöningen tillsammans med ritualens slutförande, och reparera redan drabbade sparningar.

2. **P1 – Raidbossens närstrid skadar även spelare långt från bossen.** [game.js:6923](game.js#L6923)

   Avståndet som avgör om bossen kan slå beräknas mot `raidTarget(en)`, vilket kan vara en lagkamrat. Skadan appliceras däremot alltid på den lokala hjälten med `hurtHero()`. Därför kan en boss som nått tanken skada andra spelare oavsett deras position.

   Test: boss och målspelare vid `(1000,1000)`, lokal hjälte vid `(100,100)`. Ett tick sänkte lokal HP från 500 till 400, trots ett avstånd på cirka 1 273 enheter. Åtgärd: koppla utdelningen av närstridsskada till den spelare som faktiskt är attackens mål.

3. **P1 – Raidgäster kan bli utan slutbelöningen.** [game.js:792](game.js#L792)

   Firestore-vägen markerar bossen som död direkt, utan att köra `killEnemy()`. Därmed uteblir kistan, raidpotions, lockout och automatisk hemresa som normalt hanteras där. Om motsvarande RTC-meddelande kommer senare hjälper det inte: bossen är redan markerad som död. Felet kan uppstå både när RTC saknas och när Firestore-meddelandet hinner först.

   Test: sista bossens död via Firestore gav 0 kistor och 0 raidpotions; ett senare RTC-meddelande ändrade inte resultatet. Enbart RTC gav 1 kista, 1 raidpotion och registrerad lockout. Åtgärd: låt båda transporterna använda samma döds- och belöningshantering, med skydd mot dubbel utdelning.

4. **P2 – Flyttade farmbyggnader lämnar osynliga hinder på gamla platsen.** [game.js:4730](game.js#L4730)

   **Rättad:** `rebuildFarmItems()` ogiltigförklarar nu kollisionscachen även när antalet objekt är oförändrat.

   Kollisionscachen byggs om endast när antalet objekt ändras. `rebuildFarmItems()` skapar nya objekt vid flytt eller storleksändring, men antalet är normalt oförändrat. Cachen behåller därför gamla positioner och storlekar.

   Test: en byggnad flyttades från `(400,500)` till `(1200,500)`. Den tomma gamla platsen blockerade fortfarande hjälten, medan den nya byggnaden gick att gå igenom. Åtgärd: ogiltigförklara kollisionscachen när objekt flyttas, ersätts eller ändrar storlek.

5. **P2 – Nya farmdjur kan sluta växa medan spelaren är i andra zoner.** [game.js:3101](game.js#L3101)

   Nyplacerade djur saknar `fed`. Om spelaren lämnar farmen innan deras första måltid använder bortasimuleringen senaste `lastSim` som starttid för hungern. Den tiden flyttas fram var 30:e sekund, så djuret hinner aldrig bli tillräckligt hungrigt under fortsatt spel i andra zoner, trots mat och bostad.

   Test: kalv, lada och höbal under fyra simulerade timmar i 30-sekunderssteg gav 0 måltider, oförändrad kalv och 5/5 matbitar kvar. Samma scenario med en bestående initial `fed`-tid gav tre måltider och en vuxen ko. Åtgärd: ge nya djur en bestående starttid för matningsschemat.

6. **P2 – Samma raidträff kan räknas två gånger.** [game.js:967](game.js#L967)

   Firestore-fallbacken räknar kumulativ skada, medan RTC lägger på varje träffs skada utan att kontrollera om den redan ingår i den behandlade Firestore-totalen. Om Firestore kommer först och RTC-träffen är fördröjd dras skadan igen.

   Test: en träff på 100 skada tog bossen från 1 000 till 900 HP via Firestore och sedan till 800 HP när samma träffs RTC-meddelande levererades. Åtgärd: använd gemensamma sekvensnummer eller kumulativa totaler för att undvika dubbelräkning mellan transporterna.

7. **P2 – Equip i väskan kringgår utrustningslåset i bossstrider och Cow Level.** [game.js:10315](game.js#L10315)

   Byte av utrustningsuppsättning nekas uttryckligen under bossstrid och Cow Level. Väskans vanliga “Equip”-knapp saknar samma kontroller och visas utan motsvarande spärr. Spelaren kan därför ändå byta exempelvis vapen och rustning under striden.

   Test: den faktiska Equip-hanteraren bytte vapen trots att både `inBossFight()` och `cowLocked()` var sanna. Åtgärd: använd samma kontroll för alla vägar som byter utrustning.

8. **P2 – Final Hour-portalen kan starta slutstriden utan bekräftelse.** [game.js:6519](game.js#L6519)

   Att klicka på portalen öppnar en bekräftelse. Att gå in i dess radie anropar däremot `goToZone()` direkt när kraven är uppfyllda. Spelaren kan därför oavsiktligt hamna i slutstriden, vilket är särskilt allvarligt i hardcore där flykt spärras.

   Test: Prestige 50, nivå 60, Ice Armor och hjälten inne i portalens radie gav zonbyte utan något anrop till `openFinalGate()`. Åtgärd: använd bekräftelsen även när spelaren går in i portalen.

9. **P2 – Gamla molnkaraktärer kan återkomma efter nästa säsongsrensning.** [game.js:13211](game.js#L13211)

   Detta gäller när `SEASON` ändras. Ett gammalt molndokument ignoreras först korrekt, men den första nya sparningen uppdaterar dess säsong med `merge:true` och behåller gamla `chars`. Vid nästa molnhämtning blir de gamla karaktärerna därmed giltiga igen.

   Test med simulerat molndokument: säsong 1 innehöll `old`. Under säsong 2 ignorerades den först, men efter sparning av `new` och ny hämtning innehöll listan både `new` och `old`. Åtgärd: rensa föregående säsongs karaktärsdata atomiskt när molndokumentets säsong byts.
