-- =========================================================
-- 役職「歌い手・煽り」を「歌い手」と「煽り」に分ける
--
-- 別の人が担当するため、役職を分ける。
-- 既存の祭りでは、今の役職を「歌い手」に名前を変え、「煽り」を足す。
-- 今「歌い手・煽り」が付いている人・予定・お知らせには両方を付けるので、
-- 流した直後は誰に何が見えるかは変わらない。
-- 歌い手だけ・煽りだけの人は、祭りの「参加者」で不要な方を外す。
--
-- 役職の id は変えない(名前を変えるだけ)ので、古い版のアプリもそのまま動く。
-- 何度流してもよい(「歌い手・煽り」が残っていなければ何もしない)。
-- =========================================================

-- 「歌い手・煽り」より後ろの役職を1つずつ後ろへずらし、すぐ後ろに「煽り」を置く
update festival_roles r
  set sort_order = r.sort_order + 1
  from festival_roles s
  where s.festival_id = r.festival_id
    and s.name = '歌い手・煽り'
    and r.sort_order > s.sort_order;

insert into festival_roles (festival_id, name, is_default, sort_order)
  select festival_id, '煽り', false, sort_order + 1
  from festival_roles
  where name = '歌い手・煽り'
on conflict (festival_id, name) do nothing;

-- 今「歌い手・煽り」が付いているものに「煽り」も付ける
insert into festival_participant_roles (festival_participant_id, role_id)
  select pr.festival_participant_id, a.id
  from festival_participant_roles pr
  join festival_roles s on s.id = pr.role_id and s.name = '歌い手・煽り'
  join festival_roles a on a.festival_id = s.festival_id and a.name = '煽り'
on conflict do nothing;

insert into schedule_item_roles (schedule_item_id, role_id)
  select sr.schedule_item_id, a.id
  from schedule_item_roles sr
  join festival_roles s on s.id = sr.role_id and s.name = '歌い手・煽り'
  join festival_roles a on a.festival_id = s.festival_id and a.name = '煽り'
on conflict do nothing;

insert into announcement_roles (announcement_id, role_id)
  select ar.announcement_id, a.id
  from announcement_roles ar
  join festival_roles s on s.id = ar.role_id and s.name = '歌い手・煽り'
  join festival_roles a on a.festival_id = s.festival_id and a.name = '煽り'
on conflict do nothing;

-- 最後に名前を変える(同じ祭りに「歌い手」が既にあれば変えない)
update festival_roles s
  set name = '歌い手'
  where s.name = '歌い手・煽り'
    and not exists (
      select 1 from festival_roles x
      where x.festival_id = s.festival_id and x.name = '歌い手'
    );
