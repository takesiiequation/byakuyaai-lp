import { NextRequest } from "next/server";
import { requireAuth } from "@/app/_lib/auth";
import {
  ensureModelTabs,
  getAllModels,
  addModel,
  updateModel,
  deleteModel,
  getPlanAssignments,
  validateBodyTemplate,
  type ModelDef,
} from "@/app/_lib/models";

// Server-side allow-list: only these columns can ever be written by a PUT,
// regardless of what extra keys a request body contains.
const WRITABLE_FIELDS = [
  "label",
  "endpoint_url",
  "body_template",
  "duration",
  "resolution",
  "notes",
  "active",
] as const;

function pickWritable(body: Record<string, unknown>): Partial<ModelDef> {
  const out: Partial<ModelDef> = {};
  for (const key of WRITABLE_FIELDS) {
    if (key in body) {
      (out as Record<string, unknown>)[key] = body[key];
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  try {
    await ensureModelTabs();
    const models = await getAllModels();
    return Response.json({ ok: true, data: models });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  try {
    await ensureModelTabs();
    const body = (await req.json()) as Partial<ModelDef>;
    const modelId = (body.model_id ?? "").trim();
    const label = (body.label ?? "").trim();
    const endpointUrl = (body.endpoint_url ?? "").trim();

    if (!modelId || !label || !endpointUrl) {
      return Response.json(
        { ok: false, error: "model_id / label / endpoint_url は必須です" },
        { status: 400 }
      );
    }
    if (!/^https?:\/\//i.test(endpointUrl)) {
      return Response.json(
        { ok: false, error: "endpoint_urlはhttp(s)で始まるURLである必要があります" },
        { status: 400 }
      );
    }

    const bodyTemplate = body.body_template ?? "";
    const validation = validateBodyTemplate(bodyTemplate);
    if (!validation.ok) {
      return Response.json({ ok: false, error: validation.error }, { status: 400 });
    }

    const existing = await getAllModels();
    if (existing.some((m) => m.model_id === modelId)) {
      return Response.json(
        { ok: false, error: "このmodel_idは既に登録されています" },
        { status: 409 }
      );
    }

    const model: ModelDef = {
      model_id: modelId,
      label,
      endpoint_url: endpointUrl,
      body_template: bodyTemplate,
      duration: body.duration ?? "",
      resolution: body.resolution ?? "",
      notes: body.notes ?? "",
      active: body.active ?? true,
    };
    await addModel(model);
    return Response.json({ ok: true, data: { model_id: model.model_id } });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  try {
    await ensureModelTabs();
    const body = (await req.json()) as Record<string, unknown>;
    const modelId = body.model_id;
    if (!modelId || typeof modelId !== "string") {
      return Response.json(
        { ok: false, error: "model_id は必須です" },
        { status: 400 }
      );
    }

    const updates = pickWritable(body);

    if (updates.endpoint_url !== undefined) {
      const url = String(updates.endpoint_url).trim();
      if (!/^https?:\/\//i.test(url)) {
        return Response.json(
          { ok: false, error: "endpoint_urlはhttp(s)で始まるURLである必要があります" },
          { status: 400 }
        );
      }
      updates.endpoint_url = url;
    }

    if (updates.body_template !== undefined) {
      const validation = validateBodyTemplate(String(updates.body_template));
      if (!validation.ok) {
        return Response.json({ ok: false, error: validation.error }, { status: 400 });
      }
    }

    await updateModel(modelId, updates);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  try {
    await ensureModelTabs();
    const modelId = req.nextUrl.searchParams.get("model_id");
    if (!modelId) {
      return Response.json(
        { ok: false, error: "model_id は必須です" },
        { status: 400 }
      );
    }

    const plans = await getPlanAssignments();
    const usedBy = plans.filter((p) => p.model_id === modelId).map((p) => p.plan);
    if (usedBy.length > 0) {
      return Response.json(
        {
          ok: false,
          error: `プラン設定(${usedBy.join(", ")})で使用中のため削除できません`,
        },
        { status: 409 }
      );
    }

    await deleteModel(modelId);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
