import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
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
import type { Season, SeasonStatus } from "~/lib/api/types";
import { seasonSchema, toFieldErrors } from "~/lib/validation/admin";

const STATUS_ORDER: SeasonStatus[] = ["upcoming", "active", "closed"];

function formatStatusLabel(status: string) {
  return status
    .replaceAll("_", " ")
    .split(" ")
    .map((word) =>
      word.length > 0 ? `${word[0].toUpperCase()}${word.slice(1)}` : word,
    )
    .join(" ");
}

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
  const [page, setPage] = React.useState(1);
  const pageSize = 20;

  const seasonsQuery = useQuery({
    queryKey: queryKeys.seasons(page, pageSize),
    queryFn: () => adminApi.getSeasons({ page, pageSize }),
  });

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [createErrors, setCreateErrors] = React.useState<
    Record<string, string>
  >({});
  const [createFormError, setCreateFormError] = React.useState<string | null>(
    null,
  );
  const [pendingStatusUpdate, setPendingStatusUpdate] =
    React.useState<PendingStatusUpdate | null>(null);

  const createMutation = useMutation({
    mutationFn: adminApi.createSeason,
  });

  const createForm = useForm({
    defaultValues: {
      name: "Italian Absolute Championship 2027",
      year: "2027",
    },
    onSubmit: async ({ value }) => {
      const parsed = seasonSchema.safeParse(value);
      if (!parsed.success) {
        setCreateErrors(toFieldErrors(parsed.error));
        setCreateFormError("Please correct the highlighted fields");
        return;
      }

      setCreateErrors({});
      setCreateFormError(null);

      try {
        await createMutation.mutateAsync(parsed.data);
        toast.success("Season created");
        setIsCreateOpen(false);
        createForm.reset();
        void queryClient.invalidateQueries({ queryKey: queryKeys.seasons() });
      } catch (error) {
        setCreateFormError(
          error instanceof Error ? error.message : "Failed to create season",
        );
      }
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.seasons() });
    },
  });

  const seasonColumns = React.useMemo<ColumnDef<Season>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "year",
        header: "Year",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusChip status={row.original.status} />,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const currentIndex = STATUS_ORDER.indexOf(row.original.status);
          const nextStatus =
            STATUS_ORDER[(currentIndex + 1) % STATUS_ORDER.length];
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="outline"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                    aria-label={`Open actions for ${row.original.name}`}
                  >
                    <MoreHorizontalIcon />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setPendingStatusUpdate({
                      seasonId: row.original.id,
                      seasonName: row.original.name,
                      nextStatus,
                    });
                  }}
                >
                  Set status to {formatStatusLabel(nextStatus)}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [createMutation.isPending, updateMutation.isPending],
  );

  const seasonTable = useReactTable({
    data: seasonsQuery.data?.items ?? [],
    columns: seasonColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
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
          void queryClient.invalidateQueries({ queryKey: queryKeys.seasons() });
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

      <Table>
        <TableHeader>
          {seasonTable.getHeaderGroups().map((headerGroup) => (
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
          {seasonTable.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                className="text-muted-foreground py-8 text-center"
                colSpan={seasonColumns.length}
              >
                No records found.
              </TableCell>
            </TableRow>
          ) : (
            seasonTable.getRowModel().rows.map((row) => (
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

      {(seasonsQuery.data?.items.length ?? 0) === 0 ? (
        <QueryStateCard
          state="empty"
          title="No Seasons Yet"
          description="Create the first season to enable tournament and league setup."
        />
      ) : null}

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
            (seasonsQuery.data?.items.length ?? 0) < pageSize ||
            (seasonsQuery.data?.total ?? 0) <= page * pageSize
          }
          onClick={() => setPage((current) => current + 1)}
        >
          Next
        </Button>
      </div>

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
              void createForm.handleSubmit();
            }}
          >
            <createForm.Field name="name">
              {(field) => (
                <div className="space-y-1">
                  <Label htmlFor="season-name">Season Name</Label>
                  <Input
                    id="season-name"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Season name"
                    disabled={createMutation.isPending}
                  />
                  {createErrors.name ? (
                    <p className="text-destructive text-xs">
                      {createErrors.name}
                    </p>
                  ) : null}
                </div>
              )}
            </createForm.Field>

            <createForm.Field name="year">
              {(field) => (
                <div className="space-y-1">
                  <Label htmlFor="season-year">Year</Label>
                  <Input
                    id="season-year"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Year"
                    disabled={createMutation.isPending}
                  />
                  {createErrors.year ? (
                    <p className="text-destructive text-xs">
                      {createErrors.year}
                    </p>
                  ) : null}
                </div>
              )}
            </createForm.Field>

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
                ? `Set ${pendingStatusUpdate.seasonName} to ${formatStatusLabel(pendingStatusUpdate.nextStatus)}?`
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
