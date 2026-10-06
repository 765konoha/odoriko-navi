-- =========================================================
-- 小道具を複数人で持てるようにする
--
-- 1つの小道具を2人以上で持つ(家族で預かる・2人で使う大きな道具など)
-- ことがある。持っている人どうしに「どちらが主」という区別はない。
--
--   * 持っている人は 0人以上。既存の小道具は今の保有者1人のまま
--   * 設定するのは小道具担当(管理画面)。履歴に残す
--   * 持っている人は全員、その小道具を「保管中」として見られ、
--     次の受け渡しを「渡す予定」で見られ、受け渡し先も変えられる
--   * 受け渡しが完了したら、受け取った人だけが持っている状態になる
--
-- 受け渡しの記録(prop_transfers.from_serial)は1人しか持てないため、
-- DB の中では持っている人のうち1人を prop_items.current_holder_serial に、
-- 残りを prop_item_co_holders に置く。どちらに置かれているかで扱いを
-- 変えることはしない(画面にも出さない)。
--
-- 既存の RPC は引数を変えずに置き換える(古い版のアプリもそのまま動く)。
-- =========================================================

create table prop_item_co_holders (
  prop_item_id uuid not null references prop_items(id) on delete cascade,
  serial       text not null references participants(serial) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (prop_item_id, serial)
);

create index idx_prop_item_co_holders_serial on prop_item_co_holders (serial);

comment on table prop_item_co_holders is
  '小道具を一緒に持っている人(prop_items.current_holder_serial 以外)。受け渡しの完了で外れる';

alter table prop_item_co_holders enable row level security;
create policy "anon read prop_item_co_holders"
  on prop_item_co_holders for select to anon using (true);
create policy "admin all prop_item_co_holders"
  on prop_item_co_holders for all to authenticated using (true) with check (true);

-- 履歴に「一緒に持つ人の変更」を足す
alter table prop_history drop constraint prop_history_action_check;
alter table prop_history add constraint prop_history_action_check
  check (action in (
    'item_created','transfer_created','transfer_target_changed',
    'transfer_completed','transfer_cancelled','holder_changed_by_admin',
    'condition_changed','assignment_changed','transfer_schedule_changed',
    'co_holders_changed'));

-- 内部用: 持っている人全員(並びは記録用にシリアル順)
create or replace function prop_holders(p_item_id uuid)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(s order by s), '{}') from (
    select current_holder_serial as s from prop_items
     where id = p_item_id and current_holder_serial is not null
    union
    select serial from prop_item_co_holders where prop_item_id = p_item_id
  ) h;
$$;

revoke all on function prop_holders(uuid) from public, anon, authenticated;

-- =========================================================
-- 内部用: 一緒に持っている人を外して履歴に残す(外す人がいなければ何もしない)
-- p_only を渡すとその人だけを外す
-- =========================================================

create or replace function prop_drop_co_holders(
  p_item_id uuid,
  p_note    text,
  p_actor_serial text default null,
  p_actor_is_admin boolean default false,
  p_only    text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_before text;
  v_after  text;
begin
  select string_agg(serial, ',' order by serial) into v_before
    from prop_item_co_holders where prop_item_id = p_item_id;
  if v_before is null then
    return;
  end if;

  delete from prop_item_co_holders
   where prop_item_id = p_item_id
     and (p_only is null or serial = p_only);
  if not found then
    return;
  end if;

  select string_agg(serial, ',' order by serial) into v_after
    from prop_item_co_holders where prop_item_id = p_item_id;
  insert into prop_history
    (prop_item_id, action, actor_serial, actor_is_admin, from_value, to_value, note)
    values (p_item_id, 'co_holders_changed', p_actor_serial, p_actor_is_admin,
            v_before, v_after, p_note);
end $$;

revoke all on function prop_drop_co_holders(uuid, text, text, boolean, text)
  from public, anon, authenticated;

-- =========================================================
-- RPC: 持っている人の設定(管理者のみ)
-- 渡した一覧で置き換える。空の一覧なら保有者なし
--
-- 受け渡し予定の扱い:
--   * 一覧に今の持ち主が1人でも残る → 小道具はまだその人の手元にあるので
--     予定は残す(DB 上の出し手が外れたなら、残った人に付け替える)
--   * 全員入れ替わる・空にする → 予定は前提が崩れるのでキャンセルする
-- =========================================================

create or replace function prop_admin_set_holders(
  p_item_id uuid,
  p_serials text[],
  p_note    text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_item  prop_items;
  v_new   text[];
  v_old   text[];
  v_rep   text;
  v_bad   text;
  v_head  prop_transfers;
  v_t     prop_transfers;
  v_keep  boolean;
begin
  if auth.uid() is null then
    raise exception '権限がありません。';
  end if;
  select * into v_item from prop_items where id = p_item_id for update;
  if not found then
    raise exception '小道具が見つかりません。最新情報を取得してください。';
  end if;

  -- 空・重複を除き、シリアル順にそろえる
  select coalesce(array_agg(distinct btrim(s) order by btrim(s)), '{}') into v_new
    from unnest(coalesce(p_serials, '{}')) as s
   where s is not null and btrim(s) <> '';
  select s into v_bad from unnest(v_new) as s
   where not exists (select 1 from participants p where p.serial = s)
   limit 1;
  if v_bad is not null then
    raise exception '指定したシリアル「%」が見つかりません。', v_bad;
  end if;

  v_old := prop_holders(p_item_id);
  if v_old = v_new then
    return;
  end if;

  -- DB 上の出し手は、今の人が残るならそのまま。外れたら一覧の先頭
  v_rep := case
    when v_item.current_holder_serial = any (v_new) then v_item.current_holder_serial
    else v_new[1]
  end;

  -- 今の持ち主が1人でも残るなら、受け渡し予定は残す
  v_keep := cardinality(v_new) > 0 and v_old && v_new;
  if v_keep and v_rep is distinct from v_item.current_holder_serial then
    select * into v_head from prop_transfers
     where id = prop_head_transfer(p_item_id) for update;
    if found then
      if v_head.to_serial = any (v_new) then
        -- 受け取る予定の人がすでに持っている側に入った → 予定は意味を失う
        v_keep := false;
      else
        update prop_transfers set from_serial = v_rep where id = v_head.id;
      end if;
    end if;
  end if;

  if not v_keep then
    for v_t in
      select * from prop_transfers
      where prop_item_id = p_item_id and status = 'pending' for update
    loop
      update prop_transfers
        set status = 'cancelled', cancelled_at = now(),
            cancelled_reason = '管理者による保有者変更のためキャンセル'
        where id = v_t.id;
      insert into prop_history
        (prop_item_id, transfer_id, action, actor_is_admin, from_value, to_value, note)
        values (p_item_id, v_t.id, 'transfer_cancelled', true,
                v_t.from_serial, v_t.to_serial, '管理者による保有者変更のためキャンセル');
    end loop;
  end if;

  update prop_items
    set current_holder_serial = v_rep, updated_at = now()
    where id = p_item_id;
  delete from prop_item_co_holders where prop_item_id = p_item_id;
  insert into prop_item_co_holders (prop_item_id, serial)
    select p_item_id, s from unnest(v_new) as s where s is distinct from v_rep;

  -- 変更前後は「,」でつないだシリアルの一覧で残す
  insert into prop_history
    (prop_item_id, action, actor_is_admin, from_value, to_value, note)
    values (p_item_id, 'holder_changed_by_admin', true,
            nullif(array_to_string(v_old, ','), ''),
            nullif(array_to_string(v_new, ','), ''), p_note);
end $$;

revoke all on function prop_admin_set_holders(uuid, text[], text) from public;
grant execute on function prop_admin_set_holders(uuid, text[], text) to authenticated;

-- =========================================================
-- RPC: 受け渡し予定の作成(0015 と同じ。一緒に持っている人へは作らない)
-- =========================================================

create or replace function prop_create_transfer(
  p_item_id      uuid,
  p_actor_serial text,
  p_to_serial    text,
  p_scheduled_at timestamptz default null,
  p_note         text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_item     prop_items;
  v_expected text;
  v_id       uuid;
begin
  select * into v_item from prop_items where id = p_item_id for update;
  if not found then
    raise exception '小道具が見つかりません。最新情報を取得してください。';
  end if;
  if v_item.is_archived then
    raise exception 'この小道具は利用終了しています。';
  end if;
  if v_item.condition in ('lost','retired') then
    raise exception 'この小道具は紛失・使用停止のため受け渡しを開始できません。';
  end if;

  v_expected := prop_expected_holder(p_item_id);
  if v_expected is null then
    raise exception '保有者が未設定のため受け渡しを開始できません。';
  end if;
  -- 鎖の末尾の受取者だけが次の受け渡しを作れる
  if v_expected is distinct from p_actor_serial then
    raise exception '受け渡しの順番が変わっています。最新情報を取得してください。';
  end if;
  if p_to_serial = p_actor_serial then
    raise exception '自分自身への受け渡しはできません。';
  end if;
  -- 今の持ち主からの受け渡しなら、一緒に持っている人へは渡せない
  if v_expected = v_item.current_holder_serial
     and p_to_serial = any (prop_holders(p_item_id)) then
    raise exception '一緒に持っている人には受け渡せません。';
  end if;
  if not exists (select 1 from participants where serial = p_to_serial) then
    raise exception '受け渡し先のシリアルが見つかりません。';
  end if;

  insert into prop_transfers
    (prop_item_id, from_serial, to_serial, scheduled_at, note, created_by_serial)
    values (p_item_id, p_actor_serial, p_to_serial, p_scheduled_at, p_note, p_actor_serial)
    returning id into v_id;

  insert into prop_history
    (prop_item_id, transfer_id, action, actor_serial, from_value, to_value, note)
    values (p_item_id, v_id, 'transfer_created', p_actor_serial,
            p_actor_serial, p_to_serial, p_note);
  return v_id;
end $$;

-- =========================================================
-- RPC: 受け渡し先の変更(0015 と同じ。今の持ち主からの受け渡しなら、
-- 一緒に持っている人の誰でも変えられる)
-- =========================================================

create or replace function prop_change_transfer_target(
  p_transfer_id    uuid,
  p_actor_serial   text,
  p_new_to_serial  text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_t    prop_transfers;
  v_item prop_items;
  v_from_holders boolean;
begin
  select * into v_t from prop_transfers where id = p_transfer_id for update;
  if not found or v_t.status <> 'pending' then
    raise exception '受け渡し情報が変更されています。最新情報を取得してください。';
  end if;
  select * into v_item from prop_items where id = v_t.prop_item_id for update;
  -- 今の持ち主(全員)からの受け渡しか
  v_from_holders := v_t.from_serial is not distinct from v_item.current_holder_serial;
  -- 変えられるのは、その受け渡しの渡す側の人
  if not (
    v_t.from_serial is not distinct from p_actor_serial
    or (v_from_holders and p_actor_serial = any (prop_holders(v_item.id)))
  ) then
    raise exception '小道具の状態が変更されています。最新情報を取得してください。';
  end if;
  -- 後続の予定があると、その出し手が食い違うため変更させない
  if exists (
    select 1 from prop_transfers t
     where t.prop_item_id = v_t.prop_item_id and t.status = 'pending'
       and t.created_at > v_t.created_at
  ) then
    raise exception 'この後に別の受け渡し予定があるため変更できません。小道具担当にご連絡ください。';
  end if;
  if p_new_to_serial = p_actor_serial then
    raise exception '自分自身への受け渡しはできません。';
  end if;
  if v_from_holders and p_new_to_serial = any (prop_holders(v_item.id)) then
    raise exception '一緒に持っている人には受け渡せません。';
  end if;
  if p_new_to_serial = v_t.to_serial then
    raise exception 'すでに同じ受け渡し先が設定されています。';
  end if;
  if not exists (select 1 from participants where serial = p_new_to_serial) then
    raise exception '受け渡し先のシリアルが見つかりません。';
  end if;

  insert into prop_history
    (prop_item_id, transfer_id, action, actor_serial, from_value, to_value)
    values (v_t.prop_item_id, v_t.id, 'transfer_target_changed', p_actor_serial,
            v_t.to_serial, p_new_to_serial);

  update prop_transfers set to_serial = p_new_to_serial where id = p_transfer_id;
end $$;

-- =========================================================
-- RPC: 受取完了(0015 と同じ。完了したら受け取った人だけが持つ)
-- =========================================================

create or replace function prop_complete_transfer(
  p_transfer_id  uuid,
  p_actor_serial text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_t    prop_transfers;
  v_item prop_items;
begin
  select * into v_t from prop_transfers where id = p_transfer_id for update;
  if not found or v_t.status <> 'pending' or v_t.to_serial is distinct from p_actor_serial then
    raise exception '受け渡し情報が変更されています。最新情報を取得してください。';
  end if;
  select * into v_item from prop_items where id = v_t.prop_item_id for update;
  -- 先に受け取る人がいる場合は、その受け渡しが終わるまで完了させない
  if prop_head_transfer(v_t.prop_item_id) is distinct from v_t.id then
    raise exception 'ひとつ前の受け渡しがまだ完了していません。';
  end if;
  -- 保有者が変わっていたら完了させない(管理者手動変更との競合対策)
  if v_item.current_holder_serial is distinct from v_t.from_serial then
    raise exception '小道具の状態が変更されています。最新情報を取得してください。';
  end if;

  update prop_transfers
    set status = 'completed', completed_at = now()
    where id = p_transfer_id;
  update prop_items
    set current_holder_serial = v_t.to_serial, updated_at = now()
    where id = v_item.id;
  insert into prop_history
    (prop_item_id, transfer_id, action, actor_serial, from_value, to_value)
    values (v_item.id, v_t.id, 'transfer_completed', p_actor_serial,
            v_t.from_serial, v_t.to_serial);

  perform prop_drop_co_holders(v_item.id, '受け渡しの完了により解除',
                               p_actor_serial, false);
end $$;

-- =========================================================
-- RPC: 運営による受取完了の代理報告(0016 と同じ。完了したら受け取った人だけが持つ)
-- =========================================================

create or replace function prop_admin_complete_transfer(
  p_transfer_id uuid,
  p_note        text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_t    prop_transfers;
  v_item prop_items;
begin
  if auth.uid() is null then
    raise exception '権限がありません。';
  end if;

  select * into v_t from prop_transfers where id = p_transfer_id for update;
  if not found or v_t.status <> 'pending' then
    raise exception '受け渡し情報が変更されています。最新情報を取得してください。';
  end if;
  select * into v_item from prop_items where id = v_t.prop_item_id for update;

  -- 順番を飛ばすと保有者の流れが崩れるため、鎖の先頭から順に完了させる
  if prop_head_transfer(v_t.prop_item_id) is distinct from v_t.id then
    raise exception 'ひとつ前の受け渡しがまだ完了していません。先にそちらを完了してください。';
  end if;
  -- 保有者が食い違う場合は、受け渡しではなく保有者変更で直すべき状態
  if v_item.current_holder_serial is distinct from v_t.from_serial then
    raise exception '小道具の状態が変更されています。保有者の変更から修正してください。';
  end if;

  update prop_transfers
    set status = 'completed', completed_at = now()
    where id = p_transfer_id;
  update prop_items
    set current_holder_serial = v_t.to_serial, updated_at = now()
    where id = v_item.id;
  insert into prop_history
    (prop_item_id, transfer_id, action, actor_is_admin, from_value, to_value, note)
    values (v_item.id, v_t.id, 'transfer_completed', true,
            v_t.from_serial, v_t.to_serial,
            coalesce(p_note, '運営による代理報告'));

  perform prop_drop_co_holders(v_item.id, '受け渡しの完了により解除',
                               null, true);
end $$;

-- =========================================================
-- RPC: 管理者による現在保有者の手動変更(0012 と同じ。古い版の管理画面用)
-- 新しい版の管理画面は prop_admin_set_holders を使う。
-- 一緒に持っている人はそのまま残す。ただし指定した人がその中に
-- いれば、二重にならないようその人を外す
-- =========================================================

create or replace function prop_admin_set_holder(
  p_item_id           uuid,
  p_new_holder_serial text,
  p_note              text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_item prop_items;
  v_t    prop_transfers;
begin
  if auth.uid() is null then
    raise exception '権限がありません。';
  end if;
  select * into v_item from prop_items where id = p_item_id for update;
  if not found then
    raise exception '小道具が見つかりません。最新情報を取得してください。';
  end if;
  if p_new_holder_serial is not null
     and not exists (select 1 from participants where serial = p_new_holder_serial) then
    raise exception '指定したシリアルが見つかりません。';
  end if;

  -- pending は自動キャンセル(保有者だけ変更して受け渡しを残さない)
  for v_t in
    select * from prop_transfers
    where prop_item_id = p_item_id and status = 'pending' for update
  loop
    update prop_transfers
      set status = 'cancelled', cancelled_at = now(),
          cancelled_reason = '管理者による保有者変更のためキャンセル'
      where id = v_t.id;
    insert into prop_history
      (prop_item_id, transfer_id, action, actor_is_admin, from_value, to_value, note)
      values (p_item_id, v_t.id, 'transfer_cancelled', true,
              v_t.from_serial, v_t.to_serial, '管理者による保有者変更のためキャンセル');
  end loop;

  update prop_items
    set current_holder_serial = p_new_holder_serial, updated_at = now()
    where id = p_item_id;
  insert into prop_history
    (prop_item_id, action, actor_is_admin, from_value, to_value, note)
    values (p_item_id, 'holder_changed_by_admin', true,
            v_item.current_holder_serial, p_new_holder_serial, p_note);

  if p_new_holder_serial is null then
    -- 保有者がいなくなったら、一緒に持っている人も外す
    perform prop_drop_co_holders(p_item_id, '保有者を未設定にしたため解除',
                                 null, true);
  else
    perform prop_drop_co_holders(p_item_id, '現在の保有者になったため解除',
                                 null, true, p_new_holder_serial);
  end if;
end $$;

-- =========================================================
-- シリアルの表記をそろえる関数(0023)に、一緒に持っている人の表を足す
-- =========================================================

create or replace function normalize_participant_serials(p_apply boolean default false)
returns table (old_serial text, new_serial text, result text)
language plpgsql
as $$
declare
  r record;
  clash text;
begin
  for r in
    select p.serial as old, normalize_serial(p.serial) as new
    from participants p
    where p.serial <> normalize_serial(p.serial)
    order by p.serial
  loop
    old_serial := r.old;
    new_serial := r.new;

    select string_agg(f.name, '、' order by f.name) into clash
    from festival_participants a
    join festival_participants b
      on b.festival_id = a.festival_id and b.serial = r.new
    join festivals f on f.id = a.festival_id
    where a.serial = r.old;
    if clash is not null then
      result := '要対応: 「' || clash || '」に ' || r.old || ' と ' || r.new
        || ' の両方が登録されています。参加者管理でどちらかを削除してから、もう一度実行してください';
      return next;
      continue;
    end if;

    if exists (
      select 1 from prop_transfers t
      where (t.from_serial = r.old and t.to_serial = r.new)
         or (t.from_serial = r.new and t.to_serial = r.old)
    ) then
      result := '要対応: ' || r.old || ' と ' || r.new
        || ' の間に小道具の受け渡し記録があるため、自動では付け替えません(記録の扱いを決める必要があります)';
      return next;
      continue;
    end if;

    if not p_apply then
      result := '変更予定';
      return next;
      continue;
    end if;

    insert into participants (serial) values (r.new)
      on conflict (serial) do nothing;

    update festival_participants set serial = r.new where serial = r.old;
    update push_subscriptions set serial = r.new where serial = r.old;

    delete from serial_access
      where serial = r.old
        and exists (select 1 from serial_access s where s.serial = r.new);
    update serial_access set serial = r.new where serial = r.old;

    delete from rehearsal_attendances a
      where a.serial = r.old
        and exists (
          select 1 from rehearsal_attendances b
          where b.rehearsal_id = a.rehearsal_id and b.serial = r.new
        );
    update rehearsal_attendances set serial = r.new where serial = r.old;

    update prop_items set current_holder_serial = r.new
      where current_holder_serial = r.old;
    update prop_event_assignments set user_serial = r.new
      where user_serial = r.old;
    update prop_transfers set from_serial = r.new where from_serial = r.old;
    update prop_transfers set to_serial = r.new where to_serial = r.old;
    update prop_transfers set created_by_serial = r.new
      where created_by_serial = r.old;
    update prop_history set actor_serial = r.new where actor_serial = r.old;
    update prop_history set from_value = r.new where from_value = r.old;
    update prop_history set to_value = r.new where to_value = r.old;

    -- 一緒に持っている人(0024)。同じ小道具に両方の表記がいれば新しい表記の方を残す
    delete from prop_item_co_holders c
      where c.serial = r.old
        and exists (
          select 1 from prop_item_co_holders d
          where d.prop_item_id = c.prop_item_id and d.serial = r.new
        );
    update prop_item_co_holders set serial = r.new where serial = r.old;

    delete from participants where serial = r.old;

    result := '変更済み';
    return next;
  end loop;
end $$;

comment on function normalize_participant_serials(boolean) is
  '全角のシリアルを半角にそろえる。引数なしは確認だけ、true で反映';

-- 名簿を書き換える関数なので、アプリ(anon / authenticated)からは呼ばせない。
-- SQL Editor(postgres)から実行する。
revoke all on function normalize_participant_serials(boolean)
  from public, anon, authenticated;
