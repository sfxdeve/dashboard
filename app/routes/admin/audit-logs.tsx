import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@tanstack/react-pacer";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

import { AuditLogDiff } from "~/components/blocks/audit-log-diff";
import { DateTimePickerField } from "~/components/blocks/date-time-picker-field";
import { PageHeader } from "~/components/blocks/page-header";
import { QueryStateCard } from "~/components/blocks/query-state-card";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "~/components/ui/drawer";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { adminApi } from "~/lib/api";
import { queryKeys } from "~/lib/api/query-keys";
import type { AuditLog } from "~/lib/api/types";

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
  const [page, setPage] = React.useState(1);
  const pageSize = 100;

  const [debouncedActionFilter] = useDebouncedValue(actionFilter, {
    wait: 300,
  });
  const [debouncedEntityFilter] = useDebouncedValue(entityFilter, {
    wait: 300,
  });
  const [debouncedActorFilter] = useDebouncedValue(actorFilter, { wait: 300 });
  const [debouncedFromFilter] = useDebouncedValue(fromFilter, { wait: 300 });
  const [debouncedToFilter] = useDebouncedValue(toFilter, { wait: 300 });
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "timestamp", desc: true },
  ]);

  const filters = React.useMemo(() => {
    const [entityTypeRaw, entityIdRaw] = debouncedEntityFilter.split(":");
    const entityType = entityTypeRaw?.trim();
    const entityId = entityIdRaw?.trim();

    return {
      page,
      pageSize,
      action: debouncedActionFilter || undefined,
      entityType: entityType || undefined,
      entityId: entityId || undefined,
      actorUserId: debouncedActorFilter || undefined,
      from: debouncedFromFilter || undefined,
      to: debouncedToFilter || undefined,
    };
  }, [
    debouncedActionFilter,
    debouncedActorFilter,
    debouncedEntityFilter,
    debouncedFromFilter,
    debouncedToFilter,
    page,
  ]);

  const logsQuery = useQuery({
    queryKey: queryKeys.auditLogs(filters),
    queryFn: () => adminApi.getAuditLogs(filters),
  });

  const logQuery = useQuery({
    queryKey: queryKeys.auditLog(selectedLogId),
    queryFn: () => adminApi.getAuditLog(selectedLogId),
    enabled: Boolean(selectedLogId),
  });

  const auditColumns = React.useMemo<ColumnDef<AuditLog>[]>(
    () => [
      {
        accessorKey: "action",
        header: "Action",
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setSelectedLogId(row.original.id)}
            className="text-left underline-offset-2 hover:underline"
          >
            {row.original.action}
          </button>
        ),
      },
      {
        id: "entity",
        accessorFn: (row) => `${row.entityType}:${row.entityId}`,
        header: "Entity",
        cell: ({ row }) =>
          `${row.original.entityType}:${row.original.entityId}`,
      },
      {
        accessorKey: "actorUserId",
        header: "Actor",
      },
      {
        accessorKey: "timestamp",
        header: "Timestamp",
        cell: ({ row }) => new Date(row.original.timestamp).toLocaleString(),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: logsQuery.data?.items ?? [],
    columns: auditColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
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
            queryKey: queryKeys.auditLogs(filters),
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
          <div className="space-y-2">
            <Label htmlFor="audit-action-filter">Action</Label>
            <Input
              id="audit-action-filter"
              value={actionFilter}
              onChange={(event) => {
                setActionFilter(event.target.value);
                setPage(1);
              }}
              placeholder="Action"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-entity-filter">Entity</Label>
            <Input
              id="audit-entity-filter"
              value={entityFilter}
              onChange={(event) => {
                setEntityFilter(event.target.value);
                setPage(1);
              }}
              placeholder="Entity"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-actor-filter">Actor</Label>
            <Input
              id="audit-actor-filter"
              value={actorFilter}
              onChange={(event) => {
                setActorFilter(event.target.value);
                setPage(1);
              }}
              placeholder="Actor"
            />
          </div>
          <DateTimePickerField
            label="From"
            value={fromFilter}
            onChange={(next) => {
              setFromFilter(next);
              setPage(1);
            }}
            timezone="UTC"
            allowClear
            minuteStep={5}
          />
          <DateTimePickerField
            label="To"
            value={toFilter}
            onChange={(next) => {
              setToFilter(next);
              setPage(1);
            }}
            timezone="UTC"
            allowClear
            minuteStep={5}
          />
          <div className="space-y-2">
            <Label htmlFor="audit-results-count">Results</Label>
            <Input
              id="audit-results-count"
              readOnly
              value={`${logsQuery.data?.items.length ?? 0} / ${logsQuery.data?.total ?? 0}`}
              placeholder="Results"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          Previous
        </Button>
        <span className="text-muted-foreground text-sm">Page {page}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={
            (logsQuery.data?.items.length ?? 0) < pageSize ||
            (logsQuery.data?.total ?? 0) <= page * pageSize
          }
          onClick={() => setPage((current) => current + 1)}
        >
          Next
        </Button>
      </div>

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                className="text-muted-foreground py-8 text-center"
                colSpan={auditColumns.length}
              >
                No records found.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {(logsQuery.data?.items.length ?? 0) === 0 ? (
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
