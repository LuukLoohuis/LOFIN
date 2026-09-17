# LOFI Financieringsdossier

Een begeleide tool waarmee een ondernemer zelf een bankklaar financieringsdossier opbouwt:
investeringsbegroting, exploitatiebegroting voor drie boekjaren, liquiditeitsbegroting per
maand, aflossingsschema's, ratio's, scenario's en een documentenchecklist. Na de aanvraag kun
je elke maand je realisatie invoeren en zien hoe goed je prognose was.

> Deze tool helpt je je financieringsaanvraag voor te bereiden. Het is geen financieel advies en
> geen garantie op financiering. De uitkomsten zijn gebaseerd op jouw eigen invoer.

LOFI noemt, rangschikt of adviseert geen financiers.

## Stack

- React + TypeScript + Vite, Tailwind
- Supabase (auth, Postgres met row level security, opslag) in de EU
- Vitest voor de tests, Vercel voor hosting

## Lokaal draaien

```sh
npm install
cp .env.example .env.local   # vul je eigen Supabase-gegevens in
npm run dev
```

| Script | Wat het doet |
| --- | --- |
| `npm run dev` | ontwikkelserver |
| `npm test` | alle tests |
| `npm run coverage` | tests met dekkingsrapport (de rekenkern moet op 100% blijven) |
| `npm run typecheck` | TypeScript zonder build |
| `npm run lint` | ESLint |
| `npm run build` | productiebuild |

## Opbouw

```
src/
├─ engine/      rekenkern: zuiver, deterministisch, volledig getest (zie engine/README.md)
├─ config/      grenswaarden, branchevoorbeelden, checklists, teksten
├─ schema/      zod per wizardstap; de types komen uit de rekenkern
├─ data/        opslag van plannen (nu de browser, vanaf fase 5 ook Supabase)
├─ components/  invoervelden en opmaak
├─ features/    wizard, plannenlijst, resultaat
└─ app/         routes
```

De rekenkern is de enige plek waar gerekend wordt. Het dashboard, de pdf en het Excel-bestand
lezen allemaal hetzelfde resultaat. Alle bedragen zijn hele centen, alle percentages
basispunten. De rekenregels staan in [src/engine/README.md](src/engine/README.md).

## Fases

1. **Rekenkern en tests** — klaar
2. **Wizard (stap 1–6) met validatie en automatisch opslaan** — klaar
3. **Dashboard met scenario's** — klaar
4. **Export naar pdf en Excel** — klaar
5. Inloggen, opslag, account verwijderen, deploy
6. Prognose versus realisatie: versies, realisatie invoeren, CSV-import en de grafieken

## Privacy

Dataminimalisatie, hosting in de EU, geen analytics die invoer meelezen. De app vraagt nooit om
een bsn, rekeningnummer of bankinloggegevens en maakt geen koppeling met je bank.
