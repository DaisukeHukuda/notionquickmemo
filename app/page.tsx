"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { DATABASES, getDb } from "@/lib/databases";

type Toast =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | null;

export default function Page() {
  const [dbKey, setDbKey] = useState<string>(DATABASES[0].key);
  const [task, setTask] = useState("");
  const [statusValue, setStatusValue] = useState<string>(() => {
    const c = DATABASES[0].classifier;
    return c?.type === "status" ? c.default : "";
  });
  const [multiSelectValue, setMultiSelectValue] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const db = getDb(dbKey) ?? DATABASES[0];

  // When the DB changes, reset the classifier state to that DB's defaults.
  useEffect(() => {
    if (db.classifier?.type === "status") {
      setStatusValue(db.classifier.default);
    } else {
      setStatusValue("");
    }
    setMultiSelectValue([]);
  }, [db]);

  const handleSave = async () => {
    const trimmed = task.trim();
    if (!trimmed || saving) return;

    const submittedTask = trimmed;
    const submittedDb = db;
    const submittedStatus = statusValue;
    const submittedMulti = multiSelectValue;

    let classifierPayload: string | string[] | undefined;
    if (submittedDb.classifier?.type === "status") {
      classifierPayload = submittedStatus || submittedDb.classifier.default;
    } else if (submittedDb.classifier?.type === "multi_select") {
      classifierPayload = submittedMulti;
    }

    setSaving(true);
    setTask("");
    if (submittedDb.classifier?.type === "status") {
      setStatusValue(submittedDb.classifier.default);
    }
    setMultiSelectValue([]);
    textareaRef.current?.focus();

    try {
      const res = await fetch("/api/memo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dbKey: submittedDb.key,
          task: submittedTask,
          classifier: classifierPayload,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `保存に失敗しました (${res.status})`);
      }

      setToast({
        kind: "success",
        message: `✓ ${submittedDb.name}に追加しました`,
      });
    } catch (err) {
      setTask(submittedTask);
      if (submittedDb.classifier?.type === "status") {
        setStatusValue(submittedStatus);
      }
      setMultiSelectValue(submittedMulti);
      const message =
        err instanceof Error ? err.message : "保存に失敗しました";
      setToast({ kind: "error", message });
    } finally {
      setSaving(false);
    }
  };

  const disabled = saving || task.trim().length === 0;

  const pillClass = (selected: boolean) =>
    `px-3 py-2 rounded-full text-sm border transition ${
      selected
        ? "bg-gray-900 text-white border-gray-900"
        : "bg-white text-gray-800 border-gray-300 hover:border-gray-500"
    }`;

  return (
    <main className="min-h-screen w-full px-4 py-6 flex flex-col gap-4 max-w-xl mx-auto">
      <header className="flex items-center gap-3">
        <Image
          src="/icon-192.png"
          alt="Notion Quick Memo logo"
          width={36}
          height={36}
          className="rounded-lg"
          priority
        />
        <h1 className="text-lg font-semibold text-gray-900">
          Notion Quick Memo
        </h1>
      </header>

      {/* DB selector tabs */}
      <div className="flex flex-wrap gap-2">
        {DATABASES.map((d) => {
          const selected = d.key === dbKey;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setDbKey(d.key)}
              className={`px-3 py-2 rounded-md text-sm font-medium border transition ${
                selected
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"
              }`}
            >
              {d.name}
            </button>
          );
        })}
      </div>

      {/* Classifier UI (depends on selected DB) */}
      {db.classifier?.type === "status" && (
        <div className="flex flex-wrap gap-2">
          {db.classifier.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setStatusValue(opt)}
              className={pillClass(opt === statusValue)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {db.classifier?.type === "multi_select" && (
        <div className="flex flex-wrap gap-2">
          {db.classifier.options.map((opt) => {
            const selected = multiSelectValue.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() =>
                  setMultiSelectValue((prev) =>
                    prev.includes(opt)
                      ? prev.filter((v) => v !== opt)
                      : [...prev, opt],
                  )
                }
                className={pillClass(selected)}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

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
          rows={6}
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
