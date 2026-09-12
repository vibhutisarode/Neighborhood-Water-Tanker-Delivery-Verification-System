alter table public.deliveries
  add column if not exists off_hours boolean not null default false,
  add column if not exists volume_mismatch boolean not null default false,
  add column if not exists risk_score integer not null default 0 check (risk_score between 0 and 100),
  add column if not exists risk_level text not null default 'LOW' check (risk_level in ('LOW', 'MEDIUM', 'HIGH')),
  add column if not exists driver_note text;

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.users where id = auth.uid() and role = 'MANAGER') $$;

create or replace function public.delivery_risk(p_duplicate boolean, p_mismatch boolean, p_off_hours boolean, p_frequent boolean)
returns table(score integer, level text)
language sql immutable
as $$
  select least(100, (case when p_duplicate then 30 else 0 end) + (case when p_mismatch then 25 else 0 end) + (case when p_off_hours then 20 else 0 end) + (case when p_frequent then 15 else 0 end)),
  case when least(100, (case when p_duplicate then 30 else 0 end) + (case when p_mismatch then 25 else 0 end) + (case when p_off_hours then 20 else 0 end) + (case when p_frequent then 15 else 0 end)) >= 60 then 'HIGH'
       when least(100, (case when p_duplicate then 30 else 0 end) + (case when p_mismatch then 25 else 0 end) + (case when p_off_hours then 20 else 0 end) + (case when p_frequent then 15 else 0 end)) >= 30 then 'MEDIUM'
       else 'LOW' end
$$;

create or replace function public.submit_delivery(
  p_delivery_id uuid, p_tanker_number text, p_driver_name text, p_block_id uuid,
  p_claimed_volume_liters integer, p_meter_reading integer, p_photo_path text, p_driver_note text default null
) returns public.deliveries
language plpgsql security definer set search_path = public
as $$
declare
  v_tanker_id uuid;
  v_window_start time;
  v_window_end time;
  v_submitted timestamptz := now();
  v_duplicate boolean;
  v_mismatch boolean := abs(p_claimed_volume_liters - p_meter_reading) > greatest(100, round(p_claimed_volume_liters * 0.15));
  v_off_hours boolean := false;
  v_frequent boolean;
  v_risk record;
  v_delivery public.deliveries;
begin
  select id into v_tanker_id from public.tankers where tanker_number = p_tanker_number and active = true;
  if v_tanker_id is null then raise exception 'Tanker not found or inactive'; end if;
  select delivery_window_start, delivery_window_end into v_window_start, v_window_end from public.blocks where id = p_block_id and active = true;
  if not found then raise exception 'Block not found or inactive'; end if;
  if v_window_start is not null and v_window_end is not null then
    v_off_hours := case when v_window_start <= v_window_end then (timezone('Asia/Kolkata', v_submitted)::time not between v_window_start and v_window_end) else (timezone('Asia/Kolkata', v_submitted)::time not >= v_window_start and timezone('Asia/Kolkata', v_submitted)::time not <= v_window_end) end;
  end if;
  select exists (select 1 from public.deliveries d where d.tanker_id = v_tanker_id and d.block_id = p_block_id and d.submitted_at >= v_submitted - interval '30 minutes') into v_duplicate;
  select count(*) >= 2 into v_frequent from public.deliveries d where d.tanker_id = v_tanker_id and d.submitted_at >= v_submitted - interval '2 hours';
  select * into v_risk from public.delivery_risk(v_duplicate, v_mismatch, v_off_hours, v_frequent);
  insert into public.deliveries (id, tanker_id, driver_name, block_id, claimed_volume_liters, meter_reading, photo_url, possible_duplicate, off_hours, volume_mismatch, risk_score, risk_level, driver_note, submitted_at)
  values (p_delivery_id, v_tanker_id, p_driver_name, p_block_id, p_claimed_volume_liters, p_meter_reading, p_photo_path, v_duplicate, v_off_hours, v_mismatch, v_risk.score, v_risk.level, p_driver_note, v_submitted)
  returning * into v_delivery;
  insert into public.audit_events (delivery_id, actor_id, action, metadata) values (v_delivery.id, auth.uid(), 'DELIVERY_CREATED', jsonb_build_object('photo_path', p_photo_path, 'risk_score', v_risk.score));
  insert into public.audit_events (delivery_id, actor_id, action) values (v_delivery.id, auth.uid(), 'PHOTO_UPLOADED');
  return v_delivery;
end
$$;

create or replace function public.verify_delivery(p_delivery_id uuid, p_comment text default null) returns public.deliveries
language plpgsql security definer set search_path = public
as $$
declare v_delivery public.deliveries;
begin
  if not public.is_manager() then raise exception 'Manager authentication required'; end if;
  update public.deliveries set status = 'VERIFIED', verified_at = now(), verified_by = auth.uid(), updated_at = now() where id = p_delivery_id and status = 'PENDING' returning * into v_delivery;
  if v_delivery.id is null then raise exception 'Pending delivery not found'; end if;
  insert into public.audit_events (delivery_id, actor_id, action, comment) values (p_delivery_id, auth.uid(), 'DELIVERY_REVIEWED', p_comment);
  insert into public.audit_events (delivery_id, actor_id, action, comment) values (p_delivery_id, auth.uid(), 'DELIVERY_VERIFIED', p_comment);
  return v_delivery;
end
$$;

create or replace function public.dispute_delivery(p_delivery_id uuid, p_reason text, p_comment text) returns public.deliveries
language plpgsql security definer set search_path = public
as $$
declare v_delivery public.deliveries;
begin
  if not public.is_manager() then raise exception 'Manager authentication required'; end if;
  update public.deliveries set status = 'DISPUTED', disputed_at = now(), disputed_by = auth.uid(), dispute_reason = p_reason, manager_comment = p_comment, updated_at = now() where id = p_delivery_id and status = 'PENDING' returning * into v_delivery;
  if v_delivery.id is null then raise exception 'Pending delivery not found'; end if;
  insert into public.audit_events (delivery_id, actor_id, action, comment, metadata) values (p_delivery_id, auth.uid(), 'DELIVERY_REVIEWED', p_comment, jsonb_build_object('reason', p_reason));
  insert into public.audit_events (delivery_id, actor_id, action, comment, metadata) values (p_delivery_id, auth.uid(), 'DELIVERY_DISPUTED', p_comment, jsonb_build_object('reason', p_reason));
  return v_delivery;
end
$$;

create or replace view public.public_supply_today as
select b.id, b.name, b.daily_quota_liters, coalesce(sum(d.claimed_volume_liters) filter (where d.status = 'VERIFIED' and d.submitted_at::date = current_date), 0)::integer as verified_volume_liters,
coalesce(sum(d.claimed_volume_liters) filter (where d.status = 'PENDING' and d.submitted_at::date = current_date), 0)::integer as under_review_liters,
max(d.verified_at) filter (where d.status = 'VERIFIED' and d.submitted_at::date = current_date) as last_verified_at
from public.blocks b left join public.deliveries d on d.block_id = b.id where b.active group by b.id, b.name, b.daily_quota_liters;

grant select on public.public_supply_today to anon, authenticated;

insert into storage.buckets (id, name, public) values ('delivery-evidence', 'delivery-evidence', false) on conflict (id) do nothing;
create policy "authenticated users upload delivery evidence" on storage.objects for insert to authenticated with check (bucket_id = 'delivery-evidence');
create policy "managers read delivery evidence" on storage.objects for select to authenticated using (bucket_id = 'delivery-evidence' and public.is_manager());
