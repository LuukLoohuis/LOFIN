import { Card } from '../../../components/ui/Card';
import { Textarea } from '../../../components/ui/TextInput';
import { defaultEngineConfig } from '../../../config';
import type { ExplanationKey } from '../../../engine';
import { useWizard } from '../context';

interface Prompt {
  key: ExplanationKey;
  title: string;
  question: string;
  example: string;
}

const PROMPTS: readonly Prompt[] = [
  {
    key: 'ondernemer',
    title: 'Over jou',
    question: 'Wie ben je, wat heb je gedaan, en waarom kun jij dit?',
    example:
      'Bijvoorbeeld: "Ik werk twaalf jaar als installateur, de laatste vier als voorman bij een installatiebedrijf. Ik heb mijn VCA en mijn F-gassen-certificaat, en ken de vaste onderaannemers in de regio."',
  },
  {
    key: 'markt',
    title: 'Markt en klanten',
    question: 'Voor wie werk je, en hoe komen die klanten bij je?',
    example:
      'Bijvoorbeeld: "Particulieren binnen een straal van 25 kilometer, plus twee aannemers die nu al werk doorschuiven. Twee derde van mijn omzet komt van herhaalopdrachten en mond-tot-mondreclame."',
  },
  {
    key: 'investering',
    title: 'Waarom deze investering',
    question: 'Wat ga je precies kopen en waarom nu?',
    example:
      'Bijvoorbeeld: "Een bus met inrichting en gereedschap. Zonder eigen bus kan ik geen materiaal meenemen en moet ik werk weigeren."',
  },
  {
    key: 'opbrengst',
    title: 'Wat het oplevert',
    question: 'Levert het extra omzet op, lagere kosten, of allebei? Maak het concreet.',
    example:
      'Bijvoorbeeld: "Met eigen vervoer kan ik twee klussen per dag doen in plaats van één. Dat is ongeveer 2.500 euro extra omzet per maand, en ik bespaar 400 euro huur van een bus."',
  },
  {
    key: 'risicos',
    title: 'Risico’s',
    question: 'Wat kan er misgaan, en wat doe je er dan aan? Hier eerlijk zijn werkt in je voordeel.',
    example:
      'Bijvoorbeeld: "Als de woningmarkt stilvalt, loopt de verbouwomzet terug. Onderhoud en storingen lopen dan door; daar richt ik me in een rustige periode op. Ik houd één maand vaste lasten op de rekening."',
  },
  {
    key: 'zekerheden',
    title: 'Zekerheden',
    question: 'Wat kun je als zekerheid bieden? Alleen beschrijven; je regelt het bij de financier zelf.',
    example: 'Bijvoorbeeld: "De bus zelf kan als onderpand dienen. Verder heb ik geen zakelijke bezittingen."',
  },
];

export function StepToelichting() {
  const { input, update } = useWizard();
  const minChars = defaultEngineConfig.completeness.explanationMinChars;

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Je verhaal bij de cijfers"
        description="Een financier leest dit vóór je begroting. Schrijf in gewone taal, alsof je het aan een klant uitlegt."
      >
        <p className="text-sm text-slate-600">
          LOFI schrijft deze teksten niet voor je: het moet jouw verhaal zijn, in jouw woorden. De voorbeelden hieronder
          laten zien hoe concreet het mag.
        </p>
      </Card>

      {PROMPTS.map((prompt) => {
        const value = input.explanations[prompt.key];
        const length = value.trim().length;
        return (
          <Card key={prompt.key} title={prompt.title} description={prompt.question}>
            <Textarea
              aria-label={prompt.title}
              rows={5}
              value={value}
              onChange={(event) => {
                const text = event.target.value;
                update((draft) => {
                  draft.explanations[prompt.key] = text;
                });
              }}
            />
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-xs">
              <p className="max-w-3xl text-slate-500 italic">{prompt.example}</p>
              <p className={length >= minChars ? 'text-slate-500' : 'text-amber-700'}>
                {length} tekens{length < minChars ? ` — mik op minstens ${minChars}` : ''}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
