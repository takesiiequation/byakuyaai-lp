import { NextRequest } from "next/server";
import { requireAuth } from "@/app/_lib/auth";
import {
  ensureModelTabs,
  getAllModels,
  getPlanAssignments,
  updatePlanAssignments,
  PLAN_KEYS,
} from "@/app/_lib/models";

export async function GET(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  try {
    await ensureModelTabs();
    const assignments = await getPlanAssignments();
    const map: Record<string, string> = {};
    for (const a of assignments) map[a.plan] = a.model_id;
    return Response.json({ ok: true, data: map });
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
    const models = await getAllModels();
    const modelById = new Map(models.map((m) => [m.model_id, m]));

    // Allow-list: only the 3 known plan slots are ever written, and only with
    // a model_id that actually exists in the モデル登録 tab AND is currently
    // active — assigning an inactive model would silently fail-open at
    // generation time, so reject it here instead.
    const next: Record<string, string> = {};
    for (const plan of PLAN_KEYS) {
      const raw = body[plan];
      if (raw === undefined || raw === null || raw === "") continue;
      if (typeof raw !== "string" || !modelById.has(raw)) {
        return Response.json(
          { ok: false, error: `${plan}: 未登録のmodel_idです (${String(raw)})` },
          { status: 400 }
        );
      }
      if (modelById.get(raw)?.active !== true) {
        return Response.json(
          { ok: false, error: `${plan}: 無効化されているモデルは割当できません (${raw})` },
          { status: 400 }
        );
      }
      next[plan] = raw;
    }

    await updatePlanAssignments(next);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
