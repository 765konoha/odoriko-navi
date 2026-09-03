-- =========================================================
-- リハーサル日程と出欠
--
-- 出欠の正はエントリーフォーム(スプレッドシート)のままとし、
-- アプリからは回答させない。二重管理を避けるため、アプリは
-- 「フォームで出した回答を当日その場で確認する」用途に限定する。
-- そのため出欠の書き込みは管理者(貼り付け取り込み)だけが行う。
-- =========================================================

create table rehearsals (
  id            uuid primary key default gen_random_uuid(),
  festival_id   uuid not null references festivals(id) on delete cascade,
  -- 目的。例「踊りこみ、固め」
  title         text not null,
  starts_at     timestamptz not null,
  -- 「20:30〜23」のように終わりが曖昧なことがあるため任意
  ends_at       timestamptz,
  venue_name    text not null,
  -- 施設の公式ページ・住所は任意(名前だけ分かれば足りる運用)
  venue_url     text,
  venue_address text,
  -- 特記事項。例「※17時過ぎから本番なので早めに終わる」
  note          text,
  is_cancelled  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_rehearsals_festival on rehearsals (festival_id, starts_at);

-- =========================================================
-- 出欠(リハ × シリアル)
-- 遅刻・早退の時刻は「19:30in」「20:15イン」など表記がばらつくため、
-- 時刻として解釈せず文字列のまま保持する。
-- =========================================================

create table rehearsal_attendances (
  rehearsal_id uuid not null references rehearsals(id) on delete cascade,
  serial       text not null references participants(serial) on delete cascade,
  status       text not null check (status in
                 ('present','late','leave_early','late_leave_early','absent')),
  time_note    text,
  updated_at   timestamptz not null default now(),
  primary key (rehearsal_id, serial)
);

create index idx_rehearsal_attendances_serial on rehearsal_attendances (serial);

comment on table rehearsal_attendances is
  'リハの出欠。正はエントリーフォームで、管理画面からの貼り付け取り込みで更新する。';

-- =========================================================
-- RLS(既存方針: anon=SELECTのみ / authenticated=全操作)
-- =========================================================

alter table rehearsals enable row level security;
alter table rehearsal_attendances enable row level security;

create policy "anon read rehearsals"
  on rehearsals for select to anon using (true);
create policy "authenticated manage rehearsals"
  on rehearsals for all to authenticated using (true) with check (true);

create policy "anon read rehearsal_attendances"
  on rehearsal_attendances for select to anon using (true);
create policy "authenticated manage rehearsal_attendances"
  on rehearsal_attendances for all to authenticated using (true) with check (true);
