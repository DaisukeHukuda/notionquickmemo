"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DESTINATIONS } from "@/lib/databases";

// 表示名と並び順はこの端末（localStorage）だけに保存する。
// 書き込み先のNotion側の名前は変わらない。
const PREFS_KEY = "qm-dest-prefs-v1";

export type DestPrefs = {
  order: string[];
  labels: Record<string, string>;
};

const DEFAULT_PREFS: DestPrefs = {
  order: DESTINATIONS.map((d) => d.key),
  labels: {},
};

// 保存済みの設定を現在の保存先一覧と突き合わせる（消えたキーは捨て、新しいキーは末尾へ）
function normalize(prefs: DestPrefs): DestPrefs {
  const known = new Set(DESTINATIONS.map((d) => d.key));
  const order = prefs.order.filter((k) => known.has(k));
  for (const d of DESTINATIONS) if (!order.includes(d.key)) order.push(d.key);
  const labels: Record<string, string> = {};
  for (const [k, v] of Object.entries(prefs.labels)) {
    if (known.has(k) && v.trim()) labels[k] = v.trim();
  }
  return { order, labels };
}

export function useDestPrefs() {
  const [prefs, setPrefs] = useState<DestPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) setPrefs(normalize(JSON.parse(raw)));
    } catch {
      // 読めなければ初期状態のまま
    }
  }, []);

  const update = (next: DestPrefs) => {
    const n = normalize(next);
    setPrefs(n);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(n));
    } catch {
      // 保存できなくても画面上は反映しておく
    }
  };

  const reset = () => update(DEFAULT_PREFS);

  const labelOf = (key: string) =>
    prefs.labels[key] ?? DESTINATIONS.find((d) => d.key === key)?.label ?? key;

  return { prefs, update, reset, labelOf };
}

const chipBase =
  "h-[38px] px-3.5 rounded-full text-[13px] border inline-flex items-center whitespace-nowrap transition-colors duration-150";
const chipSelected =
  "bg-[#4F46E5] border-[#4F46E5] text-white font-semibold dark:bg-[#6360DE] dark:border-[#6360DE]";
const chipIdle =
  "bg-transparent border-[#E3E2E0] text-[#1F1F1F] font-medium dark:border-[#373737] dark:text-[#D4D4D4]";

function SortableChip({
  id,
  label,
  selected,
  renaming,
  onTap,
  onCommit,
}: {
  id: string;
  label: string;
  selected: boolean;
  renaming: boolean;
  onTap: () => void;
  onCommit: (value: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: renaming });
  const [draft, setDraft] = useState(label);

  useEffect(() => {
    if (renaming) setDraft(label);
  }, [renaming, label]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };

  if (renaming) {
    return (
      <input
        ref={setNodeRef as unknown as React.Ref<HTMLInputElement>}
        style={style}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        // タップした時点で元の名前を全選択し、打てばそのまま置き換わるようにする
        onFocus={(e) => e.target.select()}
        onBlur={() => onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={`${chipBase} w-[11em] border-[#4F46E5] outline-none bg-white text-base text-[#1F1F1F] dark:bg-[#252525] dark:text-[#D4D4D4] dark:border-[#6360DE]`}
      />
    );
  }

  return (
    <button
      ref={setNodeRef}
      style={style}
      type="button"
      onClick={onTap}
      {...attributes}
      {...listeners}
      // 通常時と同じ幅・同じ選択色にして、編集前後で並びがずれないようにする
      className={`${chipBase} ${selected ? chipSelected : chipIdle} border-dashed touch-none select-none ${
        isDragging ? "shadow-md opacity-90" : ""
      }`}
    >
      {label}
    </button>
  );
}

export default function DestinationPicker({
  selectedKey,
  onSelect,
  editing,
  onEditingChange,
  prefsApi,
}: {
  selectedKey: string;
  onSelect: (key: string) => void;
  editing: boolean;
  onEditingChange: (v: boolean) => void;
  prefsApi: ReturnType<typeof useDestPrefs>;
}) {
  const { prefs, update, reset, labelOf } = prefsApi;
  const [renamingKey, setRenamingKey] = useState<string | null>(null);

  // 長押し(タッチ)で掴む。タップは名前変更に使うので区別する
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 6 },
    }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = prefs.order.indexOf(String(active.id));
    const to = prefs.order.indexOf(String(over.id));
    update({ ...prefs, order: arrayMove(prefs.order, from, to) });
  };

  const commitLabel = (key: string, value: string) => {
    const labels = { ...prefs.labels };
    const def = DESTINATIONS.find((d) => d.key === key)?.label;
    if (!value.trim() || value.trim() === def) delete labels[key];
    else labels[key] = value.trim();
    update({ ...prefs, labels });
    setRenamingKey(null);
  };

  const finish = () => {
    setRenamingKey(null);
    onEditingChange(false);
  };

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold tracking-[0.06em] text-[#787774] dark:text-[#9B9B9B]">
          保存先
        </div>
        <div className="flex items-center gap-3">
          {editing && (
            <button
              type="button"
              onClick={() => {
                if (confirm("ボタンの名前と並び順を初期状態に戻しますか？")) {
                  reset();
                  setRenamingKey(null);
                }
              }}
              className="text-[12px] text-[#787774] dark:text-[#9B9B9B]"
            >
              初期状態に戻す
            </button>
          )}
          <button
            type="button"
            onClick={() => (editing ? finish() : onEditingChange(true))}
            className={`text-[12px] font-semibold ${
              editing
                ? "text-[#4F46E5] dark:text-[#A3A0FF]"
                : "text-[#787774] dark:text-[#9B9B9B]"
            }`}
          >
            {editing ? "完了" : "編集"}
          </button>
        </div>
      </div>

      {editing ? (
        <>
          <div className="text-[11.5px] text-[#787774] dark:text-[#9B9B9B]">
            タップで名前を変更・長押しでドラッグして並べ替え
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={prefs.order} strategy={rectSortingStrategy}>
              <div className="flex flex-wrap gap-2">
                {prefs.order.map((key) => (
                  <SortableChip
                    key={key}
                    id={key}
                    label={labelOf(key)}
                    selected={key === selectedKey}
                    renaming={renamingKey === key}
                    onTap={() => setRenamingKey(key)}
                    onCommit={(v) => commitLabel(key, v)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          {prefs.order.map((key) => {
            const selected = key === selectedKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(key)}
                className={`${chipBase} active:scale-[0.97] ${
                  selected ? chipSelected : chipIdle
                }`}
              >
                {labelOf(key)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
