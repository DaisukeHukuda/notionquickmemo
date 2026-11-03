"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { DESTINATIONS } from "@/lib/databases";

// 表示名と配置はこの端末（localStorage）だけに保存する。
// 書き込み先のNotion側の名前は変わらない。
const PREFS_KEY = "qm-dest-prefs-v1";

type Pos = { x: number; y: number };

export type DestPrefs = {
  order: string[];
  labels: Record<string, string>;
  // 未設定なら左詰めの自動配置。一度でも動かすと全ボタンの座標を固定で持つ
  positions?: Record<string, Pos>;
};

const DEFAULT_PREFS: DestPrefs = {
  order: DESTINATIONS.map((d) => d.key),
  labels: {},
};

const CHIP_H = 38;
const GAP = 8;
const SNAP = 4;
// 縦は段（行）単位で揃える。横は自由
const ROW = CHIP_H + GAP;
const snapRow = (y: number) => Math.max(0, Math.round(y / ROW) * ROW);
// 編集中は下に1段分の空きを作り、今より下の段にも置けるようにする
const EDIT_EXTRA_H = ROW;

// 保存済みの設定を現在の保存先一覧と突き合わせる（消えたキーは捨て、新しいキーは末尾へ）
function normalize(prefs: DestPrefs): DestPrefs {
  const known = new Set(DESTINATIONS.map((d) => d.key));
  const order = prefs.order.filter((k) => known.has(k));
  for (const d of DESTINATIONS) if (!order.includes(d.key)) order.push(d.key);
  const labels: Record<string, string> = {};
  for (const [k, v] of Object.entries(prefs.labels ?? {})) {
    if (known.has(k) && v.trim()) labels[k] = v.trim();
  }
  let positions: Record<string, Pos> | undefined;
  if (prefs.positions) {
    positions = {};
    for (const [k, p] of Object.entries(prefs.positions)) {
      // 以前の保存で段の途中にあるものも、一番近い段に揃える
      if (known.has(k)) positions[k] = { x: p.x, y: snapRow(p.y) };
    }
    // 座標を持たない新しい保存先は、一番下の段に1つずつ置く
    let bottom = Math.max(0, ...Object.values(positions).map((p) => p.y + ROW));
    for (const k of order) {
      if (!positions[k]) {
        positions[k] = { x: 0, y: bottom };
        bottom += ROW;
      }
    }
  }
  return { order, labels, positions };
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
  "bg-white border-[#E3E2E0] text-[#1F1F1F] font-medium dark:bg-[#191919] dark:border-[#373737] dark:text-[#D4D4D4]";

function DraggableChip({
  id,
  label,
  selected,
  pos,
  editing,
  renaming,
  containerWidth,
  registerRef,
  onTap,
  onCommit,
}: {
  id: string;
  label: string;
  selected: boolean;
  pos: Pos;
  editing: boolean;
  renaming: boolean;
  containerWidth: number;
  registerRef: (el: HTMLElement | null) => void;
  onTap: () => void;
  onCommit: (value: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id, disabled: !editing || renaming });
  const [draft, setDraft] = useState(label);

  useEffect(() => {
    if (renaming) setDraft(label);
  }, [renaming, label]);

  const style: React.CSSProperties = {
    position: "absolute",
    left: pos.x,
    top: pos.y,
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 20 : undefined,
  };

  if (renaming) {
    const inputW = Math.min(180, containerWidth);
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        // タップした時点で元の名前を全選択し、打てばそのまま置き換わるようにする
        onFocus={(e) => e.target.select()}
        onBlur={() => onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        style={{ ...style, left: Math.min(pos.x, containerWidth - inputW), width: inputW, zIndex: 30 }}
        className={`${chipBase} border-[#4F46E5] outline-none bg-white text-base text-[#1F1F1F] dark:bg-[#252525] dark:text-[#D4D4D4] dark:border-[#6360DE]`}
      />
    );
  }

  return (
    <button
      ref={(el) => {
        setNodeRef(el);
        registerRef(el);
      }}
      style={style}
      type="button"
      onClick={onTap}
      {...(editing ? attributes : {})}
      {...(editing ? listeners : {})}
      className={`${chipBase} ${selected ? chipSelected : chipIdle} ${
        editing ? "border-dashed touch-none select-none" : "active:scale-[0.97]"
      } ${isDragging ? "shadow-md opacity-90" : ""}`}
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
  const containerRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Record<string, HTMLElement | null>>({});
  const [containerWidth, setContainerWidth] = useState(0);

  // 長押し(タッチ)で掴む。タップは名前変更に使うので区別する
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 6 },
    }),
  );

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
    // 自動配置⇔固定配置で入れ物の要素が入れ替わるので付け直す
  }, [!!prefs.positions]);

  const positions = prefs.positions;

  // 名前を長くして右端からはみ出したら、はみ出さない位置まで左へ寄せる
  useLayoutEffect(() => {
    if (!positions || !containerWidth) return;
    let changed = false;
    const next = { ...positions };
    for (const [k, p] of Object.entries(positions)) {
      const w = chipRefs.current[k]?.offsetWidth ?? 0;
      if (w && p.x + w > containerWidth) {
        next[k] = { ...p, x: Math.max(0, containerWidth - w) };
        changed = true;
      }
    }
    if (changed) update({ ...prefs, positions: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.labels, containerWidth, positions]);

  // 自動配置（左詰め）の今の見た目を、そのまま固定座標として取り込む
  const captureFlowPositions = (): Record<string, Pos> => {
    const box = containerRef.current?.getBoundingClientRect();
    const out: Record<string, Pos> = {};
    for (const k of prefs.order) {
      const r = chipRefs.current[k]?.getBoundingClientRect();
      if (box && r) out[k] = { x: Math.round(r.left - box.left), y: Math.round(r.top - box.top) };
    }
    return out;
  };

  const startEditing = () => {
    if (!positions) update({ ...prefs, positions: captureFlowPositions() });
    onEditingChange(true);
  };

  const finish = () => {
    setRenamingKey(null);
    onEditingChange(false);
  };

  const maxBottom = positions
    ? Math.max(CHIP_H, ...Object.values(positions).map((p) => p.y + CHIP_H))
    : 0;
  const areaHeight = maxBottom + (editing ? EDIT_EXTRA_H : 0);

  const handleDragEnd = (e: DragEndEvent) => {
    if (!positions) return;
    const key = String(e.active.id);
    const cur = positions[key];
    const w = chipRefs.current[key]?.offsetWidth ?? 0;
    const snap = (v: number) => Math.round(v / SNAP) * SNAP;
    const x = Math.min(Math.max(0, snap(cur.x + e.delta.x)), Math.max(0, containerWidth - w));
    const lastRowY = Math.floor((areaHeight - CHIP_H) / ROW) * ROW;
    const y = Math.min(snapRow(cur.y + e.delta.y), lastRowY);

    // 他のボタンに重なる場所なら元の位置に戻す
    const hits = Object.entries(positions).some(([k, p]) => {
      if (k === key) return false;
      const ow = chipRefs.current[k]?.offsetWidth ?? 0;
      return x < p.x + ow + 2 && x + w + 2 > p.x && y < p.y + CHIP_H + 2 && y + CHIP_H + 2 > p.y;
    });
    if (hits) return;

    // 上に空きができたら全体を詰め、余計な余白が残らないようにする
    const moved = { ...positions, [key]: { x, y } };
    const minY = Math.min(...Object.values(moved).map((p) => p.y));
    if (minY > 0) for (const k of Object.keys(moved)) moved[k] = { ...moved[k], y: moved[k].y - minY };
    update({ ...prefs, positions: moved });
  };

  const commitLabel = (key: string, value: string) => {
    const labels = { ...prefs.labels };
    const def = DESTINATIONS.find((d) => d.key === key)?.label;
    if (!value.trim() || value.trim() === def) delete labels[key];
    else labels[key] = value.trim();
    update({ ...prefs, labels });
    setRenamingKey(null);
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
                if (confirm("ボタンの名前と配置を初期状態に戻しますか？")) {
                  reset();
                  setRenamingKey(null);
                  onEditingChange(false);
                }
              }}
              className="text-[12px] text-[#787774] dark:text-[#9B9B9B]"
            >
              初期状態に戻す
            </button>
          )}
          <button
            type="button"
            onClick={() => (editing ? finish() : startEditing())}
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

      {positions ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div
            ref={containerRef}
            className={`relative w-full ${
              editing
                ? "rounded-lg bg-[#F7F7F5] outline outline-1 outline-dashed outline-[#E3E2E0] dark:bg-[#202020] dark:outline-[#373737]"
                : ""
            }`}
            style={{ height: areaHeight }}
          >
            {prefs.order.map((key) => (
              <DraggableChip
                key={key}
                id={key}
                label={labelOf(key)}
                selected={key === selectedKey}
                pos={positions[key]}
                editing={editing}
                renaming={renamingKey === key}
                containerWidth={containerWidth}
                registerRef={(el) => (chipRefs.current[key] = el)}
                onTap={() => (editing ? setRenamingKey(key) : onSelect(key))}
                onCommit={(v) => commitLabel(key, v)}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <div ref={containerRef} className="relative flex flex-wrap gap-2">
          {prefs.order.map((key) => (
            <button
              key={key}
              ref={(el) => {
                chipRefs.current[key] = el;
              }}
              type="button"
              onClick={() => onSelect(key)}
              className={`${chipBase} active:scale-[0.97] ${
                key === selectedKey ? chipSelected : chipIdle
              }`}
            >
              {labelOf(key)}
            </button>
          ))}
        </div>
      )}

      {/* ボタンの位置がずれないよう、説明はボタンの下に出す */}
      {editing && (
        <div className="text-[11.5px] text-[#787774] dark:text-[#9B9B9B]">
          タップで名前を変更・長押しで好きな場所へ移動
        </div>
      )}
    </div>
  );
}
