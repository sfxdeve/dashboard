import { AlertTriangleIcon, InboxIcon, LoaderCircleIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

type QueryState = "loading" | "error" | "empty";

type QueryStateCardProps = {
  state: QueryState;
  title: string;
  description: string;
  retryLabel?: string;
  onRetry?: () => void;
};

const STATE_ICON = {
  loading: LoaderCircleIcon,
  error: AlertTriangleIcon,
  empty: InboxIcon,
} as const;

export function QueryStateCard({
  state,
  title,
  description,
  retryLabel = "Retry",
  onRetry,
}: QueryStateCardProps) {
  const Icon = STATE_ICON[state];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon
            className={state === "loading" ? "size-4 animate-spin" : "size-4"}
          />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">{description}</p>
        {state === "error" && onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
