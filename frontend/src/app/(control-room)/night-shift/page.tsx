import { redirect } from "next/navigation";

import { DisconnectedBrief } from "@/components/control-room/disconnected-brief";
import { NightShiftWorkspace } from "@/components/night-shift/night-shift-workspace";
import { getNightShiftData } from "@/lib/api/night-shift";
import { ApiError } from "@/lib/api/server-client";

export const dynamic = "force-dynamic";

export default async function NightShiftPage() {
  let data;
  let requestId: string | undefined;
  try {
    data = await getNightShiftData();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login?next=/night-shift");
    requestId = error instanceof ApiError ? error.requestId : undefined;
  }
  return data
    ? <NightShiftWorkspace data={data} />
    : <DisconnectedBrief requestId={requestId} />;
}
