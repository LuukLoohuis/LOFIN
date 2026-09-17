# Rekenkern

Alles wat LOFI uitrekent gebeurt hier. De kern is zuiver: geen React, geen Supabase, geen klok
en geen toeval. Dezelfde invoer geeft altijd dezelfde uitkomst. Het dashboard, de pdf en het
Excel-bestand lezen allemaal hetzelfde `PlanResult`; er wordt nergens anders gerekend.

Eén ingang:

```ts
const result = calculatePlan(input, defaultEngineConfig);
```

Grenswaarden, schijven en checklists staan in `src/config`, niet hier.

## Conventies

- **Bedragen** zijn hele centen (`Cents`), nooit euro's met decimalen.
- **Percentages** zijn basispunten (`Bp`): 700 = 7,00%.
- **Seizoensgewichten** zijn twaalf gehele getallen in honderdsten, januari eerst, samen 1200.
- **Afronden** gaat half van nul af, zoals Excel's `AFRONDEN`: `roundCents(-2,5) = -3`. Voor het
  afronden gaat de waarde terug naar vijftien significante cijfers, zodat drijvende-kommaruis
  (`0,1 + 0,2`) niet doorwerkt.
- **Verdelen over maanden** gebeurt cumulatief: maand *j* krijgt
  `AFRONDEN(totaal × j / n) − AFRONDEN(totaal × (j−1) / n)`. De delen tellen daardoor exact op
  tot het totaal, worden nooit negatief en passen in Excel in één formule per cel.
- **Elke formule is een celformule.** Wat hier per maand gebeurt, moet in Excel met dezelfde
  afronding na te rekenen zijn. Daarom nergens een verborgen tussenstand of iteratie.

## Tijdlijn

Boekjaren lopen van januari tot en met december. De prognose beslaat altijd **drie volle
boekjaren**. Start de prognose niet in januari, dan komt daar een **verkorte startperiode**
voor: start je in oktober 2026, dan zijn de periodes okt–dec 2026, 2027, 2028 en 2029 en telt
de horizon 39 maanden. De horizon is dus 36 tot 47 maanden.

Maand **0 is het startmoment**: het moment vóór de eerste prognosemaand waarop de
investeringen worden gekocht, de financiering wordt uitbetaald en de eigen inbreng binnenkomt.
Afschrijving en rente beginnen daardoor netjes in maand 1. Maand 0 valt voor de btw en de
kwartaalindeling samen met de eerste prognosemaand, en telt mee in de eerste periode.

## Omzet

Drie modellen, allemaal exclusief btw:

| Model | Basis per maand |
| --- | --- |
| `uurtarief` | uurtarief × declarabele uren |
| `opdrachten` | aantal opdrachten × gemiddelde opdrachtwaarde |
| `maandbedrag` | vast maandbedrag |

Bij `maandbedrag` groeit de omzet de eerste twaalf maanden elke maand met het opgegeven
groeipercentage (de aanloopfase). Daarna staat dat niveau stil en groeit de omzet per boekjaar
met de groei van jaar 2 en 3. **Jaar 2 rekent vanaf het decemberniveau van jaar 1, niet vanaf
het jaartotaal**: anders zou de omzet in januari dalen terwijl de ondernemer groei invult.

Daarna gaat het seizoenspatroon eroverheen: `omzet = AFRONDEN(niveau × gewicht / 100)`, waarbij
het gewicht bij de **kalendermaand** hoort. Scenario's vermenigvuldigen dit met één factor.

## Kosten

- **Inkoopwaarde**: percentage van de omzet van dezelfde maand.
- **Vaste kosten**: per regel per maand of per jaar. Een jaarbedrag wordt cumulatief over twaalf
  maanden verdeeld; een verkorte startperiode krijgt alleen het deel dat bij haar maanden hoort.
  Vanaf boekjaar 2 werkt de kostenstijging door.
- **Personeel**: brutoloon × (1 + werkgeverslasten), tussen start- en einddatum.
- **Privé-opnamen** (eenmanszaak en vof): vast bedrag per maand, inclusief de reservering voor
  inkomstenbelasting en Zvw. Bij een bv zijn ze nul; het dga-salaris hoort bij personeel.
- **Dividend** (bv): per boekjaar, uitgekeerd in december.
- **Eenmalige kosten**: in hun eigen maand, als last in het resultaat.

## Afschrijving

Lineair: `(aanschaf − restwaarde) / looptijd in maanden`, **vanaf de maand na aanschaf**, met de
cumulatieve verdeling hierboven. Koop je in maand 0, dan loopt de afschrijving dus vanaf maand 1
en telt een vol boekjaar twaalf maanden.

Voorraad wordt niet afgeschreven en blijft op de balans staan. Bestaande vaste activa schrijven
door met het jaarbedrag uit de openingsbalans, tot de boekwaarde op is.

## Financiering

Een lening wordt uitbetaald in haar startmaand; de eerste termijn volgt de maand daarna. De
rente is `AFRONDEN(saldo × jaarrente / 12)` over het openstaande saldo.

- **Annuïtair**: `A = P · r / (1 − (1 + r)^−n)` met `r` de maandrente en `n` het aantal
  aflossingsmaanden. Aflossing = termijn − rente. De **laatste termijn lost het restant af**, zodat
  het saldo exact op 0 eindigt.
- **Lineair**: vaste aflossing `P / n`, rente over het saldo.
- **Aflossingsvrij**: alleen rente, de hoofdsom in één keer aan het eind van de looptijd.
- **Aflossingsvrije periode**: eerst alleen rente, daarna aflossen over de resterende maanden.
  Beslaat die periode de hele looptijd, dan volgt alles als slottermijn (en meldt de kern dat).
- **Bestaande schulden** gebruiken hetzelfde schema, maar zonder uitbetaling: het saldo staat al
  op de openingsbalans.

**Krediet (rekening-courant)** heeft geen schema. Het saldo mag tot de limiet negatief staan; die
roodstand is het opgenomen krediet. De rente loopt over de roodstand van de **vorige** maand — zo
ontstaat geen kringverwijzing, in de kern niet en in Excel niet. Wat niet binnen de limiet past,
is een tekort (`shortfall`) en levert een waarschuwing op.

## Btw

Factuurstelsel: btw hoort bij de maand van de omzet of de kosten, niet bij de betaling. Per
aangifteperiode (maand of kwartaal) wordt af te dragen btw min voorbelasting verrekend in de
maand ná die periode. Een teruggaaf komt in diezelfde maand binnen. De laatste aangifte van de
horizon valt erbuiten en blijft als schuld op de balans staan.

De btw op investeringen betaal je vooruit en krijg je terug bij de eerstvolgende aangifte. Het
resultaat laat dat apart zien als tijdelijke financieringsbehoefte.

## Betaaltermijnen

Een betaaltermijn van *D* dagen verschuift een bedrag over twee maanden, met een rekenmaand van
30 dagen: `k = D div 30` hele maanden, en het deel `(D mod 30) / 30` schuift nog een maand door.
Bij 45 dagen komt de helft in maand *m+1* en de helft in *m+2*.

Debiteurendagen gelden voor de omzet inclusief btw, crediteurendagen voor de inkoopwaarde
inclusief btw. Vaste kosten, personeel, privé-opnamen, rente en aflossing betaal je in de maand
zelf. Openstaande posten uit de openingsbalans worden in de eerste prognosemaand afgewikkeld.

## Belasting

Eenmanszaak en vof kennen geen winstbelasting in de prognose: de inkomstenbelasting zit in de
privé-opnamen.

Een bv betaalt vennootschapsbelasting per boekjaar volgens de schijven uit de config, met
verliesverrekening binnen de horizon. De aanslag over een periode wordt in **termijnen in het
volgende boekjaar** betaald; de aanslag over het laatste jaar blijft als schuld staan.

## Resultaat, kasstroom en balans

```
EBIT  = omzet − inkoopwaarde − vaste kosten − personeel − eenmalige kosten − afschrijving
CFADS = EBIT + afschrijving − privé-opnamen                (eenmanszaak en vof)
CFADS = EBIT + afschrijving − vpb − dividend               (bv)
```

De liquiditeitsbegroting loopt per maand: beginsaldo, ontvangsten (klanten, financiering, eigen
inbreng, subsidies, btw-teruggaaf) en uitgaven (inkoop, vaste kosten, personeel, eenmalige
kosten, btw, investeringen, rente, aflossing, privé-opnamen, vpb, dividend), en dat geeft het
eindsaldo.

De balans is vereenvoudigd maar sluitend: hij wordt opgebouwd uit dezelfde reeksen. **Activa =
passiva in elke maand** is een testinvariant; klopt dat niet, dan zit er een fout in de kern.

## Ratio's

Alle grenzen staan in de config en zijn **indicatief**: elke financier weegt zelf.

| Ratio | Berekening | Standaardgrenzen |
| --- | --- | --- |
| DSCR | CFADS / (rente + aflossing) per periode | < 1,0 rood · < 1,3 oranje · anders groen |
| Laagste kassaldo | laagste eindsaldo en de maand erbij | onder de limiet rood · onder de buffer oranje |
| Break-evenomzet | (vaste kosten + personeel + afschrijving + rente) / brutomarge % | — |
| Solvabiliteit | eigen vermogen / balanstotaal per 31-12 | < 15% rood · < 25% oranje |
| Schuld / kasstroom | rentedragende schuld bij start / CFADS jaar 1 | ≤ 3 groen · ≤ 5 oranje |

Voor eenmanszaak en vof staat er een tweede break-evenomzet bij, inclusief privé-opnamen: het
punt waarop de ondernemer ook zichzelf kan betalen.

## Scenario's

Basis, pessimistisch (standaard −20% omzet) en optimistisch (+10%). Alleen de omzet verschuift;
de inkoopwaarde beweegt als percentage mee, de rest blijft gelijk. Per scenario komen de DSCR
per periode, het laagste saldo, de eerste negatieve maand en de eerste maand met een tekort
boven de kredietlimiet eruit.

## Signalen

De kern geeft codes, geen teksten (die staan in de config):

| Code | Ernst | Betekenis |
| --- | --- | --- |
| `SEASONALITY_INVALID` | fout | geen twaalf gewichten of niet samen 1200 |
| `VAT_MIX_INVALID` | fout | de btw-verdeling is geen 100% |
| `FUNDING_IMBALANCE` | fout | bronnen en bestedingen sluiten niet op elkaar aan |
| `GRACE_TOO_LONG` | fout | aflossingsvrije periode even lang als of langer dan de looptijd |
| `MONTH_OUTSIDE_HORIZON` | waarschuwing | post valt buiten de prognose en telt niet mee |
| `NEGATIVE_CASH` | waarschuwing | het saldo gaat onder nul |
| `CREDIT_LIMIT_EXCEEDED` | waarschuwing | het tekort past niet binnen de kredietlimiet |
| `OPENING_BALANCE_MISMATCH` | waarschuwing | de openingsbalans sluit niet; het verschil staat bij overige schulden |
| `WITHDRAWALS_IGNORED_FOR_BV` | waarschuwing | privé-opnamen tellen niet bij een bv |
| `BALLOON_IN_HORIZON` | melding | een slottermijn valt binnen de prognose |

## Volledigheid

De score is het aandeel verplichte velden en verzamelde documenten. Het is een maat voor de
volledigheid van het dossier, **geen kans op financiering**.

## Vereenvoudigingen

Bewust simpel gehouden; belangrijk om te weten bij het lezen van de uitkomsten.

- Vakantiegeld zit in het percentage werkgeverslasten en wordt niet in mei uitbetaald.
- Voorraad blijft op peil: wat verkocht wordt, wordt aangevuld, dus de voorraadwaarde staat stil.
- Lease wordt als financiële lease doorgerekend (annuïtair schema, object bij de investeringen);
  een slottermijn is nog niet apart in te voeren. Operationele lease voer je in als vaste kost.
- Een achtergestelde lening telt niet als eigen vermogen; de solvabiliteit laat beide zien.
- Openstaande debiteuren en crediteuren uit de openingsbalans worden in maand 1 afgewikkeld.
- Overige schulden uit de openingsbalans blijven staan.
- Subsidies worden bij het eigen vermogen geboekt, niet als opbrengst.
- Vennootschapsbelasting gaat per boekjaar en wordt in het volgende boekjaar betaald; er is geen
  verliesverrekening met jaren vóór de prognose.
- Er wordt geen rente over een positief saldo gerekend.
- De kleineondernemersregeling (KOR) zit er niet in; de prognose gaat uit van btw-plicht.

## Testcasus Loodgieter Jansen

Eenmanszaak, start 1 januari 2027. Bus €35.000 en gereedschap €10.000 (beide vijf jaar), plus
€10.000 werkkapitaal. Eigen inbreng €5.000, lening €50.000 tegen 7% in 60 maanden annuïtair.
Omzet €150.000 per jaar, inkoopwaarde 35%, vaste kosten €20.000 per jaar, privé-opnamen €3.800
per maand.

| | Uitkomst |
| --- | --- |
| Termijn | € 990,06 |
| Rente jaar 1 | € 3.225,80 |
| Aflossing jaar 1 | € 8.654,92 |
| EBIT jaar 1 | € 68.500 |
| CFADS jaar 1 | € 31.900 |
| DSCR jaar 1 | 2,69 |
| Break-evenomzet jaar 1 | € 49.578,15 |

De specificatie noemt € 3.225,82 rente en € 8.654,90 aflossing. Dat is dezelfde reeks zonder
afronding per maand (zoals Excel's `CUM.RENTE`). Omdat de rente hier elke maand op centen wordt
afgerond, verschuift er twee cent tussen rente en aflossing; de schuldendienst is in beide
gevallen € 11.880,72 en de DSCR dus gelijk.
