// シリアルの表記ゆれをそろえる。
//
// 実体は supabase/functions/_shared/serial.ts に置いている。
// 貼り付け取り込み(ブラウザ)とシート同期(Edge Function)で同じ規則を使うため。

export { normalizeSerial } from "../../supabase/functions/_shared/serial.ts";
