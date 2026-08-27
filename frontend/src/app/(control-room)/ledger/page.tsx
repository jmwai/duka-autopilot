import { LedgerDesk } from "@/components/ledger/ledger-desk";
import { QueryProvider } from "@/components/query-provider";

export default function LedgerPage() {
  return <QueryProvider><LedgerDesk /></QueryProvider>;
}
