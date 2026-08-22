-- 荷物グループ管理
-- SQL Editor に貼り付けて Run してください。
-- (アプリの新バージョンをデプロイする前に実行してください。実行しても表示は変わりません)

-- 荷物グループ(祭りごと。役職とは独立)
create table baggage_groups (
  id          uuid primary key default gen_random_uuid(),
  festival_id uuid not null references festivals(id) on delete cascade,
  -- グループ識別子は文字列(「3」のほか将来「A」「地方車1」等も可)
  group_code  text not null,
  -- 荷物リーダー(参加者削除・一括削除時は自動で未設定に戻る)
  leader_participant_id uuid references festival_participants(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (festival_id, group_code)
);

create index idx_baggage_groups_festival on baggage_groups (festival_id);

-- 参加者の所属グループ(1人につき最大1グループを列で保証。
-- グループ削除時は on delete set null で自動的に未配属へ戻る)
alter table festival_participants
  add column baggage_group_id uuid references baggage_groups(id) on delete set null;

-- RLS(既存方針: anon=SELECTのみ / authenticated=全操作)
alter table baggage_groups enable row level security;

create policy "anon read baggage_groups"
  on baggage_groups for select to anon using (true);

create policy "admin all baggage_groups"
  on baggage_groups for all to authenticated using (true) with check (true);
