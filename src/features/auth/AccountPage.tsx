import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Callout } from '../../components/ui/Callout';
import { Card } from '../../components/ui/Card';
import { TextInput } from '../../components/ui/TextInput';
import { usePlanStore } from '../../data/planStore';
import { useSession } from './session';

const CONFIRMATION = 'VERWIJDER';

export function AccountPage() {
  const user = useSession((state) => state.user);
  const signOut = useSession((state) => state.signOut);
  const deleteAccount = useSession((state) => state.deleteAccount);
  const movedPlans = usePlanStore((state) => state.movedPlans);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="mx-auto max-w-lg px-4 py-16">
        <Link to="/" className="text-sm font-medium text-blue-700 underline">
          Terug naar je plannen
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Je account</h1>

        {user === null ? (
          <Card className="mt-6">
            <p className="text-sm text-slate-700">
              Je bent niet ingelogd. Je plannen staan in deze browser.{' '}
              <Link to="/inloggen" className="font-medium text-blue-700 underline">
                Inloggen
              </Link>
            </p>
          </Card>
        ) : (
          <>
            <Card className="mt-6" title="Ingelogd" description={user.email}>
              {movedPlans > 0 && (
                <Callout tone="success">
                  {movedPlans} plan{movedPlans === 1 ? '' : 'nen'} uit deze browser {movedPlans === 1 ? 'is' : 'zijn'}{' '}
                  overgezet naar je account.
                </Callout>
              )}
              <div className="mt-4">
                <Button
                  onClick={() => {
                    void signOut();
                  }}
                >
                  Uitloggen
                </Button>
              </div>
            </Card>

            <Card className="mt-6" title="Account verwijderen" description="Dit kan niet ongedaan worden gemaakt.">
              <p className="text-sm text-slate-700">
                We verwijderen je account, je plannen, je vastgezette prognoses, je realisatiecijfers en de bestanden
                die je hebt geüpload. Er blijft niets van je bewaard.
              </p>

              {done ? (
                <Callout tone="success" title="Verwijderd">
                  Je account en al je gegevens zijn weg. Bedankt voor het gebruik.
                </Callout>
              ) : (
                <div className="mt-4 flex flex-col gap-3">
                  <label className="text-sm text-slate-700">
                    Typ <strong className="font-semibold">{CONFIRMATION}</strong> om te bevestigen
                    <TextInput
                      className="mt-1"
                      value={confirmation}
                      onChange={(event) => {
                        setConfirmation(event.target.value);
                      }}
                    />
                  </label>
                  {error !== null && <p className="text-xs font-medium text-red-700">{error}</p>}
                  <div>
                    <Button
                      variant="danger"
                      disabled={confirmation !== CONFIRMATION || busy}
                      onClick={() => {
                        setBusy(true);
                        setError(null);
                        deleteAccount()
                          .then(() => {
                            setDone(true);
                          })
                          .catch((cause: unknown) => {
                            setError(cause instanceof Error ? cause.message : 'Verwijderen lukte niet');
                          })
                          .finally(() => {
                            setBusy(false);
                          });
                      }}
                    >
                      Verwijder mijn account en alle gegevens
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
