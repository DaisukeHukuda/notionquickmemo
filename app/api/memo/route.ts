import { Client } from "@notionhq/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type MemoBody = {
  task?: unknown;
  gtdType?: unknown;
};

const ALLOWED_GTD = new Set([
  "Inbox",
  "次に取る行動",
  "プロジェクト",
  "温めるアイデア",
  "Today's 進行中",
]);

export async function POST(request: Request) {
  let body: MemoBody;
  try {
    body = (await request.json()) as MemoBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const task = typeof body.task === "string" ? body.task.trim() : "";
  const gtdType = typeof body.gtdType === "string" ? body.gtdType : "";

  if (!task) {
    return NextResponse.json({ error: "task is required" }, { status: 400 });
  }
  if (!ALLOWED_GTD.has(gtdType)) {
    return NextResponse.json({ error: "invalid gtdType" }, { status: 400 });
  }

  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!token || !databaseId) {
    return NextResponse.json(
      { error: "Server is missing NOTION_TOKEN or NOTION_DATABASE_ID" },
      { status: 500 },
    );
  }

  const notion = new Client({ auth: token });

  try {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        タスク: {
          title: [{ text: { content: task } }],
        },
        GTD種別: {
          status: { name: gtdType },
        },
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Notion APIへの送信に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
