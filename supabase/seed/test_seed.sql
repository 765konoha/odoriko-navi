-- 動作確認用テストデータ(mock データと同内容)
-- SQL Editor で 0001_init.sql の後に実行してください。
-- 日付は「実行した日(JST)」を1日目として生成するので、いつ実行しても
-- ホーム画面で NEXT・残り時間の動作を確認できます。
-- 本番データを管理画面から登録する際は、このデータを削除して構いません
-- (festivals の行を削除すれば関連データもすべて消えます)。

do $$
declare
  jst_today date := (now() at time zone 'Asia/Tokyo')::date;
  fid uuid;
  d1 uuid;
  d2 uuid;
  loc_otesuji uuid;
  loc_chuo uuid;
  loc_kochijo uuid;
  loc_harimaya uuid;
begin
  insert into festivals (slug, name)
  values ('kochi-2026', '2026年 高知よさこい')
  returning id into fid;

  insert into festival_days (festival_id, date, label, sort_order)
  values (fid, jst_today, '本祭1日目', 1)
  returning id into d1;

  insert into festival_days (festival_id, date, label, sort_order)
  values (fid, jst_today + 1, '本祭2日目', 2)
  returning id into d2;

  insert into locations (festival_id, kind, name, lat, lng, address, description)
  values (fid, 'meeting_point', '追手筋本部競演場 北側', 33.5613, 133.5387,
          '高知市追手筋1丁目', '本部席の北側歩道。車道には出ないこと。')
  returning id into loc_otesuji;

  insert into locations (festival_id, kind, name, lat, lng, address, description)
  values (fid, 'meeting_point', '中央公園 北口', 33.5599, 133.5416,
          '高知市帯屋町1丁目', '噴水前ではなく北側入口に集合。')
  returning id into loc_chuo;

  insert into locations (festival_id, kind, name, lat, lng, address)
  values (fid, 'meeting_point', '高知城 追手門前', 33.5606, 133.5313,
          '高知市丸ノ内1丁目')
  returning id into loc_kochijo;

  insert into locations (festival_id, kind, name, lat, lng, address, description)
  values (fid, 'meeting_point', 'はりまや橋 東詰', 33.5566, 133.5450,
          '高知市はりまや町1丁目', '観覧席側には入らないこと。')
  returning id into loc_harimaya;

  insert into locations (festival_id, kind, name, lat, lng, address, description) values
    (fid, 'toilet', '中央公園 公衆トイレ', 33.5600, 133.5420,
     '中央公園内 南東角', '混雑しやすい。時間に余裕をもって。'),
    (fid, 'toilet', '追手筋 仮設トイレ', 33.5610, 133.5375,
     '追手筋西側 廿代町公園横', '祭り期間のみ設置。'),
    (fid, 'toilet', '帯屋町アーケード内 トイレ', 33.5601, 133.5399,
     '帯屋町2丁目 アーケード中央');

  insert into schedule_items
    (festival_day_id, title, category, gather_time, start_time, end_time,
     venue_name, meeting_location_id, notes, is_confirmed, tbd_note, is_cancelled, sort_order)
  values
    (d1, '集合・点呼', 'gather', null,
     (jst_today + time '08:30') at time zone 'Asia/Tokyo', null,
     null, loc_chuo, '衣装着用で集合。鳴子を忘れずに。', true, null, false, 1),
    (d1, '高知城演舞場', 'performance',
     (jst_today + time '09:30') at time zone 'Asia/Tokyo',
     (jst_today + time '10:00') at time zone 'Asia/Tokyo',
     (jst_today + time '10:15') at time zone 'Asia/Tokyo',
     '高知城演舞場', loc_kochijo, null, true, null, false, 2),
    (d1, '帯屋町へ移動(徒歩)', 'move', null,
     (jst_today + time '10:30') at time zone 'Asia/Tokyo', null,
     null, null, 'アーケード内は一般客優先。広がって歩かない。', true, null, false, 3),
    (d1, '帯屋町演舞場', 'performance',
     (jst_today + time '11:10') at time zone 'Asia/Tokyo',
     (jst_today + time '11:30') at time zone 'Asia/Tokyo',
     (jst_today + time '11:45') at time zone 'Asia/Tokyo',
     '帯屋町演舞場', loc_chuo, null, true, null, false, 4),
    (d1, '昼食・休憩', 'break', null,
     (jst_today + time '12:00') at time zone 'Asia/Tokyo',
     (jst_today + time '13:30') at time zone 'Asia/Tokyo',
     '中央公園', null, '熱中症対策のため必ず給水すること。', true, null, false, 5),
    (d1, '追手筋本部競演場', 'performance',
     (jst_today + time '16:00') at time zone 'Asia/Tokyo',
     (jst_today + time '16:24') at time zone 'Asia/Tokyo',
     (jst_today + time '16:40') at time zone 'Asia/Tokyo',
     '追手筋本部競演場', loc_otesuji,
     '集合後に隊列確認あり。水分補給を済ませてから集合。', true, null, false, 6),
    (d1, 'はりまや橋演舞場', 'performance', null,
     (jst_today + time '17:30') at time zone 'Asia/Tokyo', null,
     'はりまや橋演舞場', loc_harimaya, null,
     false, '17:30頃予定・当日連絡・演舞15分前集合', false, 7),
    (d1, '菜園場競演場', 'performance',
     (jst_today + time '18:40') at time zone 'Asia/Tokyo',
     (jst_today + time '19:00') at time zone 'Asia/Tokyo', null,
     '菜園場競演場', null, '会場都合により中止。', true, null, true, 8),
    (d1, '解散', 'dismiss', null,
     (jst_today + time '20:00') at time zone 'Asia/Tokyo', null,
     null, loc_chuo, '衣装は各自持ち帰り。忘れ物に注意。', true, null, false, 9),
    (d2, '集合・点呼', 'gather', null,
     ((jst_today + 1) + time '09:00') at time zone 'Asia/Tokyo', null,
     null, loc_chuo, null, true, null, false, 1),
    (d2, '追手筋本部競演場(全国大会)', 'performance',
     ((jst_today + 1) + time '10:00') at time zone 'Asia/Tokyo',
     ((jst_today + 1) + time '10:24') at time zone 'Asia/Tokyo', null,
     '追手筋本部競演場', loc_otesuji, null,
     false, '審査結果により変動・当日連絡', false, 2);

  insert into announcements (festival_id, title, body, priority, published_at) values
    (fid, '本日の予定について',
     E'本日は予定どおり全会場で開催します。\n\n集合時間・集合場所はスケジュール画面を確認してください。\n熱中症対策のため、各自で水分を必ず持参してください。',
     'normal', (jst_today + time '07:00') at time zone 'Asia/Tokyo'),
    (fid, '荷物置き場について',
     E'貴重品以外の荷物は中央公園のチームテントに置けます。\n\n貴重品は必ず各自で管理してください。',
     'important', (jst_today + time '08:45') at time zone 'Asia/Tokyo'),
    (fid, '追手筋の集合時間変更',
     E'運営の進行遅れにより、追手筋本部競演場の集合時間が変更になりました。\n\n集合\n16:00 → 16:20\n\n集合場所の変更はありません。',
     'emergency', (jst_today + time '09:30') at time zone 'Asia/Tokyo');
end $$;
