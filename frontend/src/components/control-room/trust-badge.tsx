import { Braces, Hand, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";

const lanes = {
  exact: { label: "Exact", icon: Braces, variant: "exact" },
  gemini: { label: "Gemini · bounded", icon: Sparkles, variant: "gemini" },
  owner: { label: "Owner", icon: Hand, variant: "attention" },
} as const;

export function TrustBadge({ lane }: { lane: keyof typeof lanes }) {
  const { label, icon: Icon, variant } = lanes[lane];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </Badge>
  );
}
