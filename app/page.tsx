"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { DATABASES, getDb } from "@/lib/databases";

type Phase = "idle" | "saved" | "error";

const SAVED_REVERT_MS = 2400;

export default function Page() {
  const [dbKey, setDbKey] = useState<string>(DATABASES[0].key);
  const [task, setTask] = useState("");
  const [statusValue, setStatusValue] = useState<string>(() => {
    const c = DATABASES[0].classifier;
    return c?.type === "status" ? c.default : "";
  });
  const [multiSelectValue, setMultiSelectValue] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [savedDbName, setSavedDbName] = useState("");
  const [errDetail, setErrDetail] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const db = getDb(dbKey) ?? DATABASES[0];

  useEffect(() => {
    return () => {
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    };
  }, []);

  // DB切替時は分類の選択状態をそのDBのデフォルトへ戻す
  useEffect(() => {
    if (db.classifier?.type === "status") {
      setStatusValue(db.classifier.default);
    } else {
      setStatusValue("");
    }
    setMultiSelectValue([]);
  }, [db]);

  const revertToIdle = () => {
    if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    setPhase("idle");
  };

  const handleSave = async () => {
    const trimmed = task.trim();
    if (!trimmed || phase === "saved") return;

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

    // 楽観的UI: 押した瞬間に入力をリセットし、ボタンを✓表示にモーフ
    setTask("");
    if (submittedDb.classifier?.type === "status") {
      setStatusValue(submittedDb.classifier.default);
    }
    setMultiSelectValue([]);
    setSavedDbName(submittedDb.name);
    setPhase("saved");
    textareaRef.current?.focus();

    if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    revertTimerRef.current = setTimeout(() => {
      setPhase((p) => (p === "saved" ? "idle" : p));
    }, SAVED_REVERT_MS);

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
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
      setTask(submittedTask);
      if (submittedDb.classifier?.type === "status") {
        setStatusValue(submittedStatus);
      }
      setMultiSelectValue(submittedMulti);
      setErrDetail(err instanceof Error ? err.message : "");
      setPhase("error");
    }
  };

  const canSave = task.trim().length > 0;
  const saved = phase === "saved";
  const disabled = saved || !canSave;

  return (
    <main className="h-dvh w-full max-w-xl mx-auto px-5 pt-3 pb-[max(10px,env(safe-area-inset-bottom))] flex flex-col box-border">
      {/* ヘッダー */}
      <header className="flex items-center gap-[11px] pt-2 pb-4">
        <Image
          src="/icon-192.png"
          alt="Notion Quick Memo logo"
          width={36}
          height={36}
          className="rounded-lg"
          priority
        />
        <h1 className="text-base font-semibold tracking-[-0.01em] text-[#1F1F1F] dark:text-[#D4D4D4]">
          Notion Quick Memo
        </h1>
      </header>

      {/* 保存先タブ */}
      <div className="flex flex-col gap-[7px]">
        <div className="text-[11px] font-semibold tracking-[0.06em] text-[#787774] dark:text-[#9B9B9B]">
          保存先
        </div>
        <div className="flex flex-wrap gap-2">
          {DATABASES.map((d) => {
            const selected = d.key === dbKey;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setDbKey(d.key)}
                className={`h-[38px] px-3.5 rounded-full text-[13px] border inline-flex items-center whitespace-nowrap transition-colors duration-150 active:scale-[0.97] ${
                  selected
                    ? "bg-[#4F46E5] border-[#4F46E5] text-white font-semibold dark:bg-[#6360DE] dark:border-[#6360DE]"
                    : "bg-transparent border-[#E3E2E0] text-[#1F1F1F] font-medium dark:border-[#373737] dark:text-[#D4D4D4]"
                }`}
              >
                {d.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 分類チップ（選択中DBに依存） */}
      {db.classifier && (
        <div className="flex flex-col gap-[7px] pt-[15px]">
          <div className="text-[11px] font-semibold tracking-[0.06em] text-[#787774] dark:text-[#9B9B9B]">
            {db.classifier.type === "status" ? "ステータス" : "分類"}
          </div>
          <div className="flex flex-wrap gap-[7px]">
            {db.classifier.options.map((opt) => {
              const selected =
                db.classifier!.type === "status"
                  ? opt === statusValue
                  : multiSelectValue.includes(opt);
              const onClick =
                db.classifier!.type === "status"
                  ? () => setStatusValue(opt)
                  : () =>
                      setMultiSelectValue((prev) =>
                        prev.includes(opt)
                          ? prev.filter((v) => v !== opt)
                          : [...prev, opt],
                      );
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={onClick}
                  className={`h-[30px] px-3 rounded-full text-[12.5px] border inline-flex items-center whitespace-nowrap transition-colors duration-150 active:scale-[0.96] ${
                    selected
                      ? "bg-[#1F1F1F] border-[#1F1F1F] text-white font-semibold dark:bg-[#EDEDEC] dark:border-[#EDEDEC] dark:text-[#191919]"
                      : "bg-transparent border-[#E3E2E0] text-[#787774] font-medium dark:border-[#373737] dark:text-[#9B9B9B]"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* エラーバナー */}
      {phase === "error" && (
        <div
          role="alert"
          onClick={revertToIdle}
          className="mt-3 px-3 py-2.5 rounded-lg text-[12.5px] leading-relaxed bg-[#FDEBEC] border border-[#F3D5D3] text-[#C4554D] dark:bg-[rgba(235,87,87,0.12)] dark:border-[rgba(235,87,87,0.28)] dark:text-[#E16F6C]"
        >
          保存に失敗しました。入力内容は保持しています — もう一度お試しください。
          {errDetail && (
            <span className="block mt-1 text-[11px] opacity-70">
              {errDetail}
            </span>
          )}
        </div>
      )}

      {/* 入力欄（残り全高を使う） */}
      <div className="flex-1 flex min-h-0 pt-3">
        <textarea
          ref={textareaRef}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={task}
          onChange={(e) => {
            setTask(e.target.value);
            if (phase !== "idle") revertToIdle();
          }}
          onFocus={() => {
            if (phase === "saved") revertToIdle();
          }}
          placeholder="メモを書く…"
          className="flex-1 min-h-0 resize-none rounded-xl border border-[#E3E2E0] px-3.5 py-3 text-base leading-[1.7] outline-none transition-colors duration-150 bg-white text-[#1F1F1F] focus:border-[#1F1F1F] dark:bg-[#191919] dark:text-[#D4D4D4] dark:border-[#373737] dark:focus:border-[#D4D4D4]"
        />
      </div>

      {/* 保存ボタン（✓にモーフ） */}
      <div className="pt-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled}
          className={`w-full h-[54px] rounded-xl text-[15px] font-semibold border-none transition-colors duration-150 ${
            saved
              ? "bg-[#448361] text-white dark:bg-[#3E8B5F] animate-[qmPop_0.3s_cubic-bezier(0.34,1.56,0.64,1)] cursor-default"
              : canSave
                ? "bg-[#4F46E5] text-white dark:bg-[#6360DE] active:scale-[0.985]"
                : "bg-[#F1F1EF] text-[#B9B7B4] dark:bg-[#2C2C2C] dark:text-[#6E6E6E] cursor-default"
          }`}
        >
          {saved ? `✓ ${savedDbName}に追加しました` : "保存する"}
        </button>
      </div>
    </main>
  );
}
