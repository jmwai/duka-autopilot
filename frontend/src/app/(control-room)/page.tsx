import { redirect } from "next/navigation";

import { DisconnectedBrief } from "@/components/control-room/disconnected-brief";
import { MorningBrief } from "@/components/control-room/morning-brief";
import { getMorningBrief } from "@/lib/api/morning-brief";
import { ApiError } from "@/lib/api/server-client";

export const dynamic = "force-dynamic";

export default async function MorningBriefPage() {
  let data;
  let requestId: string | undefined;
  try {
    data = await getMorningBrief();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login");
    requestId = error instanceof ApiError ? error.requestId : undefined;
  }
  return data ? <MorningBrief data={data} /> : <DisconnectedBrief requestId={requestId} />;
}
