-- =========================================================
-- SERTÃXI — Fase 1: schema base (Supabase / PostgreSQL)
-- Reaproveita o modelo atual do app (users, rides) e expande.
-- Executar no SQL Editor do Supabase.
-- =========================================================

create extension if not exists "uuid-ossp";
create extension if not exists postgis;   -- se indisponível, veja bloco geo no fim do arquivo

-- ---------- ENUMS ----------
do $$ begin
  create type user_role as enum ('passenger','driver','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type driver_status as enum ('pending','approved','rejected','suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vehicle_category as enum ('taxi','moto');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ride_status as enum (
    'requested','searching','accepted','driver_arriving','driver_arrived',
    'in_progress','completed','cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('cash','pix','card');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pending','paid','failed','refunded');
exception when duplicate_object then null; end $$;

-- ---------- CIDADES ----------
create table if not exists cities (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  state         text not null default 'PE',
  center_lat    double precision,
  center_lng    double precision,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (name, state)
);

-- ---------- PERFIS (1:1 com auth.users) ----------
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          user_role not null default 'passenger',
  full_name     text not null,
  email         text not null,
  phone         text,
  cpf           text,
  birth_date    date,
  city_id       uuid references cities(id),
  avatar_url    text,
  rating_avg    numeric(3,2) not null default 5.00,
  rating_count  integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists profiles_role_idx on profiles(role);

-- ---------- MOTORISTAS ----------
create table if not exists drivers (
  id            uuid primary key default uuid_generate_v4(),
  profile_id    uuid not null unique references profiles(id) on delete cascade,
  status        driver_status not null default 'pending',
  category      vehicle_category not null default 'taxi',
  is_online     boolean not null default false,
  last_lat      double precision,
  last_lng      double precision,
  last_seen_at  timestamptz,
  status_reason text,
  reviewed_by   uuid references profiles(id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists drivers_available_idx on drivers(status, is_online) where status = 'approved' and is_online = true;

-- ---------- VEÍCULOS ----------
create table if not exists vehicles (
  id            uuid primary key default uuid_generate_v4(),
  driver_id     uuid not null references drivers(id) on delete cascade,
  category      vehicle_category not null,
  model         text not null,
  color         text not null,
  plate         text not null,
  year          integer,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (plate)
);

-- ---------- DOCUMENTOS ----------
create table if not exists driver_documents (
  id            uuid primary key default uuid_generate_v4(),
  driver_id     uuid not null references drivers(id) on delete cascade,
  kind          text not null,             -- cnh, crlv, comprovante, foto_veiculo
  storage_path  text not null,             -- bucket privado "driver-docs"
  mime_type     text,
  status        driver_status not null default 'pending',
  reviewed_by   uuid references profiles(id),
  reviewed_at   timestamptz,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ---------- TARIFAS (por cidade e categoria) ----------
create table if not exists fares (
  id              uuid primary key default uuid_generate_v4(),
  city_id         uuid not null references cities(id) on delete cascade,
  category        vehicle_category not null,
  base_fare       numeric(10,2) not null default 0,
  per_km          numeric(10,2) not null default 0,
  per_min         numeric(10,2) not null default 0,
  minimum_fare    numeric(10,2) not null default 0,
  platform_fee_pct numeric(5,2) not null default 0,
  active          boolean not null default true,
  updated_at      timestamptz not null default now(),
  unique (city_id, category)
);

-- ---------- CORRIDAS ----------
create table if not exists rides (
  id              uuid primary key default uuid_generate_v4(),
  passenger_id    uuid not null references profiles(id),
  driver_id       uuid references drivers(id),
  city_id         uuid references cities(id),
  category        vehicle_category not null,
  status          ride_status not null default 'requested',
  origin_label    text not null,
  origin_lat      double precision not null,
  origin_lng      double precision not null,
  dest_label      text not null,
  dest_lat        double precision not null,
  dest_lng        double precision not null,
  distance_km     numeric(8,2),
  duration_min    integer,
  estimated_price numeric(10,2),
  final_price     numeric(10,2),
  payment_method  payment_method not null default 'cash',
  cancel_reason   text,
  requested_at    timestamptz not null default now(),
  accepted_at     timestamptz,
  arrived_at      timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  cancelled_at    timestamptz,
  updated_at      timestamptz not null default now()
);
create index if not exists rides_passenger_idx on rides(passenger_id, requested_at desc);
create index if not exists rides_driver_idx on rides(driver_id, requested_at desc);
create index if not exists rides_open_idx on rides(status, category) where status in ('requested','searching');
-- impede dois motoristas aceitando a mesma corrida (garantia no banco)
create unique index if not exists rides_one_active_driver on rides(driver_id) where status in ('accepted','driver_arriving','driver_arrived','in_progress');

-- ---------- POSIÇÕES (histórico curto da corrida) ----------
create table if not exists ride_positions (
  id          bigserial primary key,
  ride_id     uuid not null references rides(id) on delete cascade,
  driver_id   uuid not null references drivers(id),
  lat         double precision not null,
  lng         double precision not null,
  recorded_at timestamptz not null default now()
);
create index if not exists ride_positions_ride_idx on ride_positions(ride_id, recorded_at desc);

-- ---------- PAGAMENTOS ----------
create table if not exists payments (
  id                uuid primary key default uuid_generate_v4(),
  ride_id           uuid not null references rides(id) on delete cascade,
  method            payment_method not null,
  status            payment_status not null default 'pending',
  amount            numeric(10,2) not null,
  platform_fee      numeric(10,2) not null default 0,
  provider          text,          -- ex: mercadopago, stripe, pagarme
  provider_ref      text,          -- id da transação no provedor (nunca dados de cartão)
  paid_at           timestamptz,
  created_at        timestamptz not null default now()
);

-- ---------- AVALIAÇÕES ----------
create table if not exists ratings (
  id            uuid primary key default uuid_generate_v4(),
  ride_id       uuid not null references rides(id) on delete cascade,
  from_profile  uuid not null references profiles(id),
  to_profile    uuid not null references profiles(id),
  score         smallint not null check (score between 1 and 5),
  comment       text,
  created_at    timestamptz not null default now(),
  unique (ride_id, from_profile)
);

-- ---------- NOTIFICAÇÕES ----------
create table if not exists notifications (
  id          uuid primary key default uuid_generate_v4(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text,
  ride_id     uuid references rides(id),
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_profile_idx on notifications(profile_id, created_at desc);

-- ---------- DENÚNCIAS / SUPORTE ----------
create table if not exists reports (
  id          uuid primary key default uuid_generate_v4(),
  ride_id     uuid references rides(id),
  reporter_id uuid not null references profiles(id),
  against_id  uuid references profiles(id),
  subject     text not null,
  message     text not null,
  status      text not null default 'open',   -- open, resolved
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------- AUDITORIA ADMIN ----------
create table if not exists admin_audit_log (
  id          bigserial primary key,
  actor_id    uuid not null references profiles(id),
  action      text not null,
  entity      text not null,
  entity_id   text,
  details     jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- CONFIGURAÇÕES ----------
create table if not exists app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_by  uuid references profiles(id),
  updated_at  timestamptz not null default now()
);

-- ---------- TRIGGER updated_at ----------
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists rides_touch on rides;
create trigger rides_touch before update on rides for each row execute function touch_updated_at();
drop trigger if exists profiles_touch on profiles;
create trigger profiles_touch before update on profiles for each row execute function touch_updated_at();

-- ---------- PERFIL AUTOMÁTICO NO SIGNUP ----------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, role, full_name, email, phone)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'passenger'),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    new.raw_user_meta_data->>'phone'
  ) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- SEED MÍNIMO (sem dados falsos) ----------
insert into cities (name, state, center_lat, center_lng)
values ('Sertânia','PE',-8.0736,-37.2647)
on conflict (name, state) do nothing;

insert into fares (city_id, category, base_fare, per_km, per_min, minimum_fare, platform_fee_pct)
select id,'taxi',0,0,0,0,0 from cities where name='Sertânia'
on conflict (city_id, category) do nothing;
insert into fares (city_id, category, base_fare, per_km, per_min, minimum_fare, platform_fee_pct)
select id,'moto',0,0,0,0,0 from cities where name='Sertânia'
on conflict (city_id, category) do nothing;
-- valores acima ficam zerados de propósito: o administrador define as tarifas reais no painel.
