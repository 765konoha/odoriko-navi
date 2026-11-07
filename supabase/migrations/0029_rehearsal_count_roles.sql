-- =========================================================
-- リハの出欠集計に入れる役職を決められるようにする
--
-- リハの出欠(参加 n / 全員 m 人・未回答)を祭りの名簿の全員で数えていたため、
-- リハに出ないマネージャーなどが「未回答」に入っていた。
-- 役職ごとに「リハ集計に含める」を持たせ、その役職が付いている人だけを数える。
--
-- 初めて流したときは「踊り子一般」(既定の役職)と「リーダー」だけを含める。
-- 変えたいときは祭りの「参加者」→「役職」で切り替える。
--
-- default 付きの列を足すだけなので、古い版のアプリもそのまま動く。
-- 何度流してもよい(2回目以降は、画面で切り替えた設定を変えない)。
-- =========================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'festival_roles'
      and column_name = 'counts_in_rehearsal'
  ) then
    alter table festival_roles
      add column counts_in_rehearsal boolean not null default false;
    update festival_roles
      set counts_in_rehearsal = true
      where is_default or name = 'リーダー';
  end if;
end $$;

comment on column festival_roles.counts_in_rehearsal is
  'リハの出欠集計に含める役職か(この役職が付いている人を数える)';
