-- CRM WhatsApp: schema inicial
-- Rode no SQL Editor do Supabase (ou `supabase db push`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Etapas do funil (colunas do Kanban)
-- ---------------------------------------------------------------------------
create table public.stages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position int not null default 0,
  color text not null default 'slate',
  kind text not null default 'open' check (kind in ('open', 'won', 'lost')),
  created_at timestamptz not null default now()
);

insert into public.stages (name, position, color, kind) values
  ('Novo contato',      0, 'cyan',    'open'),
  ('Em atendimento',    1, 'blue',    'open'),
  ('Orçamento enviado', 2, 'violet',  'open'),
  ('Negociação',        3, 'amber',   'open'),
  ('Venda fechada',     4, 'emerald', 'won'),
  ('Perdido',           5, 'rose',    'lost');

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,                      -- só dígitos, com DDI (ex.: 5511999998888)
  phone_key text unique,           -- chave de deduplicação (ignora o 9º dígito no BR)
  email text,
  stage_id uuid references public.stages(id) on delete set null,
  value numeric(12, 2),
  notes text,
  channel text not null default 'manual' check (channel in ('manual', 'form', 'whatsapp')),

  -- Origem do tráfego (first-touch: gravada na primeira vez que chega)
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  gclid text,
  gbraid text,
  wbraid text,
  fbclid text,
  landing_page text,
  referrer text,
  has_google_click boolean generated always as (
    gclid is not null or gbraid is not null or wbraid is not null
  ) stored,

  first_message text,
  last_message_at timestamptz,
  won_at timestamptz,              -- usado no export de conversões offline do Google Ads
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_stage_idx on public.leads (stage_id);
create index leads_created_idx on public.leads (created_at desc);
create index leads_email_idx on public.leads (email) where email is not null;
create index leads_google_idx on public.leads (won_at) where has_google_click;

-- ---------------------------------------------------------------------------
-- Linha do tempo do lead
-- ---------------------------------------------------------------------------
create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  kind text not null check (
    kind in ('created', 'form', 'message_in', 'message_out', 'stage_change', 'note', 'attribution')
  ),
  content text,
  metadata jsonb not null default '{}'::jsonb,
  external_id text,                -- id da mensagem no WhatsApp (evita duplicar em retries)
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);
create unique index lead_activities_external_idx on public.lead_activities (external_id)
  where external_id is not null;

-- ---------------------------------------------------------------------------
-- Cliques no botão de WhatsApp do site (tracker.js)
-- Liga o GCLID/UTMs da visita à conversa que chega pela Evolution API.
-- ---------------------------------------------------------------------------
create table public.tracking_clicks (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  gclid text,
  gbraid text,
  wbraid text,
  fbclid text,
  landing_page text,
  referrer text,
  user_agent text,
  lead_id uuid references public.leads(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Log bruto dos webhooks (debug)
-- ---------------------------------------------------------------------------
create table public.webhook_events (
  id bigint generated always as identity primary key,
  source text not null,
  event text,
  payload jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index webhook_events_created_idx on public.webhook_events (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: qualquer usuário logado da equipe acessa o CRM.
-- Os webhooks usam a service role (ignora RLS).
-- ---------------------------------------------------------------------------
alter table public.stages enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.tracking_clicks enable row level security;
alter table public.webhook_events enable row level security;

create policy "equipe gerencia etapas" on public.stages
  for all to authenticated using (true) with check (true);

create policy "equipe gerencia leads" on public.leads
  for all to authenticated using (true) with check (true);

create policy "equipe gerencia atividades" on public.lead_activities
  for all to authenticated using (true) with check (true);

create policy "equipe lê cliques" on public.tracking_clicks
  for select to authenticated using (true);

create policy "equipe lê webhooks" on public.webhook_events
  for select to authenticated using (true);

-- Kanban atualiza sozinho quando chega lead novo
alter publication supabase_realtime add table public.leads;
