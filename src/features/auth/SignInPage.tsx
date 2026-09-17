import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Callout } from '../../components/ui/Callout';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { TextInput } from '../../components/ui/TextInput';
import { useSession } from './session';

export function SignInPage() {
  const navigate = useNavigate();
  const available = useSession((state) => state.available);
  const user = useSession((state) => state.user);
  const sendMagicLink = useSession((state) => state.sendMagicLink);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="mx-auto max-w-lg px-4 py-16">
        <Link to="/" className="text-sm font-medium text-blue-700 underline">
          Terug naar je plannen
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Inloggen</h1>
        <p className="mt-2 text-slate-700">
          Met een account staan je plannen niet alleen in deze browser, maar ook op je telefoon en je laptop. Je krijgt
          een inloglink per e-mail; een wachtwoord heb je niet nodig.
        </p>

        <Card className="mt-6">
          {!available && (
            <Callout tone="info" title="Inloggen is nog niet ingeschakeld">
              Deze installatie heeft nog geen Supabase-gegevens. Je kunt gewoon verder werken; je plannen blijven dan in
              deze browser.
            </Callout>
          )}

          {available && user !== null && (
            <Callout tone="success" title={`Je bent ingelogd als ${user.email}`}>
              <Link to="/account" className="font-medium underline">
                Naar je account
              </Link>
            </Callout>
          )}

          {available && user === null && (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                setError(null);
                sendMagicLink(email)
                  .then(() => {
                    setSent(true);
                  })
                  .catch((cause: unknown) => {
                    setError(cause instanceof Error ? cause.message : 'Versturen lukte niet');
                  });
              }}
            >
              <Field label="E-mailadres" error={error ?? undefined}>
                {({ id, invalid }) => (
                  <TextInput
                    id={id}
                    type="email"
                    autoComplete="email"
                    required
                    invalid={invalid}
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                    }}
                  />
                )}
              </Field>
              <div>
                <Button variant="primary" type="submit">
                  Stuur me een inloglink
                </Button>
              </div>
              {sent && (
                <Callout tone="success">
                  Check je mail. De link werkt één keer; daarna sta je ingelogd op dit apparaat.
                </Callout>
              )}
            </form>
          )}
        </Card>

        <p className="mt-6 text-xs leading-relaxed text-slate-500">
          We bewaren alleen je e-mailadres en de gegevens die je zelf in je plannen zet.{' '}
          <button
            type="button"
            className="underline"
            onClick={() => {
              void navigate('/privacy');
            }}
          >
            Lees hoe we met je gegevens omgaan
          </button>
          .
        </p>
      </div>
    </div>
  );
}
