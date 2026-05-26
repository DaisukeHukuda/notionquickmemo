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
