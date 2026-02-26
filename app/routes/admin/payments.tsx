import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { MoreHorizontalIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "~/components/blocks/page-header";
import { QueryStateCard } from "~/components/blocks/query-state-card";
import { StatusChip } from "~/components/blocks/status-chip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
import type { PaymentEvent } from "~/lib/api/types";

const providerLabels: Record<PaymentEvent["provider"], string> = {
  stripe: "Stripe",
};

export function meta() {
  return [{ title: "Payments" }];
}

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [pendingEvent, setPendingEvent] = React.useState<PaymentEvent | null>(
    null,
  );

  const eventsQuery = useQuery({
    queryKey: queryKeys.paymentEvents(1, 100),
    queryFn: () => adminApi.getPaymentEvents({ page: 1, pageSize: 100 }),
  });

  const reverifyMutation = useMutation({
    mutationFn: (eventId: string) => adminApi.reverifyPaymentEvent(eventId),
    onSuccess: () => {
      toast.success("Event re-verified");
      setPendingEvent(null);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.paymentEvents(1, 100),
      });
    },
  });

  const eventColumns = React.useMemo<ColumnDef<PaymentEvent>[]>(
    () => [
      {
        accessorKey: "externalId",
        header: "Event",
      },
      {
        accessorKey: "provider",
        header: "Provider",
        cell: ({ row }) =>
          providerLabels[row.original.provider] ?? row.original.provider,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusChip status={row.original.status} />,
      },
      {
        accessorKey: "receivedAt",
        header: "Received",
        cell: ({ row }) => new Date(row.original.receivedAt).toLocaleString(),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="icon-sm"
                  variant="outline"
                  disabled={reverifyMutation.isPending}
                  aria-label={`Open actions for ${row.original.externalId}`}
                >
                  <MoreHorizontalIcon />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setPendingEvent(row.original)}>
                Re-verify
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [reverifyMutation.isPending],
  );

  const table = useReactTable({
    data: eventsQuery.data?.items ?? [],
    columns: eventColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  if (eventsQuery.isLoading) {
    return (
      <QueryStateCard
        state="loading"
        title="Loading Payment Events"
        description="Fetching Stripe verification events."
      />
    );
  }

  if (eventsQuery.isError) {
    return (
      <QueryStateCard
        state="error"
        title="Payments Unavailable"
        description="Payment event data failed to load."
        onRetry={() => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.paymentEvents(1, 100),
          });
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Verification"
        description="Monitor Stripe validation events and manually re-run verification."
      />

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
                colSpan={eventColumns.length}
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
      {(eventsQuery.data?.items ?? []).length === 0 ? (
        <QueryStateCard
          state="empty"
          title="No Payment Events"
          description="No provider events are available for this environment."
        />
      ) : null}

      <AlertDialog
        open={Boolean(pendingEvent)}
        onOpenChange={(open) => {
          if (!reverifyMutation.isPending && !open) {
            setPendingEvent(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-verify payment event</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingEvent
                ? `Run verification again for ${providerLabels[pendingEvent.provider] ?? pendingEvent.provider} event ${pendingEvent.externalId}.`
                : "Confirm this action."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reverifyMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={reverifyMutation.isPending || !pendingEvent}
              onClick={() => {
                if (!pendingEvent) {
                  return;
                }
                reverifyMutation.mutate(pendingEvent.id);
              }}
            >
              {reverifyMutation.isPending ? "Re-verifying..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
