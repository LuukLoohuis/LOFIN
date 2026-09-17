import { Link } from 'react-router';
import { Card } from '../../components/ui/Card';
import { DISCLAIMER } from '../../config';

/** Placeholder tot de definitieve teksten er zijn; de inhoud klopt met wat de app doet. */
export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy">
      <Card title="Wat we bewaren">
        <ul className="list-inside list-disc text-sm leading-relaxed text-slate-700">
          <li>Je e-mailadres, als je een account maakt.</li>
          <li>De gegevens die je zelf in je plannen invult.</li>
          <li>Bestanden die je zelf uploadt, zoals offertes.</li>
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          We vragen nooit om je burgerservicenummer, je rekeningnummer of je bankinloggegevens, en er is geen koppeling
          met je bank. Zonder account blijven je plannen in je eigen browser.
        </p>
      </Card>

      <Card title="Waar het staat" className="mt-6">
        <p className="text-sm leading-relaxed text-slate-700">
          De gegevens staan bij Supabase in de Europese Unie. We gebruiken geen analytics die meelezen wat je invult.
        </p>
      </Card>

      <Card title="Weghalen" className="mt-6">
        <p className="text-sm leading-relaxed text-slate-700">
          Via{' '}
          <Link to="/account" className="font-medium text-blue-700 underline">
            je account
          </Link>{' '}
          verwijder je alles in één keer: je account, je plannen, je vastgezette prognoses, je realisatiecijfers en je
          bestanden. Dat is definitief.
        </p>
      </Card>

      <p className="mt-8 text-xs leading-relaxed text-slate-500">{DISCLAIMER}</p>
    </LegalLayout>
  );
}

export function CookiePage() {
  return (
    <LegalLayout title="Cookies">
      <Card>
        <p className="text-sm leading-relaxed text-slate-700">
          We gebruiken geen tracking- of advertentiecookies. Wat we wel opslaan in je browser:
        </p>
        <ul className="mt-3 list-inside list-disc text-sm leading-relaxed text-slate-700">
          <li>je plannen, zolang je geen account hebt;</li>
          <li>je inlogsessie, als je wel een account hebt.</li>
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          Allebei nodig om de app te laten werken, dus je hoeft er niets voor aan te klikken.
        </p>
      </Card>
    </LegalLayout>
  );
}

function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Link to="/" className="text-sm font-medium text-blue-700 underline">
          Terug
        </Link>
        <h1 className="mt-4 mb-6 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {children}
      </div>
    </div>
  );
}
