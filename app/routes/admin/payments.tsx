import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontalIcon } from "lucide-react";
import { toast } from "sonner";

import { EntityTable } from "~/components/blocks/entity-table";
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
import { adminApi } from "~/lib/api";
import { queryKeys } from "~/lib/api/query-keys";
import type { PaymentEvent } from "~/lib/api/types";

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

  if (eventsQuery.isLoading) {
    return (
      <QueryStateCard
        state="loading"
        title="Loading Payment Events"
        description="Fetching Apple/Google verification events."
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
        description="Monitor Apple/Google validation events and manually re-run verification."
      />

      <EntityTable
        rows={eventsQuery.data?.items ?? []}
        getRowKey={(row) => row.id}
        columns={[
          { key: "id", label: "Event", render: (row) => row.externalId },
          { key: "provider", label: "Provider", render: (row) => row.provider },
          {
            key: "status",
            label: "Status",
            render: (row) => <StatusChip status={row.status} />,
          },
          {
            key: "received",
            label: "Received",
            render: (row) => new Date(row.receivedAt).toLocaleString(),
          },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      size="icon-sm"
                      variant="outline"
                      disabled={reverifyMutation.isPending}
                      aria-label={`Open actions for ${row.externalId}`}
                    >
                      <MoreHorizontalIcon />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setPendingEvent(row)}>
                    Re-verify
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]}
      />
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
                ? `Run verification again for ${pendingEvent.provider} event ${pendingEvent.externalId}.`
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
