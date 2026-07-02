import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { extractText } from "@/lib/extract";

export const maxDuration = 60;

// Drag & drop upload → extract text from docs and fold it into the brain, so uploaded files and the
// connected Drive folder are BOTH used together. Body: { campaignId, files: [{ name, mime, dataUrl }] }.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId, files } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inputs = (c.inputs as any) || {};
  const names: string[] = Array.isArray(inputs.uploads) ? [...inputs.uploads] : [];
  let added = "";
  let count = 0;
  for (const f of (Array.isArray(files) ? files : []).slice(0, 20)) {
    const dataUrl: string = String(f?.dataUrl || "");
    const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : "";
    if (!b64) continue;
    const bytes = Buffer.from(b64, "base64");
    const text = await extractText(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, String(f?.mime || ""), String(f?.name || ""));
    if (!names.includes(f?.name)) names.push(String(f?.name || "file"));
    if (text) { count++; added += `\n\n### ${f?.name}\n${text.slice(0, 4000)}`; }
  }

  inputs.uploads = names;
  inputs.uploadText = String(inputs.uploadText || "").concat(added).slice(0, 24000);
  // Fold uploaded text straight into the grounding brain so it's used immediately (alongside Drive).
  inputs.sourceText = String(inputs.sourceText || "").concat(added).slice(0, 40000);
  await prisma.brand.update({ where: { id: campaignId }, data: { inputs } });

  return NextResponse.json({ ok: true, ingested: count, files: names.length });
}
