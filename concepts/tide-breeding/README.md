# Tide breeding – bildkatalog

Öppna `index.html` i en webbläsare. Katalogen visar 300 unika korsningar mellan spelets 25 original-Tides, utan självkorsningar.

Sök på namn eller egenskaper, filtrera på en eller två föräldrar och klicka på varje varelse för att förstora bilden. Föräldrarna visas bredvid konceptet. Arbetsnamn och visuell design är förslag, inte nya spelregler.

Bildkatalogen ligger separat under `concepts/tide-breeding`. De 300 korsningarna används nu också av spelets breeding-system, via `assets/tides/hybrids.js` och bildarken i `assets/tides/hybrids/`. Endast de 25 originalarterna kan väljas som föräldrar. PNG-filerna är oförändrade Higgsfield-resultat; katalogen visar cellerna genom SVG-beskärning i webbläsaren.

`manifest.json` dokumenterar samtliga kombinationer, bildark, prompts, job-ID:n, källadresser och filhashar. `jobs/` sparar genereringskvitton. `build-catalog.cjs` uppdaterar den lokala katalogen från dessa filer.

Katalogen innehåller 300 slutliga koncept. De första 20 bildarken täcker alla par; ytterligare två ark innehåller 18 omarbetade bilder som ersätter sina första versioner i katalogen. `refinements.json` dokumenterar dessa förbättringar. Originalversionerna sparas för spårbarhet.

`source-rects.json` anger varje figurs synliga område. SVG-klippning håller hela figuren synlig och tar bort eventuella delar av grannfigurer utan att ändra källbilderna. Varje PNG har äkta transparens.
