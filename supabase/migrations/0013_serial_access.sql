-- =========================================================
-- 利用状況(シリアル単位)の記録
-- 「誰がアプリを入れて使い始めたか」を運営が Supabase 上で確認するための緩い記録。
-- 本人認証ではないため、あくまで目安として扱う。
-- 画面表示は行わず、SQL エディタ/テーブルエディタから確認する想定。
-- =========================================================

create table serial_access (
  serial        text primary key references participants(serial) on delete cascade,
  -- 初回にシリアルを選んでアプリを開いた時刻
  first_seen_at timestamptz not null default now(),
  -- 最後にアプリを開いた時刻(クライアント側で数時間に1回だけ記録)
  last_seen_at  timestamptz not null default now(),
  -- ホーム画面のアイコン(スタンドアロン)から開いたことがあるか = 実質のインストール済み判定
  installed     boolean not null default false,
  installed_at  timestamptz,
  -- 最後に開いたときの祭り・端末種別(参考情報)
  last_festival_slug text,
  last_platform text,
  -- 記録された回数(数時間に1回までなので厳密な起動回数ではない)
  access_count  integer not null default 1
);

comment on table serial_access is
  '踊り子アプリの利用状況(シリアル単位)。installed=true はホーム画面から起動した実績があることを示す。';

-- =========================================================
-- 記録用 RPC
-- テーブルへの直接書き込みは anon に許可せず、この関数経由のみとする。
-- 参加者マスターに無いシリアルは黙って無視する(アプリ側の動作は止めない)。
-- =========================================================

create or replace function record_serial_access(
  p_serial        text,
  p_festival_slug text default null,
  p_installed     boolean default false,
  p_platform      text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_serial is null or btrim(p_serial) = '' then
    return;
  end if;
  if not exists (select 1 from participants where serial = p_serial) then
    return;
  end if;

  insert into serial_access as s (
    serial, installed, installed_at, last_festival_slug, last_platform
  )
  values (
    p_serial,
    coalesce(p_installed, false),
    case when coalesce(p_installed, false) then now() end,
    p_festival_slug,
    left(p_platform, 32)
  )
  on conflict (serial) do update set
    last_seen_at       = now(),
    access_count       = s.access_count + 1,
    -- 一度でもホーム画面から開いていれば true のまま
    installed          = s.installed or excluded.installed,
    installed_at       = coalesce(s.installed_at, excluded.installed_at),
    last_festival_slug = coalesce(excluded.last_festival_slug, s.last_festival_slug),
    last_platform      = coalesce(excluded.last_platform, s.last_platform);
end;
$$;

revoke all on function record_serial_access(text, text, boolean, text) from public;
grant execute on function record_serial_access(text, text, boolean, text)
  to anon, authenticated;

-- =========================================================
-- 確認用ビュー(祭りの参加者 × 利用状況)
--   例) 原宿でまだ入れていない人を出す:
--     select * from participant_access_status
--      where festival_slug = 'harajuku-2026' and not installed
--      order by serial;
-- =========================================================

create or replace view participant_access_status as
select
  f.slug                            as festival_slug,
  fp.serial,
  fp.name,
  fp.nickname,
  (a.serial is not null)            as opened,     -- シリアルを選んでアプリを開いた
  coalesce(a.installed, false)      as installed,  -- ホーム画面から起動した実績あり
  a.first_seen_at,
  a.last_seen_at,
  a.access_count,
  a.last_platform
from festival_participants fp
join festivals f on f.id = fp.festival_id
left join serial_access a on a.serial = fp.serial;

comment on view participant_access_status is
  '祭りの参加者ごとの利用状況。installed=false は未インストール(またはブラウザのまま利用)の目安。';

-- =========================================================
-- RLS(既存方針: anon=SELECTのみ / authenticated=全操作)
-- serial_access は個人の利用状況のため anon には読ませない。
-- =========================================================

alter table serial_access enable row level security;

create policy "authenticated manage serial_access"
  on serial_access for all to authenticated using (true) with check (true);

-- ビューは所有者権限で動くため RLS を通らない。anon からは参照させない
revoke all on serial_access from anon;
revoke all on participant_access_status from anon;
