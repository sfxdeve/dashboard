import { Badge } from "~/components/ui/badge";

export function StatusChip({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
  if (
    ["active", "open", "completed", "verified", "sent", "live"].includes(
      normalized,
    )
  ) {
    variant = "default";
  } else if (
    ["draft", "scheduled", "received", "upcoming"].includes(normalized)
  ) {
    variant = "secondary";
  } else if (["failed", "rejected", "cancelled"].includes(normalized)) {
    variant = "destructive";
  }

  return (
    <Badge variant={variant} className="capitalize">
      {status.replaceAll("_", " ")}
    </Badge>
  );
}
