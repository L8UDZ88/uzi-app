import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { refreshAccessToken, listFiles, fetchDriveFile, readDriveFileText, ingestFolder } from "@/lib/google";
import { extractText } from "@/lib/extract";
import { synthesizeBrain } from "@/lib/synth";

export const maxDuration = 60;

// Sync the brand's libraries into ONE grounded "content brain": extract text from the Documents
// library (.docx/PDF/text), fold in any cached audio/video transcripts, then synthesize with Claude.
// The result is stored as inputs.sourceText so ALL generation is grounded in real material.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId, resync } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inputs = (c.inputs as any) || {};
  const user = await prisma.user.findUnique({ where: { id: uid } });
  const token = user?.googleRefreshToken ? await refreshAccessToken(user.googleRefreshToken) : null;

  // Re-read the connected Drive "master brain" folder fresh (so a re-sync truly re-pulls from source).
  let brainText = "";
  if (token && inputs.driveFolderId) {
    try { brainText = (await ingestFolder(token, inputs.driveFolderId)).sourceText || ""; } catch { /* ignore */ }
  }

  let docText = "";
  let docCount = 0;
  const docsFolder = inputs.libraries?.documents?.folderId;
  if (token && docsFolder) {
    const files = await listFiles(token, docsFolder);
    for (const f of files.slice(0, 25)) {
      if (docText.length > 24000) break;
      // Google Docs / text → export to text; .docx / PDF → download bytes and extract.
      let t = await readDriveFileText(token, f).catch(() => "");
      if (!t) {
        const resp = await fetchDriveFile(token, f.id).catch(() => null);
        if (resp && resp.ok) t = await extractText(await resp.arrayBuffer(), f.mimeType, f.name);
      }
      if (t && t.trim()) { docCount++; docText += `\n\n### ${f.name}\n${t.slice(0, 4000)}`; }
    }
  }

  // Fold in any already-transcribed audio/video assets.
  const transcripts = await prisma.transcript.findMany({ where: { brandId: c.id }, take: 30 });
  let transText = "";
  for (const t of transcripts) {
    if (transText.length > 12000) break;
    if (t.text) transText += `\n\n### transcript\n${t.text.slice(0, 2500)}`;
  }

  // On a full re-sync, rebuild ONLY from live connected sources (ignore stale cached text).
  const base = resync ? brainText : String(brainText || inputs.libraryRaw || inputs.sourceText || "");
  const uploads = String(inputs.uploadText || ""); // drag & drop docs — used alongside Drive
  const raw = [base, uploads, docText, transText].filter(Boolean).join("\n\n").slice(0, 40000);
  if (!raw.trim()) return NextResponse.json({ error: "Nothing to ingest yet — connect Google Drive, drop some docs, or connect a Documents/Audio/Video library first." }, { status: 400 });

  const synthesized = await synthesizeBrain(raw, c.name || "");

  inputs.libraryRaw = raw.slice(0, 24000);
  inputs.sourceText = synthesized;
  inputs.ingest = { docs: docCount, transcripts: transcripts.length, chars: synthesized.length, syncedAt: new Date().toISOString() };

  // Re-Sync = reset entered content to empty, then re-pull from the connected inputs.
  const data: any = { inputs };
  if (resync) {
    inputs.story = {}; // clear the Hero Frame
    inputs.brandKit = { language: (inputs.brandKit || {}).language || "en" }; // clear product/donts/phrases
    data.tagline = ""; data.region = ""; data.voice = ""; // clear profile fields
  }
  await prisma.brand.update({ where: { id: campaignId }, data });

  return NextResponse.json({ ok: true, resync: !!resync, docs: docCount, transcripts: transcripts.length, chars: synthesized.length });
}
