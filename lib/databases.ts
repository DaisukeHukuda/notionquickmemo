export type StatusClassifier = {
  type: "status";
  propName: string;
  options: readonly string[];
  default: string;
};

export type MultiSelectClassifier = {
  type: "multi_select";
  propName: string;
  options: readonly string[];
};

export type Classifier = StatusClassifier | MultiSelectClassifier | null;

export type DbConfig = {
  key: string;
  name: string;
  databaseId: string;
  titleProp: string;
  classifier: Classifier;
};

export const DATABASES: readonly DbConfig[] = [
  {
    key: "tray",
    name: "Tray",
    databaseId: "659e0965c6ed4439b182f39ad458b7cb",
    titleProp: "タスク",
    classifier: {
      type: "status",
      propName: "GTD種別",
      options: [
        "Inbox",
        "次に取る行動",
        "プロジェクト",
        "温めるアイデア",
        "Today's 進行中",
      ],
      default: "Inbox",
    },
  },
  {
    key: "jojo_thoughts",
    name: "じょじょを考えたこと",
    databaseId: "30add4ae813380719bf2d779fe7d9919",
    titleProp: "名前",
    classifier: null,
  },
  {
    key: "jojo_places",
    name: "じょじょと行きたい場所リスト",
    databaseId: "294dd4ae813380cc8a04cfd9456fd006",
    titleProp: "名前",
    classifier: {
      type: "multi_select",
      propName: "マルチセレクト",
      options: ["国内", "国外", "日光", "県外"],
    },
  },
] as const;

export function getDb(key: string): DbConfig | undefined {
  return DATABASES.find((d) => d.key === key);
}

// 末尾にチェックボックスで追記する先のページ。
export type PageConfig = {
  key: string;
  name: string;
  pageId: string;
};

export const PAGES: readonly PageConfig[] = [
  { key: "iwasaki", name: "作業メモ：岩崎くん", pageId: "a021f6f636f5438e9aed73576fa22316" },
  { key: "hoshino", name: "作業メモ：星野さん", pageId: "230afda7dd14447da49f15b93ea46f17" },
];

export function getPage(key: string): PageConfig | undefined {
  return PAGES.find((p) => p.key === key);
}

// 画面に並ぶ保存先ボタン。TrayはGTD種別を固定値で書き込む。
// dbKeyかpageKeyのどちらか一方を持つ。
export type Destination = {
  key: string;
  label: string;
  dbKey?: string;
  status?: string;
  pageKey?: string;
};

export const DESTINATIONS: readonly Destination[] = [
  { key: "inbox", label: "Inbox", dbKey: "tray", status: "Inbox" },
  { key: "next", label: "次に取る", dbKey: "tray", status: "次に取る行動" },
  { key: "today", label: "Today's", dbKey: "tray", status: "Today's 進行中" },
  { key: "iwasaki", label: "岩崎", pageKey: "iwasaki" },
  { key: "hoshino", label: "星野", pageKey: "hoshino" },
  { key: "jojo_thoughts", label: "J考え", dbKey: "jojo_thoughts" },
  { key: "jojo_places", label: "J場所", dbKey: "jojo_places" },
];
