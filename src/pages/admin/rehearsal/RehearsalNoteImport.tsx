import { useMemo, useState } from "react";
import { parseNote, type NoteRehearsal } from "../../../lib/rehearsalNoteImport";
import { createRehearsal } from "../../../lib/rehearsalsAdminApi";
import type { Rehearsal } from "../../../types/rehearsal";
import { formatDateLabel, jstToIso, toDateString } from "../../../lib/time";
import { rehearsalLabel } from "../../../lib/rehearsals";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base";
const labelClass = "text-sm font-medium text-slate-600";

/** 画面上で直せるようにした読み取り結果 */
interface Draft extends NoteRehearsal {
  include: boolean;
}

function toDraft(row: NoteRehearsal): Draft {
  return { ...row, include: true };
}

/** 同じ日に登録済みのリハがあれば返す(二重登録に気づけるようにする) */
function findSameDay(
  draft: Draft,
  rehearsals: Rehearsal[],
): Rehearsal | undefined {
  return rehearsals.find((r) => toDateString(r.startsAt) === draft.date);
}

export default function RehearsalNoteImport({
  festivalId,
  rehearsals,
  onDone,
}: {
  festivalId: string;
  rehearsals: Rehearsal[];
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string[] | null>(null);

  function handleParse() {
    setError(null);
    setResult(null);
    const rows = parseNote(text);
    if (rows.length === 0) {
      setDrafts(null);
      setError(
        "リハの予定が見つかりませんでした。「9/5土 18:00〜21:30」のように、月日ではじまる行が必要です。",
      );
      return;
    }
    setDrafts(rows.map(toDraft));
  }

  function update(index: number, patch: Partial<Draft>) {
    setDrafts((prev) =>
      prev ? prev.map((d, i) => (i === index ? { ...d, ...patch } : d)) : prev,
    );
  }

  // 登録できない行を先に出す(押してから怒られないように)
  const problems = useMemo(() => {
    if (!drafts) return [];
    return drafts.flatMap((d, i) => {
      if (!d.include) return [];
      const missing: string[] = [];
      if (!d.venueName.trim()) missing.push("会場名");
      if (!d.date || !d.startTime) missing.push("日付と開始時刻");
      return missing.length > 0 ? [{ index: i, missing }] : [];
    });
  }, [drafts]);

  const targets = drafts?.filter((d) => d.include) ?? [];
  const canSave = targets.length > 0 && problems.length === 0 && !saving;

  async function handleSave() {
    if (!drafts) return;
    setSaving(true);
    setError(null);
    const lines: string[] = [];
    try {
      for (const d of drafts) {
        if (!d.include) continue;
        const startsAt = jstToIso(d.date, d.startTime ?? "");
        if (!startsAt) continue;
        await createRehearsal({
          festivalId,
          title: d.title.trim(),
          startsAt,
          endsAt: d.endTime ? jstToIso(d.date, d.endTime) : null,
          venueName: d.venueName.trim(),
          venueUrl: d.venueUrl?.trim() || null,
          venueAddress: null,
          note: d.note.trim() || null,
          isCancelled: false,
        });
        lines.push(`${formatDateLabel(d.date)} ${d.venueName.trim()}`);
      }
      setResult(lines);
      setDrafts(null);
      setText("");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-slate-800">
        LINEのノートから読み取る
      </h2>
      <p className="text-xs leading-relaxed text-slate-500">
        ノートの本文をそのまま貼り付けてください。「リハーサル」の見出しがあれば、
        その部分だけを読み取ります。読み取った内容はこの画面で直せます。
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className={`${inputClass} font-mono text-xs`}
        placeholder={"🔸リハーサル\n①9/5土　18:00〜21:30\n志村コミュニティホール第一レク\nhttps://…\n配置、構成確認"}
      />
      <button
        type="button"
        onClick={handleParse}
        disabled={text.trim() === ""}
        className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white disabled:bg-slate-300"
      >
        読み取る
      </button>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p className="font-bold">{result.length}件を登録しました</p>
          {result.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}

      {drafts && (
        <div className="space-y-3 border-t border-slate-100 pt-3">
          <p className="text-sm font-bold text-slate-700">
            {drafts.length}件を読み取りました
          </p>

          {drafts.map((d, i) => {
            const sameDay = findSameDay(d, rehearsals);
            const problem = problems.find((p) => p.index === i);
            return (
              <div
                key={i}
                className={`rounded-lg p-3 ${d.include ? "bg-slate-50" : "bg-slate-100 opacity-60"}`}
              >
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={d.include}
                    onChange={(e) => update(i, { include: e.target.checked })}
                    className="mt-1 size-4"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                    {d.sourceLine}
                  </span>
                </label>

                {sameDay && d.include && (
                  <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                    同じ日に「{rehearsalLabel(sameDay)}」が既に登録されています。
                    重複して登録されないよう、チェックを外すか内容を確認してください。
                  </p>
                )}

                {d.include && (
                  <div className="mt-2 space-y-2">
                    <label className="block">
                      <span className={labelClass}>日付 *</span>
                      <input
                        type="date"
                        value={d.date}
                        onChange={(e) => update(i, { date: e.target.value })}
                        className={inputClass}
                      />
                    </label>

                    {/* 端末のロケールによっては AM/PM が付くため、時刻は2つで1行使う */}
                    <div className="flex gap-2">
                      <label className="block min-w-0 flex-1">
                        <span className={labelClass}>開始 *</span>
                        <input
                          type="time"
                          value={d.startTime ?? ""}
                          onChange={(e) =>
                            update(i, { startTime: e.target.value || null })
                          }
                          className={inputClass}
                        />
                      </label>
                      <label className="block min-w-0 flex-1">
                        <span className={labelClass}>終了</span>
                        <input
                          type="time"
                          value={d.endTime ?? ""}
                          onChange={(e) =>
                            update(i, { endTime: e.target.value || null })
                          }
                          className={inputClass}
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className={labelClass}>会場名 *</span>
                      <input
                        value={d.venueName}
                        onChange={(e) =>
                          update(i, { venueName: e.target.value })
                        }
                        className={`${inputClass} ${d.venueName.trim() === "" ? "border-red-400" : ""}`}
                      />
                    </label>

                    <label className="block">
                      <span className={labelClass}>会場のURL</span>
                      <input
                        value={d.venueUrl ?? ""}
                        onChange={(e) =>
                          update(i, { venueUrl: e.target.value || null })
                        }
                        className={`${inputClass} text-xs`}
                      />
                    </label>

                    <label className="block">
                      <span className={labelClass}>目的・内容(任意)</span>
                      <input
                        value={d.title}
                        onChange={(e) => update(i, { title: e.target.value })}
                        placeholder="踊りこみ、固め"
                        className={inputClass}
                      />
                    </label>

                    <label className="block">
                      <span className={labelClass}>特記事項</span>
                      <textarea
                        value={d.note}
                        onChange={(e) => update(i, { note: e.target.value })}
                        rows={2}
                        className={`${inputClass} text-sm`}
                      />
                    </label>

                    {problem && (
                      <p className="text-xs font-bold text-red-600">
                        {problem.missing.join("・")}が空です
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <p className="text-xs text-slate-500">
            住所は読み取れないため空のままになります。地図は会場名での検索で開きます。
          </p>

          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="w-full rounded-xl bg-emerald-700 py-3 font-bold text-white disabled:bg-slate-300"
          >
            {saving ? "登録中…" : `${targets.length}件を登録する`}
          </button>
        </div>
      )}
    </div>
  );
}
