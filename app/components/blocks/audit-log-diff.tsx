import type { AuditLog } from "~/lib/api/types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

type DiffRow = {
  key: string;
  value: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toRows(value: unknown): DiffRow[] {
  if (isRecord(value)) {
    return Object.entries(value).map(([key, raw]) => ({
      key,
      value:
        isRecord(raw) || Array.isArray(raw)
          ? JSON.stringify(raw)
          : String(raw ?? "-"),
    }));
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => ({
      key: `[${index}]`,
      value:
        isRecord(item) || Array.isArray(item)
          ? JSON.stringify(item)
          : String(item ?? "-"),
    }));
  }

  return [{ key: "value", value: String(value ?? "-") }];
}

function pretty(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function StructuredPayload({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  const rows = toRows(value);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase">{title}</p>
      <div className="rounded-md border">
        {rows.map((row) => (
          <div
            key={`${title}-${row.key}`}
            className="grid grid-cols-2 gap-2 border-b px-3 py-2 text-xs last:border-b-0"
          >
            <p className="font-medium">{row.key}</p>
            <p className="text-muted-foreground break-all">{row.value}</p>
          </div>
        ))}
      </div>

      <Collapsible>
        <CollapsibleTrigger render={<Button variant="outline" size="sm" />}>
          Show Raw JSON
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="bg-muted mt-2 max-h-72 overflow-auto rounded-md p-3 text-xs">
            {pretty(value)}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function AuditLogDiff({ log }: { log: AuditLog | null }) {
  if (!log) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Audit Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Select a log entry to inspect before/after values.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Detail</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-xs">
          <p>
            <span className="font-medium">Action:</span> {log.action}
          </p>
          <p>
            <span className="font-medium">Actor:</span> {log.actorUserId}
          </p>
          <p>
            <span className="font-medium">Entity:</span> {log.entityType}:
            {log.entityId}
          </p>
          <p>
            <span className="font-medium">Timestamp:</span>{" "}
            {new Date(log.timestamp).toLocaleString()}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <StructuredPayload title="Before" value={log.before} />
          <StructuredPayload title="After" value={log.after} />
        </div>
      </CardContent>
    </Card>
  );
}
