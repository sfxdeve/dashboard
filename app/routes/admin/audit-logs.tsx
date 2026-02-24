import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AuditLogDiff } from "~/components/blocks/audit-log-diff";
import { DateTimePickerField } from "~/components/blocks/date-time-picker-field";
import { EntityTable } from "~/components/blocks/entity-table";
import { PageHeader } from "~/components/blocks/page-header";
import { QueryStateCard } from "~/components/blocks/query-state-card";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "~/components/ui/drawer";
import { Input } from "~/components/ui/input";
import { adminApi } from "~/lib/api";
import { queryKeys } from "~/lib/api/query-keys";

export function meta() {
  return [{ title: "Audit Logs" }];
}

export default function AuditLogsPage() {
  const queryClient = useQueryClient();
  const [selectedLogId, setSelectedLogId] = React.useState<string>("");
  const [actionFilter, setActionFilter] = React.useState("");
  const [entityFilter, setEntityFilter] = React.useState("");
  const [actorFilter, setActorFilter] = React.useState("");
  const [fromFilter, setFromFilter] = React.useState("");
  const [toFilter, setToFilter] = React.useState("");

  const logsQuery = useQuery({
    queryKey: queryKeys.auditLogs(1, 100),
    queryFn: () => adminApi.getAuditLogs({ page: 1, pageSize: 100 }),
  });

  const filteredLogs = React.useMemo(() => {
    const fromTs = fromFilter ? Date.parse(fromFilter) : undefined;
    const toTs = toFilter ? Date.parse(toFilter) : undefined;

    return (logsQuery.data?.items ?? []).filter((row) => {
      if (
        actionFilter &&
        !row.action.toLowerCase().includes(actionFilter.toLowerCase())
      ) {
        return false;
      }
      if (
        entityFilter &&
        !`${row.entityType}:${row.entityId}`
          .toLowerCase()
          .includes(entityFilter.toLowerCase())
      ) {
        return false;
      }
      if (
        actorFilter &&
        !row.actorUserId.toLowerCase().includes(actorFilter.toLowerCase())
      ) {
        return false;
      }

      const ts = Date.parse(row.timestamp);
      if (Number.isFinite(fromTs) && ts < (fromTs as number)) {
        return false;
      }
      if (Number.isFinite(toTs) && ts > (toTs as number)) {
        return false;
      }

      return true;
    });
  }, [
    actionFilter,
    actorFilter,
    entityFilter,
    fromFilter,
    logsQuery.data?.items,
    toFilter,
  ]);

  const logQuery = useQuery({
    queryKey: queryKeys.auditLog(selectedLogId),
    queryFn: () => adminApi.getAuditLog(selectedLogId),
    enabled: Boolean(selectedLogId),
  });

  if (logsQuery.isLoading) {
    return (
      <QueryStateCard
        state="loading"
        title="Loading Audit Logs"
        description="Fetching immutable admin event stream."
      />
    );
  }

  if (logsQuery.isError) {
    return (
      <QueryStateCard
        state="error"
        title="Audit Logs Unavailable"
        description="Audit trail data failed to load."
        onRetry={() => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.auditLogs(1, 100),
          });
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Immutable Audit Trail"
        description="Inspect admin mutations with before/after snapshots and filter by actor, action, entity, and time."
      />

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Input
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            placeholder="Action"
          />
          <Input
            value={entityFilter}
            onChange={(event) => setEntityFilter(event.target.value)}
            placeholder="Entity"
          />
          <Input
            value={actorFilter}
            onChange={(event) => setActorFilter(event.target.value)}
            placeholder="Actor"
          />
          <DateTimePickerField
            label="From"
            value={fromFilter}
            onChange={setFromFilter}
            timezone="UTC"
            allowClear
            minuteStep={5}
          />
          <DateTimePickerField
            label="To"
            value={toFilter}
            onChange={setToFilter}
            timezone="UTC"
            allowClear
            minuteStep={5}
          />
          <Input
            readOnly
            value={`${filteredLogs.length} / ${(logsQuery.data?.items ?? []).length}`}
            placeholder="Results"
          />
        </CardContent>
      </Card>

      <EntityTable
        rows={filteredLogs}
        getRowKey={(row) => row.id}
        columns={[
          {
            key: "action",
            label: "Action",
            render: (row) => (
              <button
                type="button"
                onClick={() => setSelectedLogId(row.id)}
                className="text-left underline-offset-2 hover:underline"
              >
                {row.action}
              </button>
            ),
          },
          {
            key: "entity",
            label: "Entity",
            render: (row) => `${row.entityType}:${row.entityId}`,
          },
          { key: "actor", label: "Actor", render: (row) => row.actorUserId },
          {
            key: "timestamp",
            label: "Timestamp",
            render: (row) => new Date(row.timestamp).toLocaleString(),
          },
        ]}
      />

      {filteredLogs.length === 0 ? (
        <QueryStateCard
          state="empty"
          title="No Matching Audit Entries"
          description="No audit records match the current filters."
        />
      ) : null}

      <Drawer
        open={Boolean(selectedLogId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLogId("");
          }
        }}
        direction="right"
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Audit Log Detail</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 overflow-auto p-4">
            {logQuery.isLoading ? (
              <QueryStateCard
                state="loading"
                title="Loading Detail"
                description="Fetching selected audit payload."
              />
            ) : logQuery.isError ? (
              <QueryStateCard
                state="error"
                title="Audit Diff Unavailable"
                description="Could not load the selected log payload."
                onRetry={() => {
                  if (selectedLogId) {
                    void queryClient.invalidateQueries({
                      queryKey: queryKeys.auditLog(selectedLogId),
                    });
                  }
                }}
              />
            ) : (
              <AuditLogDiff log={logQuery.data ?? null} />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
