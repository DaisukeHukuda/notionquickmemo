"use client";

import { useEffect, useRef, useState } from "react";

const GTD_TYPES = [
  "Inbox",
  "次に取る行動",
  "プロジェクト",
  "温めるアイデア",
  "Today's 進行中",
  "Today's 完了",
  "アーカイブ",
] as const;

type GtdType = (typeof GTD_TYPES)[number];
const DEFAULT_GTD: GtdType = "Inbox";

type Toast =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | null;

export default function Page() {
  const [task, setTask] = useState("");
  const [gtdType, setGtdType] = useState<GtdType>(DEFAULT_GTD);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (t: Toast, autoHideMs?: number) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(t);
    if (t && autoHideMs) {
      toastTimerRef.current = setTimeout(() => setToast(null), autoHideMs);
    }
  };

  const handleSave = async () => {
    const trimmed = task.trim();
    if (!trimmed || saving) return;

    const submittedTask = trimmed;
    const submittedGtd = gtdType;

    setSaving(true);
    setTask("");
    setGtdType(DEFAULT_GTD);
    textareaRef.current?.focus();

    try {
      const res = await fetch("/api/memo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: submittedTask, gtdType: submittedGtd }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `保存に失敗しました (${res.status})`);
      }

      showToast({ kind: "success", message: "✓ Trayに追加しました" }, 1500);
    } catch (err) {
      setTask(submittedTask);
      setGtdType(submittedGtd);
      const message = err instanceof Error ? err.message : "保存に失敗しました";
      showToast({ kind: "error", message });
    } finally {
      setSaving(false);
    }
  };

  const disabled = saving || task.trim().length === 0;

  return (
    <main className="min-h-screen w-full px-4 py-6 flex flex-col gap-4 max-w-xl mx-auto">
      {toast && (
        <div
          role="status"
          className={`fixed left-1/2 -translate-x-1/2 top-4 z-50 px-4 py-2 rounded-lg shadow-md text-sm ${
            toast.kind === "success"
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white"
          }`}
          onClick={() => toast.kind === "error" && setToast(null)}
        >
          {toast.message}
        </div>
      )}

      <textarea
        ref={textareaRef}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        value={task}
        onChange={(e) => setTask(e.target.value)}
        placeholder="思いついたタスクを入力..."
        rows={3}
        className="w-full resize-y rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-200 text-base leading-relaxed"
      />

      <div className="flex flex-wrap gap-2">
        {GTD_TYPES.map((type) => {
          const selected = type === gtdType;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setGtdType(type)}
              className={`px-3 py-2 rounded-full text-sm border transition ${
                selected
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-800 border-gray-300 hover:border-gray-500"
              }`}
            >
              {type}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={disabled}
        className={`w-full min-h-[56px] rounded-xl text-base font-semibold transition ${
          disabled
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-gray-900 text-white active:bg-gray-700"
        }`}
      >
        {saving ? "保存中..." : "保存"}
      </button>
    </main>
  );
}
