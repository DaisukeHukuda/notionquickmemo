"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { DATABASES, DESTINATIONS, getDb } from "@/lib/databases";
import DestinationPicker, { useDestPrefs } from "./DestinationPicker";

type Phase = "idle" | "saved" | "error";

const SAVED_REVERT_MS = 2400;

// プル更新: 減衰後の引っ張り距離がこの値を超えたらリロード
const PULL_THRESHOLD = 54;
const PULL_MAX = 90;
const PULL_DAMPING = 0.4;
const PULL_START_SLACK = 8;

export default function Page() {
  const [destKey, setDestKey] = useState<string>(DESTINATIONS[0].key);
  const [task, setTask] = useState("");
  const [multiSelectValue, setMultiSelectValue] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [savedDbName, setSavedDbName] = useState("");
  const [errDetail, setErrDetail] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // プル更新
  // 保存先ボタンの表示名・並び順（この端末に保存）
  const destPrefs = useDestPrefs();
  const [editingDests, setEditingDests] = useState(false);
  const editingRef = useRef(false);
  editingRef.current = editingDests;

  const mainRef = useRef<HTMLElement>(null);
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  const dest = DESTINATIONS.find((d) => d.key === destKey) ?? DESTINATIONS[0];
  // ページ宛ての保存先はDBを持たない
  const db = dest.dbKey ? getDb(dest.dbKey) ?? DATABASES[0] : null;

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    let startY = 0;
    let eligible = false;
    let active = false;

    const onTouchStart = (e: TouchEvent) => {
      // 並べ替え中はプル更新を止める
      if (refreshingRef.current || editingRef.current) return;
      startY = e.touches[0].clientY;
      // textarea内部がスクロール済みのときは通常スクロールを優先
      const ta = textareaRef.current;
      const insideTextarea =
        ta && e.target instanceof Node && ta.contains(e.target);
      eligible = !insideTextarea || (ta?.scrollTop ?? 0) <= 0;
      active = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!eligible || refreshingRef.current) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > PULL_START_SLACK) {
        active = true;
        const dist = Math.min((dy - PULL_START_SLACK) * PULL_DAMPING, PULL_MAX);
        pullRef.current = dist;
        setPull(dist);
        setDragging(true);
        if (e.cancelable) e.preventDefault();
      } else if (active) {
        pullRef.current = 0;
        setPull(0);
      }
    };

    const onTouchEnd = () => {
      if (!active) return;
      active = false;
      setDragging(false);
      if (pullRef.current >= PULL_THRESHOLD) {
        refreshingRef.current = true;
        setRefreshing(true);
        window.location.reload();
      } else {
        pullRef.current = 0;
        setPull(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    };
  }, []);

  // 保存先を切り替えたらタグ選択はリセット
  useEffect(() => {
    setMultiSelectValue([]);
  }, [destKey]);

  const revertToIdle = () => {
    if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    setPhase("idle");
  };

  const handleSave = async () => {
    const trimmed = task.trim();
    if (!trimmed || phase === "saved") return;

    const submittedTask = trimmed;
    const submittedDest = dest;
    const submittedDb = db;
    const submittedMulti = multiSelectValue;

    let classifierPayload: string | string[] | undefined;
    if (submittedDb?.classifier?.type === "status") {
      classifierPayload = submittedDest.status ?? submittedDb.classifier.default;
    } else if (submittedDb?.classifier?.type === "multi_select") {
      classifierPayload = submittedMulti;
    }

    // 楽観的UI: 押した瞬間に入力をリセットし、保存先はInboxへ戻す
    setTask("");
    setDestKey(DESTINATIONS[0].key);
    setMultiSelectValue([]);
    setSavedDbName(destPrefs.labelOf(submittedDest.key));
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
          dbKey: submittedDb?.key,
          pageKey: submittedDest.pageKey,
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
      setDestKey(submittedDest.key);
      // destKey変更のeffectがタグを消すので、次のtickで復元する
      setTimeout(() => setMultiSelectValue(submittedMulti), 0);
      setErrDetail(err instanceof Error ? err.message : "");
      setPhase("error");
    }
  };

  const canSave = task.trim().length > 0;
  const saved = phase === "saved";
  const disabled = saved || !canSave;

  const pastThreshold = pull >= PULL_THRESHOLD;

  return (
    <main
      ref={mainRef}
      className="relative overflow-hidden h-dvh w-full max-w-xl mx-auto box-border"
    >
      {/* プル更新インジケーター */}
      <div
        aria-hidden={pull === 0 && !refreshing}
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-10 w-[34px] h-[34px] rounded-full flex items-center justify-center bg-white border border-[#E3E2E0] shadow-sm dark:bg-[#252525] dark:border-[#373737]"
        style={{
          top: pull - 42,
          opacity: refreshing ? 1 : Math.min(pull / PULL_THRESHOLD, 1),
          transition: dragging
            ? "none"
            : "top 0.2s ease, opacity 0.2s ease",
        }}
      >
        {refreshing ? (
          <svg
            className="animate-spin"
            width="16"
            height="16"
            viewBox="0 0 16 16"
          >
            <circle
              cx="8"
              cy="8"
              r="6"
              fill="none"
              strokeWidth="2"
              className="stroke-[#E3E2E0] dark:stroke-[#373737]"
            />
            <path
              d="M8 2a6 6 0 0 1 6 6"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              className="stroke-[#787774] dark:stroke-[#9B9B9B]"
            />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            style={{
              transform: pastThreshold ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
            }}
          >
            <path
              d="M7 1.5v11M2.5 8L7 12.5 11.5 8"
              fill="none"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-[#787774] dark:stroke-[#9B9B9B]"
            />
          </svg>
        )}
      </div>

      <div
        className="h-full flex flex-col px-5 pt-3 pb-[max(10px,env(safe-area-inset-bottom))] box-border"
        style={{
          transform: `translateY(${pull}px)`,
          transition: dragging ? "none" : "transform 0.2s ease",
        }}
      >
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

      {/* 保存先ボタン（編集モードで名前変更・並べ替え） */}
      <DestinationPicker
        selectedKey={destKey}
        onSelect={setDestKey}
        editing={editingDests}
        onEditingChange={setEditingDests}
        prefsApi={destPrefs}
      />

      {/* タグ（マルチセレクトを持つ保存先のときだけ） */}
      {db?.classifier?.type === "multi_select" && (
        <div className="flex flex-col gap-[7px] pt-[15px]">
          <div className="text-[11px] font-semibold tracking-[0.06em] text-[#787774] dark:text-[#9B9B9B]">
            分類
          </div>
          <div className="flex flex-wrap gap-[7px]">
            {db.classifier.options.map((opt) => {
              const selected = multiSelectValue.includes(opt);
              const onClick = () =>
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
      </div>
    </main>
  );
}
