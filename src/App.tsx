import { DISCLAIMER } from './config/disclaimer';

export function App() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <p className="text-sm font-medium text-slate-500">LOFI — Loohuis Finance &amp; AI</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">Financieringsdossier</h1>
      <p className="mt-4 text-slate-700">De rekenkern staat. De wizard volgt in fase 2.</p>
      <p className="mt-8 text-xs text-slate-500">{DISCLAIMER}</p>
    </main>
  );
}
