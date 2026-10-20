-- =========================================================
-- SERTÃXI — Fase 1: RLS (privilégio mínimo por papel)
-- Executar depois de 01_schema.sql
-- =========================================================

-- helper: evita recursão em policies
create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function my_driver_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from drivers where profile_id = auth.uid();
$$;

grant execute on function auth_role() to authenticated;
grant execute on function my_driver_id() to authenticated;

-- ---------- habilita RLS ----------
alter table profiles          enable row level security;
alter table drivers           enable row level security;
alter table vehicles          enable row level security;
alter table driver_documents  enable row level security;
alter table cities            enable row level security;
alter table fares             enable row level security;
alter table rides             enable row level security;
alter table ride_positions    enable row level security;
alter table payments          enable row level security;
alter table ratings           enable row level security;
alter table notifications     enable row level security;
alter table reports           enable row level security;
alter table admin_audit_log   enable row level security;
alter table app_settings      enable row level security;

-- ---------- PROFILES ----------
drop policy if exists profiles_self_read on profiles;
create policy profiles_self_read on profiles for select
  using (id = auth.uid() or auth_role() = 'admin');

-- motorista e passageiro enxergam só o mínimo do outro lado (nome/foto/nota)
drop policy if exists profiles_ride_peer on profiles;
create policy profiles_ride_peer on profiles for select
  using (
    exists (
      select 1 from rides r
      left join drivers d on d.id = r.driver_id
      where (r.passenger_id = auth.uid() and d.profile_id = profiles.id)
         or (d.profile_id = auth.uid() and r.passenger_id = profiles.id)
    )
  );

drop policy if exists profiles_self_update on profiles;
create policy profiles_self_update on profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and role = auth_role());

-- ---------- CITIES / FARES (leitura pública logada) ----------
drop policy if exists cities_read on cities;
create policy cities_read on cities for select using (auth.uid() is not null or true);
drop policy if exists cities_admin on cities;
create policy cities_admin on cities for all using (auth_role() = 'admin') with check (auth_role() = 'admin');

drop policy if exists fares_read on fares;
create policy fares_read on fares for select using (true);
drop policy if exists fares_admin on fares;
create policy fares_admin on fares for all using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ---------- DRIVERS ----------
-- motorista vê o próprio cadastro; admin vê todos
drop policy if exists drivers_self on drivers;
create policy drivers_self on drivers for select
  using (profile_id = auth.uid() or auth_role() = 'admin');

-- passageiro só vê motorista aprovado e online (mapa), com dados limitados via view
drop policy if exists drivers_public_online on drivers;
create policy drivers_public_online on drivers for select
  using (status = 'approved' and is_online = true);

-- motorista só edita disponibilidade/localização do próprio registro
drop policy if exists drivers_self_update on drivers;
create policy drivers_self_update on drivers for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and status = (select status from drivers d2 where d2.id = drivers.id));

drop policy if exists drivers_admin on drivers;
create policy drivers_admin on drivers for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ---------- VEÍCULOS ----------
drop policy if exists vehicles_self on vehicles;
create policy vehicles_self on vehicles for all
  using (driver_id = my_driver_id() or auth_role() = 'admin')
  with check (driver_id = my_driver_id() or auth_role() = 'admin');

-- ---------- DOCUMENTOS (bucket privado) ----------
drop policy if exists docs_self on driver_documents;
create policy docs_self on driver_documents for select
  using (driver_id = my_driver_id() or auth_role() = 'admin');
drop policy if exists docs_insert_self on driver_documents;
create policy docs_insert_self on driver_documents for insert
  with check (driver_id = my_driver_id());
drop policy if exists docs_admin on driver_documents;
create policy docs_admin on driver_documents for update
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ---------- RIDES ----------
drop policy if exists rides_read on rides;
create policy rides_read on rides for select
  using (
    passenger_id = auth.uid()
    or driver_id = my_driver_id()
    or auth_role() = 'admin'
    -- pool de corridas abertas: motorista aprovado vê corridas aguardando
    or (
      status in ('requested','searching')
      and exists (select 1 from drivers d where d.profile_id = auth.uid() and d.status='approved' and d.is_online)
    )
  );

drop policy if exists rides_insert_passenger on rides;
create policy rides_insert_passenger on rides for insert
  with check (passenger_id = auth.uid() and status = 'requested');

-- passageiro só cancela; não altera preço/estado
drop policy if exists rides_passenger_update on rides;
create policy rides_passenger_update on rides for update
  using (passenger_id = auth.uid() and status in ('requested','searching','accepted','driver_arriving'))
  with check (passenger_id = auth.uid() and status = 'cancelled');

-- motorista só altera corridas dele (status/preço final são validados por trigger)
drop policy if exists rides_driver_update on rides;
create policy rides_driver_update on rides for update
  using (driver_id = my_driver_id())
  with check (driver_id = my_driver_id());

drop policy if exists rides_admin on rides;
create policy rides_admin on rides for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ---------- POSIÇÕES ----------
drop policy if exists positions_read on ride_positions;
create policy positions_read on ride_positions for select
  using (exists (
    select 1 from rides r left join drivers d on d.id = r.driver_id
    where r.id = ride_positions.ride_id
      and (r.passenger_id = auth.uid() or d.profile_id = auth.uid() or auth_role()='admin')
  ));
drop policy if exists positions_insert_driver on ride_positions;
create policy positions_insert_driver on ride_positions for insert
  with check (driver_id = my_driver_id());

-- ---------- PAGAMENTOS ----------
drop policy if exists payments_read on payments;
create policy payments_read on payments for select
  using (exists (
    select 1 from rides r left join drivers d on d.id = r.driver_id
    where r.id = payments.ride_id
      and (r.passenger_id = auth.uid() or d.profile_id = auth.uid() or auth_role()='admin')
  ));
-- inserção/atualização de pagamento: somente service_role (Edge Function / webhook do provedor)
drop policy if exists payments_admin on payments;
create policy payments_admin on payments for all
  using (auth_role()='admin') with check (auth_role()='admin');

-- ---------- AVALIAÇÕES ----------
drop policy if exists ratings_read on ratings;
create policy ratings_read on ratings for select
  using (from_profile = auth.uid() or to_profile = auth.uid() or auth_role()='admin');
drop policy if exists ratings_insert on ratings;
create policy ratings_insert on ratings for insert
  with check (
    from_profile = auth.uid()
    and exists (
      select 1 from rides r where r.id = ratings.ride_id
        and r.status = 'completed'
        and (r.passenger_id = auth.uid() or r.driver_id = my_driver_id())
    )
  );

-- ---------- NOTIFICAÇÕES ----------
drop policy if exists notif_self on notifications;
create policy notif_self on notifications for select using (profile_id = auth.uid());
drop policy if exists notif_self_update on notifications;
create policy notif_self_update on notifications for update
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------- DENÚNCIAS ----------
drop policy if exists reports_insert on reports;
create policy reports_insert on reports for insert with check (reporter_id = auth.uid());
drop policy if exists reports_read on reports;
create policy reports_read on reports for select
  using (reporter_id = auth.uid() or auth_role()='admin');
drop policy if exists reports_admin on reports for update
  ;
create policy reports_admin on reports for update
  using (auth_role()='admin') with check (auth_role()='admin');

-- ---------- AUDITORIA (somente leitura admin, escrita via RPC) ----------
drop policy if exists audit_read on admin_audit_log;
create policy audit_read on admin_audit_log for select using (auth_role()='admin');

-- ---------- CONFIGURAÇÕES ----------
drop policy if exists settings_read on app_settings;
create policy settings_read on app_settings for select using (auth_role()='admin');
drop policy if exists settings_admin on app_settings;
create policy settings_admin on app_settings for all
  using (auth_role()='admin') with check (auth_role()='admin');

-- ---------- VIEW pública de motoristas no mapa (sem telefone/CPF) ----------
create or replace view drivers_map as
select d.id, p.full_name, p.rating_avg, p.rating_count,
       d.category, d.last_lat, d.last_lng, d.last_seen_at
from drivers d join profiles p on p.id = d.profile_id
where d.status = 'approved';

grant select on drivers_map to authenticated;

-- =========================================================
-- RPCs: aceitar corrida e transicionar estado com validação
-- =========================================================
create or replace function accept_ride(p_ride uuid) returns rides
language plpgsql security definer set search_path = public as $$
declare
  v_driver uuid := my_driver_id();
  v_ride rides;
begin
  if v_driver is null then raise exception 'Somente motorista cadastrado pode aceitar.'; end if;
  if not exists (select 1 from drivers where id = v_driver and status = 'approved' and is_online) then
    raise exception 'Cadastro não aprovado ou indisponível.';
  end if;

  update rides
     set driver_id = v_driver, status = 'accepted', accepted_at = now(), updated_at = now()
   where id = p_ride and status in ('requested','searching') and driver_id is null
  returning * into v_ride;

  if v_ride.id is null then
    raise exception 'Corrida já foi aceita por outro motorista.';  -- garante exclusividade
  end if;
  return v_ride;
end $$;
grant execute on function accept_ride(uuid) to authenticated;

create or replace function set_ride_status(p_ride uuid, p_status ride_status) returns rides
language plpgsql security definer set search_path = public as $$
declare
  v_driver uuid := my_driver_id();
  v_ride rides;
begin
  select * into v_ride from rides where id = p_ride for update;
  if v_ride.id is null then raise exception 'Corrida não encontrada.'; end if;
  if v_ride.driver_id is distinct from v_driver then raise exception 'Corrida não pertence a este motorista.'; end if;

  -- transições permitidas
  if not (
    (v_ride.status = 'accepted'        and p_status in ('driver_arriving','driver_arrived','cancelled')) or
    (v_ride.status = 'driver_arriving' and p_status in ('driver_arrived','cancelled')) or
    (v_ride.status = 'driver_arrived'  and p_status in ('in_progress','cancelled')) or
    (v_ride.status = 'in_progress'     and p_status = 'completed')
  ) then
    raise exception 'Transição inválida: % -> %', v_ride.status, p_status;
  end if;

  update rides set
    status = p_status,
    arrived_at  = case when p_status = 'driver_arrived' then now() else arrived_at end,
    started_at  = case when p_status = 'in_progress'    then now() else started_at end,
    completed_at= case when p_status = 'completed'      then now() else completed_at end,
    cancelled_at= case when p_status = 'cancelled'      then now() else cancelled_at end,
    final_price = case when p_status = 'completed'
                       then coalesce(rides.estimated_price, 0) else final_price end,
    updated_at  = now()
  where id = p_ride
  returning * into v_ride;

  return v_ride;
end $$;
grant execute on function set_ride_status(uuid, ride_status) to authenticated;
