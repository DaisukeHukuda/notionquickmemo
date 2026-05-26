import { Client } from "@notionhq/client";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/databases";

export const runtime = "nodejs";

type MemoBody = {
  dbKey?: unknown;
  task?: unknown;
  classifier?: unknown;
};

export async function POST(request: Request) {
  let body: MemoBody;
  try {
    body = (await request.json()) as MemoBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const dbKey = typeof body.dbKey === "string" ? body.dbKey : "";
  const db = getDb(dbKey);
  if (!db) {
    return NextResponse.json({ error: "Unknown dbKey" }, { status: 400 });
  }

  const task = typeof body.task === "string" ? body.task.trim() : "";
  if (!task) {
    return NextResponse.json({ error: "task is required" }, { status: 400 });
  }

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Server is missing NOTION_TOKEN" },
      { status: 500 },
    );
  }

  // Build properties starting with the title field.
  const properties: Record<string, unknown> = {
    [db.titleProp]: {
      title: [{ text: { content: task } }],
    },
  };

  // Add classifier-specific property if the DB has one.
  if (db.classifier?.type === "status") {
    const value = typeof body.classifier === "string" ? body.classifier : "";
    if (!db.classifier.options.includes(value)) {
      return NextResponse.json(
        { error: `invalid classifier for ${db.key}` },
        { status: 400 },
      );
    }
    properties[db.classifier.propName] = { status: { name: value } };
  } else if (db.classifier?.type === "multi_select") {
    const value = Array.isArray(body.classifier) ? body.classifier : [];
    if (
      !value.every(
        (v): v is string =>
          typeof v === "string" &&
          db.classifier!.type === "multi_select" &&
          db.classifier!.options.includes(v),
      )
    ) {
      return NextResponse.json(
        { error: `invalid classifier for ${db.key}` },
        { status: 400 },
      );
    }
    properties[db.classifier.propName] = {
      multi_select: value.map((name: string) => ({ name })),
    };
  }

  const notion = new Client({ auth: token });

  try {
    await notion.pages.create({
      parent: { database_id: db.databaseId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: properties as any,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Notion APIへの送信に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
