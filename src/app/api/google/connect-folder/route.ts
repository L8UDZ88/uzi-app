import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { refreshAccessToken, ingestFolder, listFiles } from "@/lib/google";

const LIB_SLOTS = ["documents", "audio", "video"] as const;

// Pick a Drive folder for a campaign: read its text content and store it as grounding material.
// With a `slot` of documents|audio|video, connects a TYPED content library instead of the brain.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId, folderId, folderName, slot } = await req.json();
  if (!campaignId || !folderId) return NextResponse.json({ error: "Missing folder" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user?.googleRefreshToken) return NextResponse.json({ error: "Not connected" }, { status: 400 });
  const campaign = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = await refreshAccessToken(user.googleRefreshToken);
  if (!token) return NextResponse.json({ error: "Drive auth expired — reconnect." }, { status: 401 });

  // Typed content library — store under inputs.libraries[slot] without touching the brain folder.
  if (LIB_SLOTS.includes(slot)) {
    const files = await listFiles(token, folderId);
    const inputs = { ...((campaign.inputs as any) || {}) };
    inputs.libraries = { ...(inputs.libraries || {}), [slot]: { folderId, folderName: folderName || slot, fileCount: files.length } };
    await prisma.brand.update({ where: { id: campaignId }, data: { inputs } });
    return NextResponse.json({ ok: true, fileCount: files.length, slot });
  }

  const { sourceText, fileCount, textFiles } = await ingestFolder(token, folderId);

  const inputs = { ...((campaign.inputs as any) || {}) };
  inputs.drive = true;
  inputs.driveFolderId = folderId;
  inputs.driveFolderName = folderName || "Drive folder";
  inputs.driveFileCount = fileCount;
  inputs.driveTextFiles = textFiles;
  inputs.sourceText = sourceText;
  await prisma.brand.update({ where: { id: campaignId }, data: { inputs } });

  return NextResponse.json({ ok: true, fileCount, textFiles, grounded: sourceText.length > 0 });
}
