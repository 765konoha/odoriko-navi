import { supabase } from "./supabase";

// 利用状況の記録(運営が Supabase 上で「誰がアプリを入れたか」を確認するための緩い記録)。
// 画面表示には一切使わないため、失敗しても何も起きないようにする。

const KEY = "odoriko:accessRecorded";
/** 同じ端末から繰り返し送らないための間隔 */
const INTERVAL_MS = 6 * 60 * 60 * 1000;

interface Mark {
  serial: string;
  installed: boolean;
  at: number;
}

/** ホーム画面のアイコンから起動しているか(= 実質インストール済み) */
function isStandalone(): boolean {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

function platform(): string {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

function loadMark(): Mark | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Mark) : null;
  } catch {
    return null;
  }
}

function saveMark(mark: Mark | null): void {
  try {
    if (mark) localStorage.setItem(KEY, JSON.stringify(mark));
    else localStorage.removeItem(KEY);
  } catch {
    // ストレージ不可でもアプリは動作させる(毎回送信になるだけ)
  }
}

/**
 * 選択中シリアルの利用状況を記録する(送りっぱなし)。
 * シリアルかインストール状態が変わったとき、または前回から6時間経過したときだけ送る。
 */
export function recordSerialAccess(
  serial: string | null,
  festivalSlug?: string | null,
): void {
  if (!serial || !supabase) return;
  const installed = isStandalone();
  const prev = loadMark();
  if (
    prev &&
    prev.serial === serial &&
    prev.installed === installed &&
    Date.now() - prev.at < INTERVAL_MS
  ) {
    return;
  }
  saveMark({ serial, installed, at: Date.now() });
  try {
    void supabase
      .rpc("record_serial_access", {
        p_serial: serial,
        p_festival_slug: festivalSlug ?? null,
        p_installed: installed,
        p_platform: platform(),
      })
      .then(({ error }) => {
        // 失敗時は記録を消して次回に再試行させる
        if (error) saveMark(null);
      });
  } catch {
    saveMark(null);
  }
}
