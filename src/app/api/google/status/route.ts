import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { googleConfigured } from "@/lib/google";

// Tells the wizard whether Drive is configured/connected and which folder a campaign uses.
export async function GET(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId") || "";
  const user = await prisma.user.findUnique({ where: { id: uid } });
  const campaign = campaignId ? await prisma.brand.findUnique({ where: { id: campaignId } }) : null;
  const inputs = (campaign?.inputs as any) || {};
  return NextResponse.json({
    configured: googleConfigured(),
    connected: !!user?.googleRefreshToken,
    email: user?.googleEmail || null,
    folderId: inputs.driveFolderId || null,
    folderName: inputs.driveFolderName || null,
    fileCount: inputs.driveFileCount || 0,
    textFiles: inputs.driveTextFiles || 0,
  });
}
