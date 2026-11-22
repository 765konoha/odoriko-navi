/**
 * 踊り子ナビ 小道具連携(小道具担当のスプレッドシートに貼るスクリプト)
 *
 * 「2026」シートの上部の操作欄から、踊り子ナビへ反映する。
 *   ■保有者・状態を更新  … 基準の列まで(D列)で、一番右に書かれた人を保有者にする
 *   ■受け渡し予定を反映  … 対象日(D列)のお祭りの持ち帰りを、その日の受け渡し予定にする
 * PC は E列のボタン(図形)、スマホは「確認」「反映する」のチェックボックス。
 *
 * どのセルを誰と読むかは、踊り子ナビ側(Edge Function props-sheet-sync)が決める。
 * このスクリプトはシートを丸ごと送り、返ってきた結果を表示するだけ。
 * 設計: https://github.com/765konoha/odoriko-navi/blob/main/docs/PROPS_SHEET_SYNC.md
 *
 * 最初に1回: メニュー「踊り子ナビ」→「初期設定」(合言葉の登録とスマホ用の仕組みの有効化)
 */

// 踊り子ナビの受付口。貼り付けるときに、Supabase のプロジェクトの値に置き換える
// (どちらもアプリに含まれている公開の値。合言葉は初期設定でスクリプト プロパティに入れる)
const ENDPOINT = 'https://<プロジェクトID>.supabase.co/functions/v1/props-sheet-sync';
const PUBLISHABLE_KEY = 'sb_publishable_...';

const ALIAS_SHEET = '名前対応表';
const LABEL_HOLDERS = '■保有者・状態を更新';
const LABEL_HANDOVERS = '■受け渡し予定を反映';
const LABEL_RESULT = '結果';
const LABEL_HEADER = 'お祭り・イベント';
const LABEL_DATE = '日付';
// 操作欄の列(1 始まり): C=見出し D=入力 G=「確認」 I=「反映する」
const COL_LABEL = 3;
const COL_INPUT = 4;
const COL_CONFIRM = 7;
const COL_APPLY = 9;
const SEARCH_ROWS = 12;

// ---------- メニュー ----------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('踊り子ナビ')
    .addItem('保有者・状態を更新', 'runHoldersFromButton')
    .addItem('受け渡し予定を反映', 'runHandoversFromButton')
    .addSeparator()
    .addItem('基準の列の選択肢を作り直す', 'refreshColumnChoices')
    .addItem('初期設定（最初に1回）', 'setup')
    .addToUi();
  try {
    refreshColumnChoices();
  } catch (e) {
    // 操作欄がまだ無いシートでは何もしない
  }
}

/**
 * 合言葉の登録と、スマホ用(チェックボックス)の仕組みの有効化。
 * 合言葉を空欄のままにすると新しく作って表示する(Supabase の Secrets に
 * PROPS_SYNC_TOKEN として同じ値を登録する)。チャットなどに貼らずに済むように。
 */
function setup() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const has = !!props.getProperty('SYNC_TOKEN');
  const res = ui.prompt(
    '初期設定',
    '踊り子ナビの合言葉（PROPS_SYNC_TOKEN と同じ値）を入力してください。\n' +
      (has ? '設定済みの合言葉を変えない場合は、空欄のまま OK。' : '空欄のまま OK を押すと、新しく作って表示します。'),
    ui.ButtonSet.OK_CANCEL,
  );
  if (res.getSelectedButton() !== ui.Button.OK) return;
  let token = res.getResponseText().trim();
  let created = false;
  if (!token && !has) {
    token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    created = true;
  }
  if (token) props.setProperty('SYNC_TOKEN', token);

  const ss = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'onEditInstalled')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onEditInstalled').forSpreadsheet(ss).onEdit().create();
  refreshColumnChoices();
  ui.alert(
    created
      ? '初期設定が終わりました。\n\n次の合言葉を、Supabase の Edge Functions → Secrets に PROPS_SYNC_TOKEN として登録してください（この画面を閉じると再表示できません）。\n\n' + token
      : '初期設定が終わりました。スマホのチェックボックスからも実行できます。',
  );
}

// ---------- PC(ボタン) ----------

function runHoldersFromButton() {
  runWithDialog_('holders');
}

function runHandoversFromButton() {
  runWithDialog_('handovers');
}

function runWithDialog_(action) {
  const ui = SpreadsheetApp.getUi();
  const preview = callSync_(action, false);
  writeResult_(preview.message, 'PC・確認');
  if (!preview.ok || (preview.changes || []).length === 0) {
    ui.alert(preview.message);
    return;
  }
  const question = (preview.errors || []).length > 0
    ? 'エラーの小道具を除いて反映しますか？'
    : '反映しますか？';
  const answer = ui.alert('踊り子ナビ', preview.message + '\n\n' + question, ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;
  const result = callSync_(action, true);
  writeResult_(result.message, 'PC・反映');
  ui.alert(result.message);
}

// ---------- スマホ(チェックボックス) ----------

function onEditInstalled(e) {
  const range = e && e.range;
  if (!range || range.getNumRows() !== 1 || range.getNumColumns() !== 1) return;
  const sheet = range.getSheet();
  const col = range.getColumn();
  if (col !== COL_CONFIRM && col !== COL_APPLY) return;
  if (range.getValue() !== true) return;
  const rows = controlRows_(sheet);
  if (!rows) return;
  const action = range.getRow() === rows.holders
    ? 'holders'
    : range.getRow() === rows.handovers ? 'handovers' : null;
  if (!action) return;

  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) return;
  try {
    const apply = col === COL_APPLY;
    writeResult_('実行中…', '');
    const result = callSync_(action, apply);
    writeResult_(result.message, apply ? 'スマホ・反映' : 'スマホ・確認');
  } finally {
    range.setValue(false);
    lock.releaseLock();
  }
}

// ---------- 送信 ----------

function callSync_(action, apply) {
  try {
    const token = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
    if (!token) {
      return { ok: false, message: '合言葉が未設定です。PC でメニュー「踊り子ナビ」→「初期設定」を行ってください。' };
    }
    const sheet = mainSheet_();
    const rows = controlRows_(sheet);
    if (!rows) return { ok: false, message: '操作欄（' + LABEL_HOLDERS + '）が見つかりません。' };

    const body = {
      action: action,
      apply: apply,
      grid: readGrid_(sheet),
      year: Number(sheet.getName()) || undefined,
      aliases: readAliases_(),
    };
    if (action === 'holders') {
      const choice = String(sheet.getRange(rows.holders, COL_INPUT).getDisplayValue());
      const m = choice.match(/^([A-Za-zＡ-Ｚａ-ｚ]+)列/);
      if (!m) return { ok: false, message: '基準の列を選んでください（' + LABEL_HOLDERS + 'の右のセル）。' };
      body.baseColumn = m[1];
    } else {
      const value = sheet.getRange(rows.handovers, COL_INPUT).getValue();
      if (!(value instanceof Date)) {
        return { ok: false, message: '対象日を入れてください（' + LABEL_HANDOVERS + 'の右のセル）。' };
      }
      body.targetDate = Utilities.formatDate(value, 'Asia/Tokyo', 'yyyy-MM-dd');
      body.year = value.getFullYear();
    }

    const res = UrlFetchApp.fetch(ENDPOINT, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        apikey: PUBLISHABLE_KEY,
        Authorization: 'Bearer ' + PUBLISHABLE_KEY,
        'x-sync-token': token,
      },
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    });
    try {
      return JSON.parse(res.getContentText());
    } catch (err) {
      return { ok: false, message: '踊り子ナビから想定外の応答がありました（HTTP ' + res.getResponseCode() + '）。' };
    }
  } catch (err) {
    return { ok: false, message: '踊り子ナビに接続できませんでした。時間をおいてもう一度お試しください。' };
  }
}

/** 操作欄のあるシート(操作欄の見出しで探す) */
function mainSheet_() {
  const sheets = SpreadsheetApp.getActive().getSheets();
  for (const s of sheets) {
    if (controlRows_(s)) return s;
  }
  return SpreadsheetApp.getActiveSheet();
}

/** 操作欄の行番号 */
function controlRows_(sheet) {
  const labels = sheet.getRange(1, COL_LABEL, SEARCH_ROWS, 1).getDisplayValues();
  const find = (prefix) => {
    const i = labels.findIndex((r) => String(r[0]).trim().indexOf(prefix) === 0);
    return i >= 0 ? i + 1 : null;
  };
  const holders = find(LABEL_HOLDERS);
  const handovers = find(LABEL_HANDOVERS);
  const result = find(LABEL_RESULT);
  return holders && handovers && result ? { holders: holders, handovers: handovers, result: result } : null;
}

/** シートを丸ごと文字の表にする(日付は yyyy-MM-dd) */
function readGrid_(sheet) {
  const range = sheet.getDataRange();
  const values = range.getValues();
  const display = range.getDisplayValues();
  return values.map((row, r) =>
    row.map((v, c) =>
      v instanceof Date ? Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM-dd') : display[r][c],
    ),
  );
}

/** 名前対応表(A列: スプシでの名前、B列: シリアル。1行目は見出し) */
function readAliases_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(ALIAS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 2)
    .getDisplayValues()
    .filter((r) => String(r[0]).trim() && String(r[1]).trim());
}

function writeResult_(message, how) {
  const sheet = mainSheet_();
  const rows = controlRows_(sheet);
  if (!rows) return;
  const stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'M/d HH:mm');
  const text = (how ? stamp + '（' + how + '）\n' : '') + String(message || '');
  sheet.getRange(rows.result, COL_INPUT).setValue(text.slice(0, 5000));
}

// ---------- 基準の列の選択肢 ----------

/** 「AO列 原宿 リレー 8/29・30」のような選択肢を見出しから作る */
function refreshColumnChoices() {
  const sheet = mainSheet_();
  const rows = controlRows_(sheet);
  if (!rows) return;
  const grid = sheet.getDataRange().getDisplayValues();
  const labelRow = (label) =>
    grid.findIndex((r) => String(r[COL_LABEL - 1]).replace(/\s+/g, '') === label);
  const headerRow = labelRow(LABEL_HEADER);
  if (headerRow < 0) return;
  const dateRow = labelRow(LABEL_DATE);
  const header = grid[headerRow];
  let end = header.findIndex((h) => String(h).replace(/\s+/g, '') === '現在の保管者');
  if (end < 0) end = header.length;

  const choices = [];
  let event = '';
  let date = '';
  for (let c = 3; c < end; c++) {
    const h = String(header[c]).replace(/\s+/g, ' ').trim();
    const isRelay = h.indexOf('リレー') === 0 || h === '';
    if (!isRelay) {
      event = h;
      date = dateRow >= 0 ? String(grid[dateRow][c]).trim() : '';
    }
    const name = isRelay ? event + ' ' + (h || 'リレー') : event;
    choices.push(columnLetter_(c) + '列 ' + name + (date ? ' ' + date : ''));
  }
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(choices.reverse(), true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(rows.holders, COL_INPUT).setDataValidation(rule);
}

function columnLetter_(index) {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
