import { NextResponse } from "next/server";
// Deprecated — replaced by /api/campaigns and /api/campaigns/[id]. Kept as a stub.
export async function GET() { return NextResponse.json({ error: "Use /api/campaigns" }, { status: 410 }); }
