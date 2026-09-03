// エントリーフォームの回答(スプレッドシート)の解析。
//
// 実体は supabase/functions/_shared/attendanceParse.ts に置いている。
// 貼り付け取り込み(ブラウザ)とシート同期(Edge Function)で同じ解析を使うため。
// Edge Function は supabase/functions の外を同梱できないことがあるので、
// 共有するものはそちら側に置き、アプリからはここを通して使う。

export type {
  AttendanceStatus,
  ColumnCandidate,
  ImportResult,
  ImportRow,
  Sheet,
} from "../../supabase/functions/_shared/attendanceParse.ts";
export {
  buildImportRows,
  findAttendanceColumns,
  guessSerialColumn,
  parseSheet,
  parseStatus,
  pickMonthDay,
} from "../../supabase/functions/_shared/attendanceParse.ts";
