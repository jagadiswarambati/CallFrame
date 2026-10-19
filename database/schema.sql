-- ============================================================================
-- Callframe database schema (Supabase PostgreSQL)
--
-- HOW TO RUN
--   1. BEFORE RUNNING: replace the password CHANGE_ME_BEFORE_RUNNING (in the
--      "create role" block just below this header) with a long random password of your own.
--      The script refuses to create the role while the placeholder is unchanged.
--   2. Open Supabase -> SQL Editor -> New query, paste this whole file, Run once.
--      It is written for a FRESH project. It is safe to re-run, but "create table
--      if not exists" will NOT alter tables that already exist with an older shape.
--   3. Point the backend DATABASE_URL at the callframe_api role (never at postgres).
--      On the Supabase pooler the user name is  callframe_api.<project-ref>.
--      The password lives only in the backend environment (Render), never in git.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Application role used by the backend (least privilege, subject to RLS).
-- Created first so a forgotten password edit aborts before any table is made.
-- Table grants and RLS policies for it are at the bottom of this file.
-- ----------------------------------------------------------------------------
do $$
declare
  v_password constant text := 'CHANGE_ME_BEFORE_RUNNING';
begin
  if not exists (select 1 from pg_roles where rolname = 'callframe_api') then
    if v_password = 'CHANGE_ME_BEFORE_RUNNING' then
      raise exception 'Edit this script first: replace CHANGE_ME_BEFORE_RUNNING with your own password.';
    end if;
    execute format('create role callframe_api login password %L', v_password);
  end if;
end
$$;

create extension if not exists pgcrypto;

create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  prospect_name text not null check (char_length(prospect_name) <= 4000),
  company text not null check (char_length(company) <= 4000),
  prospect_role text check (prospect_role is null or char_length(prospect_role) <= 4000),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'ended_early')),
  last_stage smallint not null default 1 check (last_stage between 1 and 8),
  outcome text check (
    outcome is null or outcome in (
      'next_step_set', 'document_requested', 'callback_requested', 'referred',
      'declined', 'wrong_contact', 'no_contact', 'do_not_call'
    )
  ),
  next_step_type text check (
    next_step_type is null or next_step_type in ('call', 'meeting', 'document', 'referral')
  ),
  next_step_channel text check (
    next_step_channel is null or char_length(next_step_channel) <= 4000
  ),
  next_step_when text check (
    next_step_when is null or char_length(next_step_when) <= 4000
  ),
  next_step_detail text check (
    next_step_detail is null or char_length(next_step_detail) <= 4000
  ),
  do_not_call boolean not null default false,
  dnc_words text check (dnc_words is null or char_length(dnc_words) <= 4000),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint calls_prospect_name_not_blank check (length(btrim(prospect_name)) > 0),
  constraint calls_company_not_blank check (length(btrim(company)) > 0),
  -- A closed call is 'completed' only if it reached stage 8, otherwise 'ended_early'.
  -- last_stage is the highest stage reached (the API stores GREATEST(last_stage, ended_stage)).
  constraint calls_status_consistent check (
    (status = 'in_progress' and outcome is null and ended_at is null)
    or (
      status in ('completed', 'ended_early')
      and outcome is not null
      and ended_at is not null
      and (status = 'completed') = (last_stage = 8)
    )
  ),
  check (do_not_call = coalesce(outcome = 'do_not_call', false)),
  check (
    outcome is distinct from 'do_not_call'
    or (
      nullif(btrim(dnc_words), '') is not null
      and next_step_type is null
      and next_step_channel is null
      and next_step_when is null
      and next_step_detail is null
    )
  ),
  check (
    outcome is distinct from 'next_step_set'
    or (
      next_step_type in ('call', 'meeting')
      and nullif(btrim(next_step_when), '') is not null
    )
  ),
  check (
    outcome is distinct from 'document_requested'
    or (
      next_step_type = 'document'
      and nullif(btrim(next_step_channel), '') is not null
    )
  ),
  check (
    outcome is distinct from 'callback_requested'
    or (
      next_step_type = 'call'
      and nullif(btrim(next_step_when), '') is not null
    )
  ),
  check (
    outcome is distinct from 'referred'
    or (
      next_step_type = 'referral'
      and nullif(btrim(next_step_detail), '') is not null
    )
  )
);

create table if not exists stage_results (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls(id) on delete cascade,
  stage smallint not null check (stage between 1 and 8),
  revision integer not null check (revision > 0),
  outcome_key text check (outcome_key is null or outcome_key ~ '^[a-z0-9_]{1,40}$'),
  prospect_words text not null default '' check (char_length(prospect_words) <= 4000),
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  unique (call_id, stage, revision)
);

create table if not exists ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls(id) on delete cascade,
  stage smallint not null check (stage between 1 and 8),
  model text not null check (char_length(model) <= 200),
  suggestion text not null check (char_length(suggestion) <= 4000),
  created_at timestamptz not null default now()
);

create index if not exists calls_started_at_idx
  on calls (started_at desc);

create index if not exists stage_results_call_stage_revision_idx
  on stage_results (call_id, stage, revision);

create index if not exists calls_do_not_call_lookup_idx
  on calls (lower(btrim(company)), lower(btrim(prospect_name)))
  where do_not_call;

alter table calls enable row level security;
alter table stage_results enable row level security;
alter table ai_suggestions enable row level security;

revoke all on calls, stage_results, ai_suggestions from anon, authenticated;

grant usage on schema public to callframe_api;
grant select, insert, update on calls to callframe_api;
grant select, insert on stage_results to callframe_api;
grant select, insert on ai_suggestions to callframe_api;

-- RLS stays enabled on every table. These policies let only callframe_api in;
-- anon/authenticated have no grants and no policy. The grants above (not the
-- policies) are what stop callframe_api from deleting rows.
drop policy if exists callframe_api_access on calls;
create policy callframe_api_access on calls
  for all to callframe_api using (true) with check (true);

drop policy if exists callframe_api_access on stage_results;
create policy callframe_api_access on stage_results
  for all to callframe_api using (true) with check (true);

drop policy if exists callframe_api_access on ai_suggestions;
create policy callframe_api_access on ai_suggestions
  for all to callframe_api using (true) with check (true);
