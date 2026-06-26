import Wizard from "@/components/Wizard";
export default function SetupPage({ params }: { params: { id: string } }) {
  return <Wizard campaignId={params.id} />;
}
