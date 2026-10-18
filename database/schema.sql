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
  check (
    (status = 'in_progress' and outcome is null and ended_at is null)
    or (status = 'completed' and last_stage = 8 and outcome is not null and ended_at is not null)
    or (status = 'ended_early' and last_stage between 1 and 7 and outcome is not null and ended_at is not null)
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
  outcome_key text not null check (outcome_key ~ '^[a-z0-9_]{1,40}$'),
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

alter table calls enable row level security;
alter table stage_results enable row level security;
alter table ai_suggestions enable row level security;

revoke all on calls, stage_results, ai_suggestions from anon, authenticated;
