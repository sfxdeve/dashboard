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
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
import type { WalletPack, WalletTransaction } from "~/lib/api/types";
import { toFieldErrors, walletPackSchema } from "~/lib/validation/admin";

export function meta() {
  return [{ title: "Wallet" }];
}

export default function WalletPage() {
  const queryClient = useQueryClient();
  const [packPage, setPackPage] = React.useState(1);
  const pageSize = 20;

  const packsQuery = useQuery({
    queryKey: queryKeys.walletPacks(packPage, pageSize),
    queryFn: () => adminApi.getWalletPacks({ page: packPage, pageSize }),
  });

  const transactionsQuery = useQuery({
    queryKey: queryKeys.walletTransactions(1, 50),
    queryFn: () => adminApi.getWalletTransactions({ page: 1, pageSize: 50 }),
  });

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingPack, setEditingPack] = React.useState<WalletPack | null>(null);
  const [pendingTogglePack, setPendingTogglePack] =
    React.useState<WalletPack | null>(null);
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [formError, setFormError] = React.useState<string | null>(null);

  const createForm = useForm({
    defaultValues: {
      name: "Custom Pack",
      credits: "150",
      priceCents: "1299",
    },
    onSubmit: async ({ value }) => {
      const parsed = walletPackSchema.safeParse(value);
      if (!parsed.success) {
        setFormErrors(toFieldErrors(parsed.error));
        setFormError("Please correct the highlighted fields");
        return;
      }

      setFormErrors({});
      setFormError(null);

      try {
        if (editingPack) {
          await createMutation.mutateAsync({
            mode: "update",
            packId: editingPack.id,
            payload: {
              name: parsed.data.name,
              credits: parsed.data.credits,
              priceCents: parsed.data.priceCents,
            },
          });
          toast.success("Wallet pack updated");
        } else {
          await createMutation.mutateAsync({
            mode: "create",
            payload: {
              name: parsed.data.name,
              credits: parsed.data.credits,
              priceCents: parsed.data.priceCents,
              currency: "EUR",
            },
          });
          toast.success("Wallet pack created");
        }

        setIsDialogOpen(false);
        setEditingPack(null);
        createForm.reset();
        void queryClient.invalidateQueries({
          queryKey: queryKeys.walletPacks(),
        });
      } catch (error) {
        setFormError(
          error instanceof Error ? error.message : "Failed to save wallet pack",
        );
      }
    },
  });

  React.useEffect(() => {
    if (editingPack) {
      createForm.setFieldValue("name", editingPack.name);
      createForm.setFieldValue("credits", String(editingPack.credits));
      createForm.setFieldValue("priceCents", String(editingPack.priceCents));
    } else {
      createForm.setFieldValue("name", "Custom Pack");
      createForm.setFieldValue("credits", "150");
      createForm.setFieldValue("priceCents", "1299");
    }
    setFormErrors({});
    setFormError(null);
  }, [editingPack]);

  const createMutation = useMutation({
    mutationFn: async (input: {
      mode: "create" | "update";
      packId?: string;
      payload: {
        name: string;
        credits: number;
        priceCents: number;
        currency?: string;
      };
    }) => {
      if (input.mode === "update" && input.packId) {
        return adminApi.updateWalletPack(input.packId, input.payload);
      }
      return adminApi.createWalletPack({
        name: input.payload.name,
        credits: input.payload.credits,
        priceCents: input.payload.priceCents,
        currency: input.payload.currency ?? "EUR",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ packId, active }: { packId: string; active: boolean }) =>
      adminApi.updateWalletPack(packId, { active }),
    onSuccess: () => {
      toast.success("Wallet pack status updated");
      setPendingTogglePack(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.walletPacks() });
    },
  });
  const isPending = createMutation.isPending || toggleMutation.isPending;

  const packColumns = React.useMemo<ColumnDef<WalletPack>[]>(
    () => [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "credits", header: "Credits" },
      {
        id: "price",
        header: "Price",
        cell: ({ row }) =>
          `${(row.original.priceCents / 100).toFixed(2)} ${row.original.currency}`,
      },
      {
        accessorKey: "active",
        header: "Status",
        cell: ({ row }) => (
          <StatusChip status={row.original.active ? "active" : "inactive"} />
        ),
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
                  disabled={isPending}
                  aria-label={`Open actions for ${row.original.name}`}
                >
                  <MoreHorizontalIcon />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setEditingPack(row.original);
                  setIsDialogOpen(true);
                }}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setPendingTogglePack(row.original)}
              >
                {row.original.active ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [isPending],
  );

  const transactionColumns = React.useMemo<ColumnDef<WalletTransaction>[]>(
    () => [
      { accessorKey: "id", header: "ID" },
      { accessorKey: "userId", header: "User" },
      {
        id: "amount",
        header: "Amount",
        cell: ({ row }) =>
          `${row.original.direction === "credit" ? "+" : "-"}${row.original.amountCredits}`,
      },
      { accessorKey: "reason", header: "Reason" },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
      },
    ],
    [],
  );

  const packTable = useReactTable({
    data: packsQuery.data?.items ?? [],
    columns: packColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  const transactionTable = useReactTable({
    data: transactionsQuery.data?.items ?? [],
    columns: transactionColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  if (packsQuery.isLoading || transactionsQuery.isLoading) {
    return (
      <QueryStateCard
        state="loading"
        title="Loading Wallet"
        description="Fetching wallet packs and transaction history."
      />
    );
  }

  if (packsQuery.isError || transactionsQuery.isError) {
    return (
      <QueryStateCard
        state="error"
        title="Wallet Unavailable"
        description="Wallet data failed to load."
        onRetry={() => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.walletPacks(),
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.walletTransactions(1, 50),
          });
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wallet and Credits"
        description="Manage credit packs and inspect transaction flow for monetization operations."
        action={
          <Button
            onClick={() => {
              setEditingPack(null);
              createForm.setFieldValue("name", "Custom Pack");
              createForm.setFieldValue("credits", "150");
              createForm.setFieldValue("priceCents", "1299");
              setFormErrors({});
              setFormError(null);
              setIsDialogOpen(true);
            }}
            disabled={isPending}
          >
            <PlusIcon />
            New Pack
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Packs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              {packTable.getHeaderGroups().map((headerGroup) => (
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
              {packTable.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="text-muted-foreground py-8 text-center"
                    colSpan={packColumns.length}
                  >
                    No records found.
                  </TableCell>
                </TableRow>
              ) : (
                packTable.getRowModel().rows.map((row) => (
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              {transactionTable.getHeaderGroups().map((headerGroup) => (
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
              {transactionTable.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="text-muted-foreground py-8 text-center"
                    colSpan={transactionColumns.length}
                  >
                    No records found.
                  </TableCell>
                </TableRow>
              ) : (
                transactionTable.getRowModel().rows.map((row) => (
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
        </CardContent>
      </Card>
      {(packsQuery.data?.items.length ?? 0) === 0 ? (
        <QueryStateCard
          state="empty"
          title="No Wallet Packs"
          description="Add a credit pack to enable monetization configuration."
        />
      ) : null}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!createMutation.isPending) {
            setIsDialogOpen(nextOpen);
            if (!nextOpen) {
              setEditingPack(null);
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPack ? "Edit Wallet Pack" : "Create Wallet Pack"}
            </DialogTitle>
            <DialogDescription>
              Define credits and pricing for storefront purchase packs.
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
                  <Label htmlFor="wallet-pack-name">Pack Name</Label>
                  <Input
                    id="wallet-pack-name"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Pack name"
                    disabled={createMutation.isPending}
                  />
                  {formErrors.name ? (
                    <p className="text-destructive text-xs">
                      {formErrors.name}
                    </p>
                  ) : null}
                </div>
              )}
            </createForm.Field>

            <createForm.Field name="credits">
              {(field) => (
                <div className="space-y-1">
                  <Label htmlFor="wallet-pack-credits">Credits</Label>
                  <Input
                    id="wallet-pack-credits"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Credits"
                    disabled={createMutation.isPending}
                  />
                  {formErrors.credits ? (
                    <p className="text-destructive text-xs">
                      {formErrors.credits}
                    </p>
                  ) : null}
                </div>
              )}
            </createForm.Field>

            <createForm.Field name="priceCents">
              {(field) => (
                <div className="space-y-1">
                  <Label htmlFor="wallet-pack-price-cents">Price Cents</Label>
                  <Input
                    id="wallet-pack-price-cents"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Price cents"
                    disabled={createMutation.isPending}
                  />
                  {formErrors.priceCents ? (
                    <p className="text-destructive text-xs">
                      {formErrors.priceCents}
                    </p>
                  ) : null}
                </div>
              )}
            </createForm.Field>

            {formError ? (
              <p className="text-destructive text-xs">{formError}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? "Saving..."
                  : editingPack
                    ? "Save"
                    : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingTogglePack)}
        onOpenChange={(open) => {
          if (!toggleMutation.isPending && !open) {
            setPendingTogglePack(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingTogglePack?.active ? "Deactivate pack" : "Activate pack"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingTogglePack
                ? `${pendingTogglePack.name} will be ${pendingTogglePack.active ? "disabled" : "enabled"} for sale.`
                : "Confirm this action."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggleMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={toggleMutation.isPending || !pendingTogglePack}
              onClick={() => {
                if (!pendingTogglePack) {
                  return;
                }
                toggleMutation.mutate({
                  packId: pendingTogglePack.id,
                  active: !pendingTogglePack.active,
                });
              }}
            >
              {toggleMutation.isPending ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
