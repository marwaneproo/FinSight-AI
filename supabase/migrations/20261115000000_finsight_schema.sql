-- FinSight AI — persistence schema
-- Requires: Authentication → Providers → "Allow anonymous sign-ins" ENABLED (each browser session gets a private workspace).

create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null default 'My Workspace',
  session_id  text not null,
  plan        text not null default 'starter' check (plan in ('starter', 'pro', 'business')),
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create unique index if not exists workspaces_owner_uidx on public.workspaces(owner_id);

create table if not exists public.datasets (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  name            text not null,
  file_name       text not null,
  session_id      text not null,
  source          text not null default 'upload' check (source in ('upload', 'demo', 'consolidated')),
  row_count       integer not null default 0,
  opening_balance numeric(16,2) not null default 0,
  date_from       date,
  date_to         date,
  total_income    numeric(18,2) not null default 0,
  total_expenses  numeric(18,2) not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists datasets_workspace_idx on public.datasets(workspace_id, created_at desc);


create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  dataset_id    uuid not null references public.datasets(id) on delete cascade,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  date          date not null,
  description   text not null default '',
  vendor        text not null default 'Unknown',
  category      text not null default 'Uncategorized',
  amount        numeric(16,2) not null check (amount >= 0),
  type          text not null check (type in ('income', 'expense'))
);
create index if not exists transactions_dataset_idx on public.transactions(dataset_id, date);
create index if not exists transactions_workspace_idx on public.transactions(workspace_id);

alter table public.workspaces   enable row level security;
alter table public.datasets     enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "workspace owner" on public.workspaces;
create policy "workspace owner" on public.workspaces
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "dataset owner" on public.datasets;
create policy "dataset owner" on public.datasets
  for all to authenticated
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()))
  with check (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

drop policy if exists "transaction owner" on public.transactions;
create policy "transaction owner" on public.transactions
  for all to authenticated
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()))
  with check (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));

-- NOTE: `plan` is client-writable here because billing is simulated. When real Stripe billing is added,
-- revoke UPDATE on workspaces.plan from `authenticated` and let a webhook (service role) own that column.
