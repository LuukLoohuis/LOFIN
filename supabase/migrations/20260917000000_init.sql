-- LOFI Financieringsdossier: tabellen, rechten en opslag.
-- Uitgangspunt: iedereen ziet en bewerkt alleen zijn eigen gegevens, afgedwongen door
-- row level security. De tool vraagt nooit om een bsn, rekeningnummer of bankinloggegevens,
-- dus die velden bestaan hier ook niet.

-- gen_random_uuid() zit in PostgreSQL zelf sinds versie 13; geen extensie nodig.

-- Plannen

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Naamloos plan',
  legal_form text not null default 'eenmanszaak' check (legal_form in ('eenmanszaak', 'vof', 'bv')),
  sector text not null default 'overig',
  status text not null default 'concept' check (status in ('concept', 'ingediend', 'gearchiveerd')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plans_user_id_idx on public.plans (user_id, updated_at desc);

-- De invoer per wizardstap. version is een teller voor gelijktijdige bewerkingen.
create table public.plan_inputs (
  plan_id uuid not null references public.plans (id) on delete cascade,
  step text not null,
  data jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (plan_id, step)
);

-- Offertes en andere bijlagen; de bestanden zelf staan in een afgeschermde bucket.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  type text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

-- Vastgezette prognoses: de versie die je indient en elke herziening daarna.
create table public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  version_no integer not null,
  kind text not null check (kind in ('baseline', 'reforecast')),
  is_locked boolean not null default true,
  note text,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (plan_id, version_no)
);

create index plan_versions_plan_idx on public.plan_versions (plan_id, version_no desc);

-- Realisatie per maand en categorie.
create table public.actuals (
  plan_id uuid not null references public.plans (id) on delete cascade,
  month date not null,
  category text not null,
  amount_cents bigint not null,
  status text not null default 'open' check (status in ('open', 'afgesloten')),
  source text not null default 'manual' check (source in ('manual', 'csv')),
  updated_at timestamptz not null default now(),
  primary key (plan_id, month, category)
);

-- Kolomindeling van een boekhoudexport, zodat je die niet elke maand opnieuw hoeft te kiezen.
create table public.import_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  mapping jsonb not null,
  created_at timestamptz not null default now()
);

-- Een vastgezette prognose blijft zoals hij is

create or replace function public.plan_versions_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Een vastgezette prognose kan niet worden gewijzigd; maak een nieuwe versie.';
  end if;

  -- Verwijderen mag alleen als het plan zelf verdwijnt (of het account).
  if exists (select 1 from public.plans where id = old.plan_id) then
    raise exception 'Een vastgezette prognose kan niet los worden verwijderd.';
  end if;

  return old;
end;
$$;

create trigger plan_versions_immutable
before update or delete on public.plan_versions
for each row execute function public.plan_versions_immutable();

-- updated_at bijhouden

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger plans_touch before update on public.plans
for each row execute function public.touch_updated_at();

create trigger plan_inputs_touch before update on public.plan_inputs
for each row execute function public.touch_updated_at();

create trigger actuals_touch before update on public.actuals
for each row execute function public.touch_updated_at();

-- Row level security: alleen je eigen gegevens

alter table public.plans enable row level security;
alter table public.plan_inputs enable row level security;
alter table public.documents enable row level security;
alter table public.plan_versions enable row level security;
alter table public.actuals enable row level security;
alter table public.import_mappings enable row level security;

create policy "eigen plannen" on public.plans
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "eigen invoer" on public.plan_inputs
for all to authenticated
using (exists (select 1 from public.plans p where p.id = plan_inputs.plan_id and p.user_id = auth.uid()))
with check (exists (select 1 from public.plans p where p.id = plan_inputs.plan_id and p.user_id = auth.uid()));

create policy "eigen documenten" on public.documents
for all to authenticated
using (exists (select 1 from public.plans p where p.id = documents.plan_id and p.user_id = auth.uid()))
with check (exists (select 1 from public.plans p where p.id = documents.plan_id and p.user_id = auth.uid()));

create policy "eigen versies" on public.plan_versions
for all to authenticated
using (exists (select 1 from public.plans p where p.id = plan_versions.plan_id and p.user_id = auth.uid()))
with check (exists (select 1 from public.plans p where p.id = plan_versions.plan_id and p.user_id = auth.uid()));

create policy "eigen realisatie" on public.actuals
for all to authenticated
using (exists (select 1 from public.plans p where p.id = actuals.plan_id and p.user_id = auth.uid()))
with check (exists (select 1 from public.plans p where p.id = actuals.plan_id and p.user_id = auth.uid()));

create policy "eigen kolomindelingen" on public.import_mappings
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Opslag voor offertes: afgeschermd, met een map per gebruiker

insert into storage.buckets (id, name, public)
values ('offertes', 'offertes', false)
on conflict (id) do nothing;

create policy "eigen offertes lezen" on storage.objects
for select to authenticated
using (bucket_id = 'offertes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "eigen offertes toevoegen" on storage.objects
for insert to authenticated
with check (bucket_id = 'offertes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "eigen offertes vervangen" on storage.objects
for update to authenticated
using (bucket_id = 'offertes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "eigen offertes verwijderen" on storage.objects
for delete to authenticated
using (bucket_id = 'offertes' and (storage.foldername(name))[1] = auth.uid()::text);
