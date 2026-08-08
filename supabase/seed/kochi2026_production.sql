-- =========================================================
-- 2026年 高知よさこい 本番データ(チーム「燦-SUN-」連絡網 2026.8.3〜8.6更新版より)
-- SQL Editor に全文を貼り付けて Run してください。
--
-- ⚠️ 冒頭の DELETE で既存の kochi-2026(テストデータ)を
--    関連する予定・場所・お知らせごと削除してから投入します。
--
-- 座標について:
--   連絡網の Google Maps リンクから取得できたものは正確な座標、
--   それ以外は住所・地理情報からの近似値(±50m程度)です。
--   ズレがあれば管理画面の「場所管理」で地図をタップして修正できます。
-- =========================================================

do $$
declare
  fid uuid;
  d1 uuid;  -- 8/9  前夜祭
  d2 uuid;  -- 8/10 本祭1日目(バスツアー)
  d3 uuid;  -- 8/11 本祭2日目(徒歩ツアー)
  d4 uuid;  -- 8/12 全国大会
  loc_ogawacho uuid;      -- 小川町公園
  loc_chuo_stage uuid;    -- 中央公園 ステージ東側(高知大丸南側)
  loc_enplus uuid;        -- EN+(更衣室)
  loc_post uuid;          -- 高知郵便局前(バス乗車)
  loc_kamimachi uuid;     -- 上町 ファミマ付近
  loc_otesuji uuid;       -- 追手筋 受付(スタート地点)
  loc_marunouchi uuid;    -- 丸ノ内緑地
  loc_daijingu uuid;      -- 高知大神宮付近
  loc_yosakoi_info uuid;  -- よさこい情報交流館付近
  loc_saenba uuid;        -- 菜園場 受付付近
  loc_otemae uuid;        -- 追手前高校グラウンド
begin
  -- 既存のテストデータを削除(関連データもcascadeで消えます)
  delete from festivals where slug = 'kochi-2026';

  insert into festivals (slug, name)
  values ('kochi-2026', '2026年 高知よさこい')
  returning id into fid;

  -- ---------- 開催日 ----------
  insert into festival_days (festival_id, date, label, sort_order)
  values (fid, '2026-08-09', '前夜祭', 1) returning id into d1;
  insert into festival_days (festival_id, date, label, sort_order)
  values (fid, '2026-08-10', '本祭1日目(バス)', 2) returning id into d2;
  insert into festival_days (festival_id, date, label, sort_order)
  values (fid, '2026-08-11', '本祭2日目(徒歩)', 3) returning id into d3;
  insert into festival_days (festival_id, date, label, sort_order)
  values (fid, '2026-08-12', '全国大会', 4) returning id into d4;

  -- ---------- 場所(集合場所) ----------
  insert into locations (festival_id, kind, name, lat, lng, address, description)
  values (fid, 'meeting_point', '小川町公園', 33.5670, 133.5408,
          '高知市北本町1丁目3-7', '毎日の集合・練習場所。メイク・着替を済ませて集合。')
  returning id into loc_ogawacho;

  insert into locations (festival_id, kind, name, lat, lng, address, description)
  values (fid, 'meeting_point', '中央公園 ステージ東側(高知大丸南側)', 33.56012, 133.54069,
          '高知市帯屋町1丁目(中央公園)', '中央公園競演場の踊り子待機・集合場所。ステージ下手側。')
  returning id into loc_chuo_stage;

  insert into locations (festival_id, kind, name, lat, lng, address, description)
  values (fid, 'meeting_point', 'EN+(更衣室・高知カプセルホテル)', 33.5603, 133.5346,
          '高知市帯屋町2丁目1-34', '更衣室 8:00-12:00 / 21:00-22:30。ランドリーサービスの受取・回収場所。')
  returning id into loc_enplus;

  insert into locations (festival_id, kind, name, lat, lng, address, description)
  values (fid, 'meeting_point', '高知郵便局前(バス乗車場所)', 33.5661, 133.5440,
          '高知市北本町1丁目(駅前大通り)', '8/10 バスツアーの乗車場所。時間厳守。')
  returning id into loc_post;

  insert into locations (festival_id, kind, name, lat, lng, address, description)
  values (fid, 'meeting_point', '上町競演場 集合場所(ファミマ付近)', 33.5588, 133.5225,
          '高知市上町', null)
  returning id into loc_kamimachi;

  insert into locations (festival_id, kind, name, lat, lng, address, description)
  values (fid, 'meeting_point', '追手筋本部競演場 受付(スタート地点)', 33.5612, 133.5343,
          '高知市追手筋', '南側コース=進行方向左側、北側コース=進行方向右側に集合。')
  returning id into loc_otesuji;

  insert into locations (festival_id, kind, name, lat, lng, address, description)
  values (fid, 'meeting_point', '丸ノ内緑地', 33.5583, 133.5296,
          '高知市丸ノ内1丁目2', '必ず南側の橋(向かい側にセブン)から進入。追手門からの進入は厳禁。')
  returning id into loc_marunouchi;

  insert into locations (festival_id, kind, name, lat, lng, address, description)
  values (fid, 'meeting_point', '高知大神宮付近(ひろめ市場近く)', 33.5605, 133.5330,
          '高知市帯屋町2丁目6-2', '8/11 帯屋町演舞場の集合場所。')
  returning id into loc_daijingu;

  insert into locations (festival_id, kind, name, lat, lng, address, description)
  values (fid, 'meeting_point', 'よさこい情報交流館付近', 33.5578, 133.5432,
          '高知市はりまや町1丁目10-1', 'はりまや橋競演場の集合場所。')
  returning id into loc_yosakoi_info;

  insert into locations (festival_id, kind, name, lat, lng, address, description)
  values (fid, 'meeting_point', '菜園場競演場 受付付近', 33.55924, 133.54852,
          '菜園場町電停あたり', null)
  returning id into loc_saenba;

  insert into locations (festival_id, kind, name, lat, lng, address, description)
  values (fid, 'meeting_point', '追手前高校グラウンド', 33.5622, 133.5352,
          '高知市追手筋2丁目2-10', '8/12 追手筋(北・南)の受付・待機場所。入口は東門(2つのうち北側が踊り子専用)。キャリーは持ち上げる。全面禁酒・禁煙。')
  returning id into loc_otemae;

  -- ---------- 場所(トイレ) ----------
  insert into locations (festival_id, kind, name, lat, lng, address, description) values
    (fid, 'toilet', '仮設トイレ(てんこす噴水横)', 33.5595, 133.5410,
     '新京橋プラザ(てんこす)噴水横', 'てんこす館内のトイレは使用不可。');

  -- ---------- 8/9(日)前夜祭 ----------
  insert into schedule_items
    (festival_day_id, title, category, gather_time, start_time, end_time,
     venue_name, meeting_location_id, notes, is_confirmed, tbd_note, is_cancelled, sort_order)
  values
    (d1, '公式リハーサル集合', 'gather', null,
     '2026-08-09 13:00+09', null,
     '中央公園競演場', loc_chuo_stage,
     'ステージ下手の噴水あたり。踊れる格好で、小道具は全て持参。更衣室はなし。',
     true, null, false, 1),
    (d1, '公式リハーサル', 'practice', null,
     '2026-08-09 13:15+09', '2026-08-09 13:30+09',
     '中央公園競演場', null, '終了後は一旦解散、各自準備・自由時間。', true, null, false, 2),
    (d1, '集合・練習', 'practice', null,
     '2026-08-09 17:40+09', '2026-08-09 18:20+09',
     null, loc_ogawacho,
     'メイク・着替を済ませて集合。歌い手・煽り・カメラマンは18:00合流。18:30に移動開始。',
     true, null, false, 3),
    (d1, '中央公園競演場(ステージ)', 'performance',
     '2026-08-09 18:55+09', '2026-08-09 19:29+09', null,
     '中央公園競演場', loc_chuo_stage,
     '受付: はりまや橋公園 西詰テント。演舞後マネージャーミーティングあり(10分程度)。',
     true, null, false, 4),
    (d1, 'ランドリー回収', 'other', null,
     '2026-08-09 22:00+09', '2026-08-09 22:15+09',
     null, loc_enplus, '時間厳守。', true, null, false, 5);

  -- ---------- 8/10(月)本祭1日目(バスツアー) ----------
  insert into schedule_items
    (festival_day_id, title, category, gather_time, start_time, end_time,
     venue_name, meeting_location_id, notes, is_confirmed, tbd_note, is_cancelled, sort_order)
  values
    (d2, 'ランドリー受取', 'other', null,
     '2026-08-10 08:20+09', '2026-08-10 09:00+09',
     null, loc_enplus, 'ランドリー利用者は荷物をEN+に置いてから小川町公園へ。', true, null, false, 1),
    (d2, '集合・練習', 'practice', null,
     '2026-08-10 09:30+09', '2026-08-10 10:30+09',
     null, loc_ogawacho,
     'メイク・着替を済ませて9:30集合。歌い手・煽り・カメラマンは10:20。終了後、移動しながら昼食を各自買出し(隙間時間に食べられるものを)。',
     true, null, false, 2),
    (d2, 'バス乗車場所 集合', 'move', null,
     '2026-08-10 10:55+09', null,
     null, loc_post, '時間厳守。全員で梅ノ辻へ移動し、受付後一旦解散(予定)。', true, null, false, 3),
    (d2, '梅ノ辻競演場(流し200m)', 'performance', null,
     '2026-08-10 13:30+09', null,
     '梅ノ辻競演場', null, null,
     false, '13:30前後予定・演舞15分前集合・集合場所は近隣の公園予定', false, 4),
    (d2, '上町競演場(流し240m)', 'performance', null,
     '2026-08-10 14:30+09', null,
     '上町競演場', loc_kamimachi, null,
     false, '14:30頃予定・演舞15分前集合', false, 5),
    (d2, '升形地域競演場(流し100m)', 'performance', null,
     '2026-08-10 15:30+09', null,
     '升形地域競演場', null, null,
     false, '15:30頃予定・演舞15分前集合・集合場所は当日連絡', false, 6),
    (d2, '万々競演場(流し400m)', 'performance', null,
     '2026-08-10 17:00+09', null,
     '万々競演場', null, '「咲かせや 咲かせ」も踊る。',
     false, '17:00頃予定・演舞15分前集合・集合場所は当日連絡', false, 7),
    (d2, '愛宕競演場 or 高知駅前競演場', 'performance', null,
     '2026-08-10 18:30+09', null,
     null, null, '流し500m(愛宕)。18:00頃 会場到着後、バスとは解散予定。「咲かせや 咲かせ」ありうる。',
     false, '18:30頃予定・会場も含め当日判断・集合場所は当日連絡', false, 8),
    (d2, '追手筋本部競演場(南側・流し350m)', 'performance',
     '2026-08-10 20:15+09', '2026-08-10 20:35+09', null,
     '追手筋本部競演場', loc_otesuji,
     '会場規定により20分前集合。受付付近(スタート地点)、進行方向向かって左側。',
     true, null, false, 9),
    (d2, '(時間があれば)帯屋町 → 京町 → 中央公園', 'performance', null,
     null, null,
     null, null, '追手筋の後、時間・体力があればこの順で演舞。当日判断。演舞終了後解散。',
     false, '当日判断', false, 10),
    (d2, 'ランドリー回収', 'other', null,
     '2026-08-10 22:00+09', '2026-08-10 22:15+09',
     null, loc_enplus, '時間厳守。翌朝の受取は9:00-10:00。', true, null, false, 11);

  -- ---------- 8/11(祝・火)本祭2日目(徒歩ツアー) ----------
  insert into schedule_items
    (festival_day_id, title, category, gather_time, start_time, end_time,
     venue_name, meeting_location_id, notes, is_confirmed, tbd_note, is_cancelled, sort_order)
  values
    (d3, 'ランドリー受取', 'other', null,
     '2026-08-11 09:00+09', '2026-08-11 10:00+09',
     null, loc_enplus, null, true, null, false, 1),
    (d3, '集合・練習', 'practice',
     '2026-08-11 11:10+09', '2026-08-11 11:30+09', '2026-08-11 12:10+09',
     null, loc_ogawacho,
     '11:10=小道具隊、11:30=その他の踊り子・旗士。メイク・着替を済ませて集合。荷物は地方車へ・飲み物はキャリーへ(中央公園終了まで地方車と別行動)。12:20移動開始。',
     true, null, false, 2),
    (d3, '高知城演舞場(固定流し)', 'performance',
     '2026-08-11 12:50+09', '2026-08-11 13:05+09', null,
     '高知城演舞場', loc_marunouchi,
     '追手門からの進入は厳禁。丸ノ内緑地南側の橋(向かい側にセブン)から入る。',
     true, null, false, 3),
    (d3, '帯屋町演舞場(流し550m)', 'performance',
     '2026-08-11 13:20+09', '2026-08-11 13:42+09', null,
     '帯屋町演舞場', loc_daijingu, '「咲かせや 咲かせ」も踊る。', true, null, false, 4),
    (d3, '京町演舞場(流し120m)', 'performance', null,
     null, null,
     '京町演舞場', null,
     '帯屋町終了後そのままの流れで。集合は帯屋町演舞終了後に右折したところの受付付近。給水なし。',
     true, null, false, 5),
    (d3, '中央公園競演場(ステージ)', 'performance', null,
     null, null,
     '中央公園競演場', loc_chuo_stage,
     '京町終了後そのままの流れで。集合はステージ下手側(大丸前&てんこす噴水辺り)。給水なし。演舞後にお荷物バラシ。',
     true, null, false, 6),
    (d3, '追手筋本部競演場(北・流し350m)', 'performance',
     '2026-08-11 16:00+09', '2026-08-11 16:24+09', null,
     '追手筋本部競演場', loc_otesuji,
     '受付付近(スタート地点)、進行方向向かって右側。この後少し休憩を挟む。',
     true, null, false, 7),
    (d3, 'はりまや橋競演場(流し130m)', 'performance', null,
     '2026-08-11 17:30+09', null,
     'はりまや橋競演場', loc_yosakoi_info, null,
     false, '17:30頃予定・演舞15分前集合', false, 8),
    (d3, '菜園場競演場(流し300m)', 'performance', null,
     '2026-08-11 18:30+09', null,
     '菜園場競演場', loc_saenba,
     '体力とテンションが残っていれば、さらに踊りに行く可能性あり。演舞終了後解散、マネージャーミーティングあり。',
     false, '18:30頃予定・演舞15分前集合', false, 9),
    (d3, 'ランドリー回収', 'other', null,
     '2026-08-11 22:00+09', '2026-08-11 22:15+09',
     null, loc_enplus, '時間厳守。翌朝の受取は9:00-10:00。', true, null, false, 10);

  -- ---------- 8/12(水)全国大会 ----------
  insert into schedule_items
    (festival_day_id, title, category, gather_time, start_time, end_time,
     venue_name, meeting_location_id, notes, is_confirmed, tbd_note, is_cancelled, sort_order)
  values
    (d4, 'ランドリー受取', 'other', null,
     '2026-08-12 09:00+09', '2026-08-12 10:00+09',
     null, loc_enplus, null, true, null, false, 1),
    (d4, '集合・練習', 'practice', null,
     '2026-08-12 11:10+09', '2026-08-12 11:50+09',
     null, loc_ogawacho,
     '衣装でなくてOK。更衣室はEN+(8:00-12:00/21:00-22:30)と追手前高校体育館(10:00〜解放・東門北側から)。',
     true, null, false, 2),
    (d4, 'オープニングセレモニー', 'other', null,
     '2026-08-12 12:30+09', null,
     null, null, 'ZENさん参加必須(12:15集合・時間厳守)。この日は全会場20分前集合。',
     true, null, false, 3),
    (d4, '中央公園競演場(ステージ)', 'performance',
     '2026-08-12 14:10+09', '2026-08-12 14:30+09', null,
     '中央公園競演場', loc_chuo_stage,
     '歌い手・煽り・カメラマンは14:10に中央公園で合流。受付テントははりまや橋公園給水所付近。',
     true, null, false, 4),
    (d4, '追手筋本部競演場(北側)チーム審査', 'performance',
     '2026-08-12 15:25+09', '2026-08-12 15:45+09', null,
     '追手筋本部競演場', loc_otemae,
     '流し350m。受付・待機は追手前高校グラウンド。本祭と集合場所が違うので注意。',
     true, null, false, 5),
    (d4, '高知城演舞場(ステージ・固定流し)', 'performance',
     '2026-08-12 17:06+09', '2026-08-12 17:26+09', null,
     '高知城演舞場', loc_marunouchi, '必ず丸ノ内緑地南側の橋から進入。', true, null, false, 6),
    (d4, '追手筋本部競演場(南側)個人審査', 'performance',
     '2026-08-12 18:58+09', '2026-08-12 19:18+09', null,
     '追手筋本部競演場', loc_otemae,
     '流し350m。受付・待機は追手前高校グラウンド。本祭と集合場所が違うので注意。',
     true, null, false, 7),
    (d4, '帯屋町演舞場(流し550m)', 'performance',
     '2026-08-12 20:17+09', '2026-08-12 20:37+09', null,
     '帯屋町演舞場', loc_marunouchi,
     '「咲かせや 咲かせ」も踊る。受付・待機は丸ノ内緑地(本祭と違う)。総踊り(鳴子華)は時間が重なるため燦は不参加。演舞終了後解散。',
     true, null, false, 8),
    (d4, '表彰式・フィナーレ(自由参加)', 'other', null,
     '2026-08-12 21:30+09', null,
     '高知城会場', null, '丸ノ内緑地からではなく正面から入る。', true, null, false, 9);
end $$;
