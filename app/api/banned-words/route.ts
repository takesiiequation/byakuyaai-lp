import { NextRequest } from "next/server";
import { requireAuth } from "@/app/_lib/auth";
import {
  ensureBannedWordsTab,
  getAllBannedWords,
  addBannedWord,
  updateBannedWord,
  deleteBannedWord,
} from "@/app/_lib/bannedWords";
import { BANNED_WORD_TYPES, type BannedWord } from "@/app/_lib/types";

// Server-side allow-list: only these columns can ever be written by a PUT.
// `word` is the matching key (like model_id in /api/models) — it's set once
// on POST and immutable afterward; renaming means delete+recreate.
const WRITABLE_FIELDS = ["type", "enabled"] as const;

function pickWritable(body: Record<string, unknown>): Partial<BannedWord> {
  const out: Partial<BannedWord> = {};
  for (const key of WRITABLE_FIELDS) {
    if (key in body) {
      (out as Record<string, unknown>)[key] = body[key];
    }
  }
  return out;
}

function isValidType(t: unknown): t is BannedWord["type"] {
  return typeof t === "string" && (BANNED_WORD_TYPES as readonly string[]).includes(t);
}

export async function GET(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  try {
    await ensureBannedWordsTab();
    const words = await getAllBannedWords();
    return Response.json({ ok: true, data: words });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  try {
    await ensureBannedWordsTab();
    const body = (await req.json()) as Partial<BannedWord>;
    const word = (body.word ?? "").trim();
    const type = body.type;

    if (!word) {
      return Response.json({ ok: false, error: "wordは必須です" }, { status: 400 });
    }
    if (!isValidType(type)) {
      return Response.json(
        { ok: false, error: `typeは${BANNED_WORD_TYPES.join(" / ")}のいずれかである必要があります` },
        { status: 400 }
      );
    }

    const existing = await getAllBannedWords();
    if (existing.some((w) => w.word === word)) {
      return Response.json(
        { ok: false, error: "この単語は既に登録されています" },
        { status: 409 }
      );
    }

    const entry: BannedWord = {
      word,
      type,
      enabled: body.enabled ?? true,
    };
    await addBannedWord(entry);
    return Response.json({ ok: true, data: { word: entry.word } });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  try {
    await ensureBannedWordsTab();
    const body = (await req.json()) as Record<string, unknown>;
    const word = body.word;
    if (!word || typeof word !== "string") {
      return Response.json({ ok: false, error: "wordは必須です" }, { status: 400 });
    }

    const updates = pickWritable(body);
    if (updates.type !== undefined && !isValidType(updates.type)) {
      return Response.json(
        { ok: false, error: `typeは${BANNED_WORD_TYPES.join(" / ")}のいずれかである必要があります` },
        { status: 400 }
      );
    }

    await updateBannedWord(word, updates);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  try {
    await ensureBannedWordsTab();
    const word = req.nextUrl.searchParams.get("word");
    if (!word) {
      return Response.json({ ok: false, error: "wordは必須です" }, { status: 400 });
    }
    await deleteBannedWord(word);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
