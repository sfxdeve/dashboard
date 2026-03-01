import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncer } from "@tanstack/react-pacer";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type PaginationState,
} from "@tanstack/react-table";
import { EyeIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { DatePickerField } from "~/components/ui/date-picker";
import { HttpAdminApi } from "~/lib/api/http-admin-api";
import type { AuditLog } from "~/lib/api/types";

const adminApi = new HttpAdminApi();

const columnHelper = createColumnHelper<AuditLog>();

function AuditDetailDialog({
  log,
  onClose,
}: {
  log: AuditLog;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {log.action} · {log.entity}
            {log.entityId && (
              <span className="ml-2 font-mono text-sm text-muted-foreground">
                {log.entityId}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Admin
              </p>
              <p className="font-mono">{log.adminId}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Time
              </p>
              <p>{new Date(log.createdAt).toLocaleString()}</p>
            </div>
          </div>

          {log.reason && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Reason
              </p>
              <p>{log.reason}</p>
            </div>
          )}

          {log.before && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Before
              </p>
              <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                {JSON.stringify(log.before, null, 2)}
              </pre>
            </div>
          )}

          {log.after && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                After
              </p>
              <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                {JSON.stringify(log.after, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function meta() {
  return [{ title: "Audit Logs — FantaBeach Admin" }];
}

export default function AuditLogsPage() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Filter state
  const [rawEntity, setRawEntity] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Debounced entity value fed into query
  const [entity, setEntity] = useState("");

  const entityDebouncer = useDebouncer(setEntity, { wait: 300 });

  const { data: logsData, isLoading } = useQuery({
    queryKey: [
      "auditLogs",
      {
        entity: entity || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
      },
    ],
    queryFn: () =>
      adminApi.getAuditLogs({
        entity: entity || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
      }),
  });

  const logs = logsData?.items ?? [];
  const totalPages = logsData?.meta.pages ?? 0;

  const columns = [
    columnHelper.accessor("createdAt", {
      header: "Time",
      cell: (info) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {new Date(info.getValue()).toLocaleString()}
        </span>
      ),
    }),
    columnHelper.accessor("adminId", {
      header: "Admin",
      cell: (info) => (
        <span className="font-mono text-xs">{info.getValue().slice(-8)}</span>
      ),
    }),
    columnHelper.accessor("action", {
      header: "Action",
      cell: (info) => (
        <span className="font-medium text-sm">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor("entity", {
      header: "Entity",
      cell: (info) => (
        <span className="text-sm text-muted-foreground">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor("entityId", {
      header: "Entity ID",
      cell: (info) => {
        const v = info.getValue();
        return v ? (
          <span className="font-mono text-xs text-muted-foreground">
            {v.slice(-8)}
          </span>
        ) : (
          "—"
        );
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedLog(row.original)}
        >
          <EyeIcon className="size-4" />
          Detail
        </Button>
      ),
    }),
  ];

  const table = useReactTable({
    data: logs,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    manualPagination: true,
    pageCount: totalPages,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Audit Logs</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          className="w-40"
          placeholder="Entity (e.g. Tournament)"
          value={rawEntity}
          onChange={(e) => {
            setRawEntity(e.target.value);
            entityDebouncer.maybeExecute(e.target.value);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">
            From
          </label>
          <div className="w-44">
            <DatePickerField
              value={fromDate}
              onChange={(v) => {
                setFromDate(v);
                setPagination((p) => ({ ...p, pageIndex: 0 }));
              }}
              placeholder="Start date"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">
            To
          </label>
          <div className="w-44">
            <DatePickerField
              value={toDate}
              onChange={(v) => {
                setToDate(v);
                setPagination((p) => ({ ...p, pageIndex: 0 }));
              }}
              placeholder="End date"
            />
          </div>
        </div>
        {(rawEntity || fromDate || toDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRawEntity("");
              setFromDate("");
              setToDate("");
              setEntity("");
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No audit logs found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {totalPages}
            {logsData && ` · ${logsData.meta.total} total`}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {selectedLog && (
        <AuditDetailDialog
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}
