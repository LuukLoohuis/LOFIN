# Werkafspraken LOFIN

## Wat dit is

Zelfhulptool waarmee een Nederlandse kleine ondernemer een financieringsdossier voorbereidt.
Geen financieel advies, geen financiers noemen of rangschikken, geen uitspraken over de kans op
financiering. Grenswaarden heten altijd indicatief.

## Architectuur

- `src/engine` is de enige plek waar gerekend wordt: zuiver, geen React, geen Supabase, geen
  `Date` en geen `Math.random`. ESLint bewaakt dat.
- `src/config` bevat alle grenswaarden, teksten, branchevoorbeelden en checklists. Geen losse
  getallen in de rekenkern.
- Eén ingang: `calculatePlan(input, config)` geeft een `PlanResult` dat het dashboard, de pdf en
  het Excel-bestand alle drie lezen.
- Bedragen zijn hele centen, percentages basispunten (700 = 7,00%). Afronden via `roundCents`
  (half van nul af, zoals Excel).
- Elke rekenregel moet in Excel als celformule na te rekenen zijn met dezelfde afronding.

## Tests

- `npm test` voor alles, `npm run coverage` voor de rekenkern: die blijft op 100%.
- De testcasus Loodgieter Jansen en de invarianten (balans sluit elke maand) mogen nooit breken.
- Nieuwe rekenregels krijgen een test met een met de hand na te rekenen uitkomst.

## Stijl

- UI-teksten, commentaar, testnamen en commits in het Nederlands; identifiers in het Engels.
- Commits volgen Conventional Commits met een korte Nederlandse omschrijving,
  bijvoorbeeld `feat(rekenkern): de laatste termijn vangt het afrondingsverschil op`.
- Commentaar legt uit waarom iets zo is, niet wat er staat.
- Committen na elke fase; pushen naar `main` op github.com/LuukLoohuis/LOFIN.
