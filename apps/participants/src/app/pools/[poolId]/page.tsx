import { ParticipantsApp } from "../../page";

export default async function ParticipantPoolPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = await params;

  return <ParticipantsApp initialPoolID={poolId} mode="detail" />;
}
