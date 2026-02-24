import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
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
import { adminApi } from "~/lib/api";
import { queryKeys } from "~/lib/api/query-keys";
import type { SeasonStatus } from "~/lib/api/types";
import { seasonSchema, toFieldErrors } from "~/lib/validation/admin";

const STATUS_ORDER: SeasonStatus[] = ["upcoming", "active", "closed"];

type PendingStatusUpdate = {
  seasonId: string;
  seasonName: string;
  nextStatus: SeasonStatus;
};

export function meta() {
  return [{ title: "Seasons" }];
}

export default function SeasonsPage() {
  const queryClient = useQueryClient();
  const seasonsQuery = useQuery({
    queryKey: queryKeys.seasons,
    queryFn: () => adminApi.getSeasons(),
  });

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [name, setName] = React.useState("Italian Absolute Championship 2027");
  const [year, setYear] = React.useState("2027");
  const [createErrors, setCreateErrors] = React.useState<
    Record<string, string>
  >({});
  const [createFormError, setCreateFormError] = React.useState<string | null>(
    null,
  );
  const [pendingStatusUpdate, setPendingStatusUpdate] =
    React.useState<PendingStatusUpdate | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const parsed = seasonSchema.safeParse({ name, year });
      if (!parsed.success) {
        setCreateErrors(toFieldErrors(parsed.error));
        throw new Error("Please correct the highlighted fields");
      }

      setCreateErrors({});
      setCreateFormError(null);
      return adminApi.createSeason(parsed.data);
    },
    onSuccess: () => {
      toast.success("Season created");
      setIsCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.seasons });
    },
    onError: (error) => {
      setCreateFormError(
        error instanceof Error ? error.message : "Failed to create season",
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      seasonId,
      status,
    }: {
      seasonId: string;
      status: SeasonStatus;
    }) => adminApi.updateSeason(seasonId, { status }),
    onSuccess: () => {
      toast.success("Season updated");
      setPendingStatusUpdate(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.seasons });
    },
  });

  if (seasonsQuery.isLoading) {
    return (
      <QueryStateCard
        state="loading"
        title="Loading Seasons"
        description="Fetching season definitions."
      />
    );
  }

  if (seasonsQuery.isError) {
    return (
      <QueryStateCard
        state="error"
        title="Seasons Unavailable"
        description="Season data failed to load."
        onRetry={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.seasons });
        }}
      />
    );
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Season Management"
        description="Configure yearly competition windows used by tournaments and leagues."
        action={
          <Button onClick={() => setIsCreateOpen(true)} disabled={isPending}>
            <PlusIcon />
            Add Season
          </Button>
        }
      />

      <EntityTable
        rows={seasonsQuery.data ?? []}
        getRowKey={(row) => row.id}
        columns={[
          { key: "name", label: "Name", render: (row) => row.name },
          { key: "year", label: "Year", render: (row) => row.year },
          {
            key: "status",
            label: "Status",
            render: (row) => <StatusChip status={row.status} />,
          },
          {
            key: "action",
            label: "Actions",
            render: (row) => {
              const currentIndex = STATUS_ORDER.indexOf(row.status);
              const nextStatus =
                STATUS_ORDER[(currentIndex + 1) % STATUS_ORDER.length];
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        size="icon-sm"
                        variant="outline"
                        disabled={isPending}
                        aria-label={`Open actions for ${row.name}`}
                      >
                        <MoreHorizontalIcon />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setPendingStatusUpdate({
                          seasonId: row.id,
                          seasonName: row.name,
                          nextStatus,
                        });
                      }}
                    >
                      Set status to {nextStatus}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            },
          },
        ]}
      />

      {(seasonsQuery.data ?? []).length === 0 ? (
        <QueryStateCard
          state="empty"
          title="No Seasons Yet"
          description="Create the first season to enable tournament and league setup."
        />
      ) : null}

      <Dialog
        open={isCreateOpen}
        onOpenChange={(nextOpen) => {
          if (!createMutation.isPending) {
            setIsCreateOpen(nextOpen);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Season</DialogTitle>
            <DialogDescription>
              Add a new season available for tournaments and leagues.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="space-y-1">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Season name"
                disabled={createMutation.isPending}
              />
              {createErrors.name ? (
                <p className="text-destructive text-xs">{createErrors.name}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <Input
                value={year}
                onChange={(event) => setYear(event.target.value)}
                placeholder="Year"
                disabled={createMutation.isPending}
              />
              {createErrors.year ? (
                <p className="text-destructive text-xs">{createErrors.year}</p>
              ) : null}
            </div>

            {createFormError ? (
              <p className="text-destructive text-xs">{createFormError}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Season"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingStatusUpdate)}
        onOpenChange={(open) => {
          if (!updateMutation.isPending && !open) {
            setPendingStatusUpdate(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm status change</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatusUpdate
                ? `Set ${pendingStatusUpdate.seasonName} to ${pendingStatusUpdate.nextStatus}?`
                : "Confirm this action."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={updateMutation.isPending || !pendingStatusUpdate}
              onClick={() => {
                if (!pendingStatusUpdate) {
                  return;
                }
                updateMutation.mutate({
                  seasonId: pendingStatusUpdate.seasonId,
                  status: pendingStatusUpdate.nextStatus,
                });
              }}
            >
              {updateMutation.isPending ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
