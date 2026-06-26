import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import CampaignList from "@/components/CampaignList";

export default async function DashboardPage() {
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const campaigns = await prisma.brand.findMany({
    where: { userId: uid },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { schedule: true } } },
  });
  const data = campaigns.map((c) => ({
    id: c.id, name: c.name, campaignType: c.campaignType, onboarded: c.onboarded, scheduled: c._count.schedule,
  }));
  return <CampaignList campaigns={data} />;
}
