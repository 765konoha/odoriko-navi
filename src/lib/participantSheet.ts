// 名簿シートの解析。
//
// 実体は supabase/functions/_shared/participantParse.ts に置いている。
// Edge Function は supabase/functions の外を同梱できないことがあるので、
// 共有するものはそちら側に置き、アプリからはここを通して使う
// (出欠の attendanceImport.ts と同じ形)。

export type {
  ParticipantColumns,
  ParticipantSheetResult,
  ParticipantSheetRow,
  Sheet,
} from "../../supabase/functions/_shared/participantParse.ts";
export {
  buildParticipantRows,
  findParticipantColumns,
  missingColumnLabels,
  parseSheet,
} from "../../supabase/functions/_shared/participantParse.ts";
