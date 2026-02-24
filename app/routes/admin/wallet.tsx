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
import { adminApi } from "~/lib/api";
import { queryKeys } from "~/lib/api/query-keys";
import type { WalletPack } from "~/lib/api/types";
import { toFieldErrors, walletPackSchema } from "~/lib/validation/admin";

export function meta() {
  return [{ title: "Wallet" }];
}

export default function WalletPage() {
  const queryClient = useQueryClient();

  const packsQuery = useQuery({
    queryKey: queryKeys.walletPacks,
    queryFn: () => adminApi.getWalletPacks(),
  });

  const transactionsQuery = useQuery({
    queryKey: queryKeys.walletTransactions(1, 50),
    queryFn: () => adminApi.getWalletTransactions({ page: 1, pageSize: 50 }),
  });

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingPack, setEditingPack] = React.useState<WalletPack | null>(null);
  const [pendingTogglePack, setPendingTogglePack] =
    React.useState<WalletPack | null>(null);

  const [name, setName] = React.useState("Custom Pack");
  const [credits, setCredits] = React.useState("150");
  const [priceCents, setPriceCents] = React.useState("1299");
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!editingPack) {
      return;
    }

    setName(editingPack.name);
    setCredits(String(editingPack.credits));
    setPriceCents(String(editingPack.priceCents));
    setFormErrors({});
    setFormError(null);
  }, [editingPack]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const parsed = walletPackSchema.safeParse({ name, credits, priceCents });
      if (!parsed.success) {
        setFormErrors(toFieldErrors(parsed.error));
        throw new Error("Please correct the highlighted fields");
      }

      setFormErrors({});
      setFormError(null);

      if (editingPack) {
        return adminApi.updateWalletPack(editingPack.id, {
          name: parsed.data.name,
          credits: parsed.data.credits,
          priceCents: parsed.data.priceCents,
        });
      }

      return adminApi.createWalletPack({
        name: parsed.data.name,
        credits: parsed.data.credits,
        priceCents: parsed.data.priceCents,
        currency: "EUR",
      });
    },
    onSuccess: () => {
      toast.success(
        editingPack ? "Wallet pack updated" : "Wallet pack created",
      );
      setIsDialogOpen(false);
      setEditingPack(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.walletPacks });
    },
    onError: (error) => {
      setFormError(
        error instanceof Error ? error.message : "Failed to save wallet pack",
      );
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ packId, active }: { packId: string; active: boolean }) =>
      adminApi.updateWalletPack(packId, { active }),
    onSuccess: () => {
      toast.success("Wallet pack status updated");
      setPendingTogglePack(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.walletPacks });
    },
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
            queryKey: queryKeys.walletPacks,
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.walletTransactions(1, 50),
          });
        }}
      />
    );
  }

  const isPending = createMutation.isPending || toggleMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wallet and Credits"
        description="Manage credit packs and inspect transaction flow for monetization operations."
        action={
          <Button
            onClick={() => {
              setEditingPack(null);
              setName("Custom Pack");
              setCredits("150");
              setPriceCents("1299");
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
          <EntityTable
            rows={packsQuery.data ?? []}
            getRowKey={(row) => row.id}
            columns={[
              { key: "name", label: "Name", render: (row) => row.name },
              {
                key: "credits",
                label: "Credits",
                render: (row) => row.credits,
              },
              {
                key: "price",
                label: "Price",
                render: (row) =>
                  `${(row.priceCents / 100).toFixed(2)} ${row.currency}`,
              },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <StatusChip status={row.active ? "active" : "inactive"} />
                ),
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
                          setEditingPack(row);
                          setIsDialogOpen(true);
                        }}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setPendingTogglePack(row)}
                      >
                        {row.active ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <EntityTable
            rows={transactionsQuery.data?.items ?? []}
            getRowKey={(row) => row.id}
            columns={[
              { key: "id", label: "ID", render: (row) => row.id },
              { key: "user", label: "User", render: (row) => row.userId },
              {
                key: "amount",
                label: "Amount",
                render: (row) =>
                  `${row.direction === "credit" ? "+" : "-"}${row.amountCredits}`,
              },
              { key: "reason", label: "Reason", render: (row) => row.reason },
              {
                key: "created",
                label: "Created",
                render: (row) => new Date(row.createdAt).toLocaleString(),
              },
            ]}
          />
        </CardContent>
      </Card>
      {(packsQuery.data ?? []).length === 0 ? (
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
              createMutation.mutate();
            }}
          >
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Pack name"
              disabled={createMutation.isPending}
            />
            {formErrors.name ? (
              <p className="text-destructive text-xs">{formErrors.name}</p>
            ) : null}

            <Input
              value={credits}
              onChange={(event) => setCredits(event.target.value)}
              placeholder="Credits"
              disabled={createMutation.isPending}
            />
            {formErrors.credits ? (
              <p className="text-destructive text-xs">{formErrors.credits}</p>
            ) : null}

            <Input
              value={priceCents}
              onChange={(event) => setPriceCents(event.target.value)}
              placeholder="Price cents"
              disabled={createMutation.isPending}
            />
            {formErrors.priceCents ? (
              <p className="text-destructive text-xs">
                {formErrors.priceCents}
              </p>
            ) : null}

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
