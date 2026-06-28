import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { refreshAccessToken, ingestFolder } from "@/lib/google";

// Pick a Drive folder for a campaign: read its text content and store it as grounding material.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId, folderId, folderName } = await req.json();
  if (!campaignId || !folderId) return NextResponse.json({ error: "Missing folder" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user?.googleRefreshToken) return NextResponse.json({ error: "Not connected" }, { status: 400 });
  const campaign = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = await refreshAccessToken(user.googleRefreshToken);
  if (!token) return NextResponse.json({ error: "Drive auth expired — reconnect." }, { status: 401 });

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
