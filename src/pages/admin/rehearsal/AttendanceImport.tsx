import { useMemo, useState } from "react";
import type { Rehearsal } from "../../../types/rehearsal";
import {
  buildImportRows,
  findAttendanceColumns,
  guessSerialColumn,
  parseSheet,
  type Sheet,
} from "../../../lib/attendanceImport";
import { importAttendances } from "../../../lib/rehearsalsAdminApi";
import { toDateString } from "../../../lib/time";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const labelClass = "text-sm font-medium text-slate-600";

/** 見出しの月日と、登録済みリハの日付を突き合わせる */
function matchRehearsal(
  monthDay: { month: number; day: number } | null,
  rehearsals: Rehearsal[],
): string {
  if (!monthDay) return "";
  const found = rehearsals.find((r) => {
    const [, m, d] = toDateString(r.startsAt).split("-");
    return Number(m) === monthDay.month && Number(d) === monthDay.day;
  });
  return found?.id ?? "";
}

interface Mapping {
  /** 出欠の列 */
  statusColumn: number;
  header: string;
  rehearsalId: string;
  timeNoteColumn: number;
}

export default function AttendanceImport({
  rehearsals,
  serials,
  onDone,
}: {
  rehearsals: Rehearsal[];
  /** 参加者マスターのシリアル(照合に使う) */
  serials: Set<string>;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [serialColumn, setSerialColumn] = useState(-1);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  function handleParse() {
    setError(null);
    setResult(null);
    const parsed = parseSheet(text);
    if (!parsed) {
      setError("見出し行とデータ行が読み取れませんでした。見出しの行から選んで貼り付けてください。");
      setSheet(null);
      return;
    }
    setSheet(parsed);
    setSerialColumn(guessSerialColumn(parsed.header));
    setMappings(
      findAttendanceColumns(parsed.header).map((c) => ({
        statusColumn: c.index,
        header: c.header,
        rehearsalId: matchRehearsal(c.monthDay, rehearsals),
        // 実際のシートでは出欠の右隣が「遅刻・早退の時刻」になっている
        timeNoteColumn: c.index + 1,
      })),
    );
  }

  // 取り込み前に件数を出す(押す前に結果が読めるように)
  const preview = useMemo(() => {
    if (!sheet || serialColumn < 0) return null;
    return mappings
      .filter((m) => m.rehearsalId !== "")
      .map((m) => {
        const r = buildImportRows(
          sheet,
          serialColumn,
          m.statusColumn,
          m.timeNoteColumn,
        );
        const unknown = r.rows.filter((row) => !serials.has(row.serial));
        return { mapping: m, result: r, unknown };
      });
  }, [sheet, serialColumn, mappings, serials]);

  async function handleImport() {
    if (!preview) return;
    setSaving(true);
    setError(null);
    const lines: string[] = [];
    try {
      for (const p of preview) {
        const name =
          rehearsals.find((r) => r.id === p.mapping.rehearsalId)?.title ??
          "(リハ)";
        const valid = p.result.rows.filter((row) => serials.has(row.serial));
        await importAttendances(p.mapping.rehearsalId, valid);
        lines.push(
          `${name}: 取り込み ${valid.length}件 / 未回答 ${p.result.blankCount}件` +
            (p.unknown.length > 0
              ? ` / 参加者に無いシリアル ${p.unknown.length}件(${p.unknown.map((u) => u.serial).join("、")})`
              : "") +
            (p.result.errors.length > 0
              ? ` / 解釈できない値 ${p.result.errors.length}件`
              : ""),
        );
        for (const e of p.result.errors) {
          lines.push(`　${e.line}行目 ${e.serial}「${e.value}」`);
        }
      }
      setResult(lines);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "取り込みに失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-slate-800">出欠を貼り付けて取り込む</h2>
      <p className="text-xs leading-relaxed text-slate-500">
        エントリーフォームの回答シートを、<strong>見出しの行を含めて</strong>
        そのまま貼り付けてください。列を切り出す必要はありません。
        日付の入った見出しからリハを自動で対応づけます。
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className={inputClass}
        placeholder="シリアル&#9;ニックネーム&#9;…&#9;9/6(土) 18:00〜21:30 志村…&#9;リハ①遅刻・早退の時刻&#9;…"
      />
      <button
        type="button"
        onClick={handleParse}
        disabled={text.trim() === ""}
        className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white disabled:opacity-40"
      >
        読み取る
      </button>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {sheet && (
        <div className="space-y-3 border-t border-slate-100 pt-3">
          <label className="block">
            <span className={labelClass}>シリアルの列</span>
            <select
              value={serialColumn}
              onChange={(e) => setSerialColumn(Number(e.target.value))}
              className={inputClass}
            >
              <option value={-1}>選択してください</option>
              {sheet.header.map((h, i) => (
                <option key={i} value={i}>
                  {i + 1}列目: {h || "(見出しなし)"}
                </option>
              ))}
            </select>
          </label>

          {mappings.length === 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              日付を含む見出しが見つかりませんでした。出欠の列の見出しに「9/6」のような日付が必要です。
            </p>
          )}

          {mappings.map((m, idx) => (
            <div key={m.statusColumn} className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-500">
                {m.statusColumn + 1}列目
              </p>
              <p className="truncate text-sm text-slate-700">{m.header}</p>
              <label className="mt-2 block">
                <span className={labelClass}>対応するリハ</span>
                <select
                  value={m.rehearsalId}
                  onChange={(e) =>
                    setMappings((prev) =>
                      prev.map((p, i) =>
                        i === idx ? { ...p, rehearsalId: e.target.value } : p,
                      ),
                    )
                  }
                  className={inputClass}
                >
                  <option value="">取り込まない</option>
                  {rehearsals.map((r) => (
                    <option key={r.id} value={r.id}>
                      {toDateString(r.startsAt).slice(5).replace("-", "/")}{" "}
                      {r.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-2 block">
                <span className={labelClass}>遅刻・早退の時刻の列</span>
                <select
                  value={m.timeNoteColumn}
                  onChange={(e) =>
                    setMappings((prev) =>
                      prev.map((p, i) =>
                        i === idx
                          ? { ...p, timeNoteColumn: Number(e.target.value) }
                          : p,
                      ),
                    )
                  }
                  className={inputClass}
                >
                  <option value={-1}>使わない</option>
                  {sheet.header.map((h, i) => (
                    <option key={i} value={i}>
                      {i + 1}列目: {h || "(見出しなし)"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}

          {preview && preview.length > 0 && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-bold text-slate-700">取り込む内容</p>
              <ul className="mt-1 space-y-1 text-slate-600">
                {preview.map((p) => {
                  const name =
                    rehearsals.find((r) => r.id === p.mapping.rehearsalId)
                      ?.title ?? "";
                  const valid = p.result.rows.length - p.unknown.length;
                  return (
                    <li key={p.mapping.statusColumn}>
                      {name}: {valid}件
                      {p.unknown.length > 0 && (
                        <span className="font-bold text-amber-700">
                          {" "}
                          / 参加者に無いシリアル {p.unknown.length}件
                        </span>
                      )}
                      {p.result.errors.length > 0 && (
                        <span className="font-bold text-red-600">
                          {" "}
                          / 解釈できない値 {p.result.errors.length}件
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-slate-500">
                空欄は未回答として読み飛ばし、既存の回答は消しません。
                同じシリアルの回答は上書きします。
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={
              saving || serialColumn < 0 || !preview || preview.length === 0
            }
            className="w-full rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? "取り込み中…" : "取り込む"}
          </button>
        </div>
      )}

      {result && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {result.map((line, i) => (
            <p key={i} className={line.startsWith("　") ? "text-xs" : ""}>
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
