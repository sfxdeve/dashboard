import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontalIcon } from "lucide-react";
import { useParams } from "react-router";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import { adminApi } from "~/lib/api";
import { queryKeys } from "~/lib/api/query-keys";
import { formatDateTimeForButton } from "~/lib/datetime";
import type { EntryListItem, EntryStatus } from "~/lib/api/types";

type BulkAction = "normalize" | "promote";

function canFinalizeEntryList(lineupLockAt: string) {
  const lockTs = Date.parse(lineupLockAt);
  if (!Number.isFinite(lockTs)) {
    return false;
  }
  return Date.now() >= lockTs;
}

function normalizeReserveOrder(items: EntryListItem[]) {
  const next = items.map((item) => ({ ...item, pair: { ...item.pair } }));
  const reserves = next
    .filter((item) => item.entryStatus === "reserve")
    .sort((a, b) => {
      const aOrder = a.reserveOrder ?? Number.POSITIVE_INFINITY;
      const bOrder = b.reserveOrder ?? Number.POSITIVE_INFINITY;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return b.ranking - a.ranking;
    });

  reserves.forEach((item, index) => {
    item.reserveOrder = index + 1;
  });

  for (const item of next) {
    item.pair.status = item.entryStatus;
    if (item.entryStatus !== "reserve") {
      item.reserveOrder = undefined;
    }
  }

  return next;
}

export function meta() {
  return [{ title: "Entry List" }];
}

export default function EntryListPage() {
  const params = useParams();
  const tournamentId = params.tournamentId as string;
  const queryClient = useQueryClient();

  const entryListQuery = useQuery({
    queryKey: queryKeys.entryList(tournamentId),
    queryFn: () => adminApi.getEntryList(tournamentId),
  });
  const tournamentQuery = useQuery({
    queryKey: queryKeys.tournament(tournamentId),
    queryFn: () => adminApi.getTournament(tournamentId),
  });

  const [selectedItem, setSelectedItem] = React.useState<EntryListItem | null>(
    null,
  );
  const [entryStatus, setEntryStatus] =
    React.useState<EntryStatus>("qualification");
  const [reserveOrder, setReserveOrder] = React.useState("");
  const [editFormError, setEditFormError] = React.useState<string | null>(null);
  const [bulkAction, setBulkAction] = React.useState<BulkAction | null>(null);

  React.useEffect(() => {
    if (!selectedItem) {
      return;
    }
    setEntryStatus(selectedItem.entryStatus);
    setReserveOrder(
      selectedItem.reserveOrder ? String(selectedItem.reserveOrder) : "",
    );
    setEditFormError(null);
  }, [selectedItem]);

  const updateMutation = useMutation({
    mutationFn: ({
      itemId,
      nextStatus,
      nextReserveOrder,
    }: {
      itemId: string;
      nextStatus: EntryStatus;
      nextReserveOrder?: number;
    }) => {
      if (
        nextStatus === "reserve" &&
        (nextReserveOrder === undefined || Number.isNaN(nextReserveOrder))
      ) {
        throw new Error("Reserve order is required when status is reserve");
      }
      return adminApi.updateEntryListItem(tournamentId, itemId, {
        entryStatus: nextStatus,
        reserveOrder: nextStatus === "reserve" ? nextReserveOrder : undefined,
      });
    },
    onSuccess: () => {
      toast.success("Entry updated");
      setSelectedItem(null);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.entryList(tournamentId),
      });
    },
    onError: (error) => {
      setEditFormError(
        error instanceof Error ? error.message : "Failed to update entry",
      );
    },
  });

  const replaceMutation = useMutation({
    mutationFn: (items: EntryListItem[]) =>
      adminApi.replaceEntryList(tournamentId, items),
    onSuccess: () => {
      toast.success("Entry List updated");
      setBulkAction(null);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.entryList(tournamentId),
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update Entry List",
      );
    },
  });

  const list = entryListQuery.data ?? [];
  const tournament = tournamentQuery.data;
  const isEntryListLocked = Boolean(tournament?.entryListLocked);
  const lockWindowOpen = tournament
    ? canFinalizeEntryList(tournament.policy.lineupLockAt)
    : false;
  const isPending = updateMutation.isPending || replaceMutation.isPending;

  if (entryListQuery.isLoading || tournamentQuery.isLoading) {
    return (
      <QueryStateCard
        state="loading"
        title="Loading Entry List"
        description="Fetching tournament entry pairs, reserve ordering, and lock status."
      />
    );
  }

  if (entryListQuery.isError || tournamentQuery.isError) {
    return (
      <QueryStateCard
        state="error"
        title="Entry List Unavailable"
        description="Entry List data failed to load."
        onRetry={() => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.entryList(tournamentId),
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.tournament(tournamentId),
          });
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entry List"
        description="Manage qualification, pool, and reserve admission states."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkAction("normalize")}
              disabled={isPending || list.length === 0 || isEntryListLocked}
            >
              Normalize Reserve Order
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setBulkAction("promote")}
              disabled={isPending || list.length === 0 || isEntryListLocked}
            >
              Promote Reserves to Qualification
            </Button>
          </div>
        }
      />
      <div className="rounded-md border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={isEntryListLocked ? "locked" : "open"} />
          <p className="text-sm">
            Lock timestamp:{" "}
            {tournament
              ? formatDateTimeForButton(
                  tournament.policy.lineupLockAt,
                  tournament.policy.timezone,
                )
              : "N/A"}
          </p>
        </div>
        {!isEntryListLocked && !lockWindowOpen ? (
          <p className="text-muted-foreground mt-1 text-xs">
            Entry List finalization is available only at or after the configured
            lock time.
          </p>
        ) : null}
      </div>

      <EntityTable
        rows={list}
        getRowKey={(row) => row.id}
        columns={[
          {
            key: "pair",
            label: "Pair",
            render: (row) => (
              <div>
                <p className="font-medium">{row.pair.id}</p>
                <p className="text-muted-foreground text-xs">
                  {row.pair.playerIds.join(" + ")}
                </p>
              </div>
            ),
          },
          { key: "ranking", label: "Ranking", render: (row) => row.ranking },
          {
            key: "status",
            label: "Status",
            render: (row) => <StatusChip status={row.entryStatus} />,
          },
          {
            key: "reserve",
            label: "Reserve Order",
            render: (row) => row.reserveOrder ?? "-",
          },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={isPending || isEntryListLocked}
                      aria-label={`Open actions for ${row.pair.id}`}
                    >
                      <MoreHorizontalIcon />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSelectedItem(row)}>
                    Edit Entry
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]}
      />

      {list.length === 0 ? (
        <QueryStateCard
          state="empty"
          title="Entry List Empty"
          description="No pairs are currently registered for this tournament."
        />
      ) : null}

      <Dialog
        open={Boolean(selectedItem)}
        onOpenChange={(nextOpen) => {
          if (!updateMutation.isPending && !nextOpen) {
            setSelectedItem(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Entry</DialogTitle>
            <DialogDescription>
              Adjust entry status and reserve order for selected pair.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!selectedItem) {
                return;
              }
              setEditFormError(null);
              updateMutation.mutate({
                itemId: selectedItem.id,
                nextStatus: entryStatus,
                nextReserveOrder: reserveOrder
                  ? Number.parseInt(reserveOrder, 10)
                  : undefined,
              });
            }}
          >
            <NativeSelect
              value={entryStatus}
              onChange={(event) =>
                setEntryStatus(event.target.value as EntryStatus)
              }
              disabled={updateMutation.isPending || isEntryListLocked}
            >
              <NativeSelectOption value="pool">Pool</NativeSelectOption>
              <NativeSelectOption value="qualification">
                Qualification
              </NativeSelectOption>
              <NativeSelectOption value="reserve">Reserve</NativeSelectOption>
            </NativeSelect>

            <Input
              value={reserveOrder}
              onChange={(event) => setReserveOrder(event.target.value)}
              placeholder="Reserve order"
              disabled={
                updateMutation.isPending ||
                isEntryListLocked ||
                entryStatus !== "reserve"
              }
            />

            {editFormError ? (
              <p className="text-destructive text-xs">{editFormError}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedItem(null)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending || isEntryListLocked}
              >
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(bulkAction)}
        onOpenChange={(open) => {
          if (!replaceMutation.isPending && !open) {
            setBulkAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === "normalize"
                ? "Normalize reserve order"
                : "Promote reserves"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "normalize"
                ? "This will reorder reserve positions deterministically."
                : "This will move every reserve entry to qualification status."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={replaceMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={replaceMutation.isPending || !bulkAction}
              onClick={() => {
                if (!bulkAction) {
                  return;
                }

                if (bulkAction === "normalize") {
                  replaceMutation.mutate(normalizeReserveOrder(list));
                  return;
                }

                const promoted = list.map((item) => ({
                  ...item,
                  pair: { ...item.pair },
                  entryStatus:
                    item.entryStatus === "reserve"
                      ? "qualification"
                      : item.entryStatus,
                  reserveOrder:
                    item.entryStatus === "reserve"
                      ? undefined
                      : item.reserveOrder,
                }));
                replaceMutation.mutate(promoted);
              }}
            >
              {replaceMutation.isPending ? "Applying..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
