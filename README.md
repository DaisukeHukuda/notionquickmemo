# Notion Quick Memo

スマホのホーム画面から1タップで起動し、NotionのTrayデータベースに新規タスクを追加するだけの、自分専用Webアプリ（Phase 0）。

## 技術スタック

- Next.js 14（App Router）+ TypeScript
- Tailwind CSS
- [@notionhq/client](https://github.com/makenotion/notion-sdk-js)
- Vercelホスティング
- PWA対応（iOS / Androidのホーム画面に追加可能）

## 必要なNotion側の準備

Trayデータベースに以下のプロパティが存在することを確認してください。

| プロパティ名 | 型 | 内容 |
|---|---|---|
| `タスク` | Title | タスク本文 |
| `GTD種別` | Status | `Inbox` / `次に取る行動` / `プロジェクト` / `温めるアイデア` / `Today's 進行中` / `Today's 完了` / `アーカイブ` |

> `GTD種別` の各オプション名はNotion側の定義と完全一致させる必要があります（大文字小文字・スペース・アポストロフィなど）。

そしてNotion Integration（内部統合）を作成し、対象データベースの「接続」に追加しておきます。

## ローカル開発

```bash
npm install
cp .env.local.example .env.local   # 値を埋める
npm run dev
```

ブラウザで http://localhost:3000 を開く。

`.env.local` には以下を設定します。

```
NOTION_TOKEN=ntn_...
NOTION_DATABASE_ID=...
```

## 1. Vercelデプロイ手順

1. GitHubに `notion-quick-memo` リポジトリを作成し、このプロジェクトをpushする
2. [vercel.com](https://vercel.com) でリポジトリをインポート
3. **Environment Variables** に以下を登録する（Production / Preview / Development すべてにチェック）
   - `NOTION_TOKEN`
   - `NOTION_DATABASE_ID`
4. **Deploy** を実行する
5. 発行されたURL（例: `https://notion-quick-memo.vercel.app`）を控える

## 2. スマホのホーム画面に追加する手順

### iOSの場合
1. **Safari**（必須）でデプロイ済みのURLを開く
2. 画面下部の共有ボタンをタップ
3. メニューから「ホーム画面に追加」を選択
4. 名前を確認して「追加」をタップ

### Androidの場合
1. ChromeでURLを開く
2. 右上のメニュー（︙）をタップ
3. 「ホーム画面に追加」を選択

ホーム画面のアイコンから起動すると、アドレスバーのないスタンドアロン表示になり、開いた瞬間にキーボードが立ち上がります。

## 3. Notionトークンを再発行する方法

万が一トークンが漏洩した場合は、すぐに以下の手順で再発行します。

1. https://www.notion.so/profile/integrations にアクセス
2. 該当のインテグレーション（例: `Notion Quick Memo`）を選択
3. 「管理」→「シークレットを再生成」（または "Regenerate token"）を実行
4. 新しいトークンをコピー
5. Vercelダッシュボード → 該当プロジェクト → **Settings → Environment Variables** で `NOTION_TOKEN` を新しい値に更新
6. **Deployments** で最新デプロイの「Redeploy」を実行（環境変数を反映させるため）
7. ローカルの `.env.local` も更新

## Phase 0 のスコープ外（やらないこと）

- 認証
- 編集・削除機能
- 一覧表示
- オフライン送信キュー
- 複数データベース対応
