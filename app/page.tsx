"use client";

import { useEffect, useRef, useState } from "react";

const GTD_TYPES = [
  "Inbox",
  "次に取る行動",
  "プロジェクト",
  "温めるアイデア",
  "Today's 進行中",
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

      showToast({ kind: "success", message: "✓ Trayに追加しました" });
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

      {toast?.kind === "error" && (
        <div
          role="alert"
          onClick={() => setToast(null)}
          className="rounded-lg px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-200"
        >
          {toast.message}
        </div>
      )}

      <div className="relative w-full">
        <textarea
          ref={textareaRef}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={task}
          onChange={(e) => {
            setTask(e.target.value);
            if (toast) setToast(null);
          }}
          onClick={() => {
            if (toast?.kind === "success") setToast(null);
          }}
          placeholder={
            toast?.kind === "success" ? "" : "思いついたタスクを入力..."
          }
          rows={3}
          className="w-full resize-y rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-200 text-base leading-relaxed"
        />
        {toast?.kind === "success" && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute left-4 top-3 right-4 text-base text-emerald-700 font-medium"
          >
            {toast.message}
          </div>
        )}
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
