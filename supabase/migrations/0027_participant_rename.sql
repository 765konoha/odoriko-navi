-- =========================================================
-- 踊り子マスタ: シリアルの変更
--
-- シリアルは participants の主キーで、多くの表から参照されている
-- (ON UPDATE CASCADE ではない)。そのため変更は「新しいシリアルを
-- マスタに足し、記録をすべて付け替えて、古いシリアルを消す」で行う。
-- 付け替えは統合(0026 の admin_merge_participant)と同じ処理を使う。
--
-- 新しいシリアルが既にある場合は変更しない(2人を1人にまとめるのは
-- 統合の役目で、何が消えるかを確認してから行うため)。
--
-- 関数だけを追加するので、流しても既存のデータは変わらない。
-- =========================================================

create or replace function admin_rename_participant(
  p_from  text,
  p_to    text,
  p_apply boolean default false
) returns table (level text, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_to    text := normalize_serial(coalesce(p_to, ''));
  v_error text;
begin
  if auth.uid() is null then
    raise exception '権限がありません。';
  end if;

  if not exists (select 1 from participants where serial = p_from) then
    v_error := 'シリアル「' || coalesce(p_from, '') || '」が見つかりません。最新の一覧を読み込み直してください。';
  elsif v_to = '' then
    v_error := '新しいシリアルを入力してください。';
  elsif v_to = p_from then
    v_error := 'シリアルが変わっていません。';
  elsif exists (select 1 from participants where serial = v_to) then
    v_error := 'シリアル「' || v_to || '」は既にあります。同じ人なら「別のシリアルに統合」を使ってください。';
  end if;

  if v_error is not null then
    if p_apply then
      raise exception '%', v_error;
    end if;
    return query select 'error'::text, v_error;
    return;
  end if;

  if not p_apply then
    return query select 'info'::text,
      p_from || ' を ' || v_to || ' に変更します。名簿・出欠・小道具・通知・利用状況の記録は '
        || v_to || ' に引き継がれます。';
    return;
  end if;

  insert into participants (serial, created_at)
    select v_to, p.created_at from participants p where p.serial = p_from;
  perform 1 from admin_merge_participant(p_from, v_to, true);

  return query select 'info'::text, p_from || ' を ' || v_to || ' に変更しました。';
end $$;

revoke all on function admin_rename_participant(text, text, boolean) from public, anon;
grant execute on function admin_rename_participant(text, text, boolean) to authenticated;
