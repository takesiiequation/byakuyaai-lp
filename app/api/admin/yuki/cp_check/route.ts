// 管理用: デスクユキ制御面の鍵(ECS_AWS_*)が S3 台帳/作業机と ECS に届くかの自己診断(値は返さない・エラー名だけ)
//   GET /api/admin/yuki/cp_check  (x-api-key: ADMIN_API_KEY)
import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { ECSClient, DescribeTaskDefinitionCommand } from "@aws-sdk/client-ecs";
import { requireAuth } from "@/app/_lib/auth";

export const maxDuration = 20;
const REGION = process.env.YUKI_AWS_REGION || "ap-northeast-1";  // AWS_REGION は Vercel 側で自動的に us-east-1 が入るので使わない

export async function GET(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const ak = process.env.ECS_AWS_ACCESS_KEY_ID || "", sk = process.env.ECS_AWS_SECRET_ACCESS_KEY || "";
  const out: Record<string, unknown> = { configured: !!(ak && sk), key_prefix: ak.slice(0, 4), key_len: ak.length, secret_len: sk.length, region: REGION };
  if (!ak || !sk) return NextResponse.json({ ok: false, ...out });
  const creds = { accessKeyId: ak, secretAccessKey: sk };
  const s3 = new S3Client({ region: REGION, credentials: creds });
  const ecs = new ECSClient({ region: REGION, credentials: creds });
  const probe = async (label: string, fn: () => Promise<unknown>) => {
    try { await fn(); out[label] = "ok"; }
    catch (e) { const err = e as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } }; out[label] = `${err.name || "Error"}${err.$metadata?.httpStatusCode ? " " + err.$metadata.httpStatusCode : ""}: ${String(err.message || "").slice(0, 120)}`; }
  };
  await probe("s3_get_credits", async () => { try { await s3.send(new GetObjectCommand({ Bucket: "byakuyaai-media", Key: "credits/byakuyaai_test/_probe.json" })); } catch (e) { if ((e as { name?: string }).name === "NoSuchKey") return; throw e; } });
  await probe("s3_list_workspace", () => s3.send(new ListObjectsV2Command({ Bucket: "byakuyaai-media", Prefix: "workspace/byakuyaai_test/", MaxKeys: 1 })));
  await probe("s3_get_build", () => s3.send(new GetObjectCommand({ Bucket: "byakuyaai-media", Key: "build/latest.json" })));
  await probe("ecs_describe_taskdef", () => ecs.send(new DescribeTaskDefinitionCommand({ taskDefinition: process.env.YUKI_TASK_FAMILY || "byakuyaai-yuki-runtime" })));
  return NextResponse.json({ ok: Object.values(out).every((v) => v !== undefined && !(typeof v === "string" && /Error|Denied|Invalid|Signature/i.test(v))), ...out });
}
