import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type PaginationState,
} from "@tanstack/react-table";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { HttpAdminApi } from "~/lib/api/http-admin-api";
import type {
  CreditPack,
  CreditTransaction,
  CreditTransactionType,
} from "~/lib/api/types";

const adminApi = new HttpAdminApi();

const TX_TYPE_VARIANT: Record<
  CreditTransactionType,
  "default" | "secondary" | "destructive" | "outline"
> = {
  PURCHASE: "default",
  BONUS: "secondary",
  SPEND: "destructive",
  REFUND: "outline",
};

// ── Packs Tab ─────────────────────────────────────────────────────────────

const packColumnHelper = createColumnHelper<CreditPack>();

function PacksTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: packs = [], isLoading } = useQuery({
    queryKey: ["creditPacks"],
    queryFn: () => adminApi.getCreditPacks(),
  });

  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof adminApi.createCreditPack>[0]) =>
      adminApi.createCreditPack(input),
    onSuccess: () => {
      toast.success("Pack created");
      void queryClient.invalidateQueries({ queryKey: ["creditPacks"] });
      setOpen(false);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Create failed"),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => adminApi.toggleCreditPack(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["creditPacks"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Toggle failed"),
  });

  const form = useForm({
    defaultValues: {
      name: "",
      credits: "",
      stripePriceId: "",
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync({
        name: value.name,
        credits: Number(value.credits),
        stripePriceId: value.stripePriceId,
        active: true,
      });
    },
  });

  const columns = [
    packColumnHelper.accessor("name", {
      header: "Name",
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    packColumnHelper.accessor("credits", {
      header: "Credits",
      cell: (info) => info.getValue(),
    }),
    packColumnHelper.accessor("stripePriceId", {
      header: "Stripe Price ID",
      cell: (info) => (
        <span className="font-mono text-xs text-muted-foreground">
          {info.getValue()}
        </span>
      ),
    }),
    packColumnHelper.accessor("active", {
      header: "Status",
      cell: (info) => (
        <Badge variant={info.getValue() ? "default" : "outline"}>
          {info.getValue() ? "Active" : "Inactive"}
        </Badge>
      ),
    }),
    packColumnHelper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => toggleMutation.mutate(row.original._id)}
          disabled={toggleMutation.isPending}
        >
          {row.original.active ? "Deactivate" : "Activate"}
        </Button>
      ),
    }),
  ];

  const table = useReactTable({
    data: packs,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) form.reset();
          }}
        >
          <Button size="sm" onClick={() => setOpen(true)}>
            <PlusIcon className="size-4" />
            New Pack
          </Button>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Credit Pack</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit();
              }}
              className="space-y-4"
            >
              <FieldGroup>
                <form.Field
                  name="name"
                  validators={{
                    onChange: ({ value }) =>
                      !value.trim() ? "Name is required" : undefined,
                  }}
                >
                  {(field) => (
                    <Field
                      data-invalid={
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0
                      }
                    >
                      <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="e.g. Starter Pack"
                      />
                      <FieldError
                        errors={field.state.meta.errors.map((e) => ({
                          message: String(e),
                        }))}
                      />
                    </Field>
                  )}
                </form.Field>

                <form.Field
                  name="credits"
                  validators={{
                    onChange: ({ value }) =>
                      !value || Number(value) < 1
                        ? "Credits must be ≥ 1"
                        : undefined,
                  }}
                >
                  {(field) => (
                    <Field
                      data-invalid={
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0
                      }
                    >
                      <FieldLabel htmlFor={field.name}>Credits</FieldLabel>
                      <Input
                        id={field.name}
                        type="number"
                        min={1}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="100"
                      />
                      <FieldError
                        errors={field.state.meta.errors.map((e) => ({
                          message: String(e),
                        }))}
                      />
                    </Field>
                  )}
                </form.Field>

                <form.Field
                  name="stripePriceId"
                  validators={{
                    onChange: ({ value }) =>
                      !value.trim() ? "Stripe Price ID is required" : undefined,
                  }}
                >
                  {(field) => (
                    <Field
                      data-invalid={
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0
                      }
                    >
                      <FieldLabel htmlFor={field.name}>
                        Stripe Price ID
                      </FieldLabel>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="price_..."
                      />
                      <FieldError
                        errors={field.state.meta.errors.map((e) => ({
                          message: String(e),
                        }))}
                      />
                    </Field>
                  )}
                </form.Field>
              </FieldGroup>

              <DialogFooter>
                <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
                  {([canSubmit, isSubmitting]) => (
                    <Button
                      type="submit"
                      disabled={
                        !canSubmit || isSubmitting || createMutation.isPending
                      }
                    >
                      {isSubmitting || createMutation.isPending
                        ? "Creating…"
                        : "Create"}
                    </Button>
                  )}
                </form.Subscribe>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
              Array.from({ length: 3 }).map((_, i) => (
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
                  No credit packs yet.
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
    </div>
  );
}

// ── Transactions Tab ───────────────────────────────────────────────────────

const txColumnHelper = createColumnHelper<CreditTransaction>();

function TransactionsTab() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const { data: txData, isLoading } = useQuery({
    queryKey: [
      "transactions",
      { page: pagination.pageIndex + 1, limit: pagination.pageSize },
    ],
    queryFn: () =>
      adminApi.getWalletTransactions({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
      }),
  });

  const transactions = txData?.items ?? [];
  const totalPages = txData?.meta.pages ?? 0;

  const columns = [
    txColumnHelper.accessor("type", {
      header: "Type",
      cell: (info) => (
        <Badge variant={TX_TYPE_VARIANT[info.getValue()]}>
          {info.getValue()}
        </Badge>
      ),
    }),
    txColumnHelper.accessor("source", {
      header: "Source",
      cell: (info) => (
        <span className="text-sm text-muted-foreground">{info.getValue()}</span>
      ),
    }),
    txColumnHelper.accessor("amount", {
      header: "Amount",
      cell: (info) => {
        const v = info.getValue();
        return (
          <span
            className={
              v > 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"
            }
          >
            {v > 0 ? "+" : ""}
            {v}
          </span>
        );
      },
    }),
    txColumnHelper.accessor("balanceAfter", {
      header: "Balance After",
      cell: (info) => info.getValue(),
    }),
    txColumnHelper.accessor("walletId", {
      header: "Wallet",
      cell: (info) => (
        <span className="font-mono text-xs text-muted-foreground">
          {info.getValue().slice(-8)}
        </span>
      ),
    }),
    txColumnHelper.accessor("createdAt", {
      header: "Date",
      cell: (info) => new Date(info.getValue()).toLocaleString(),
    }),
  ];

  const table = useReactTable({
    data: transactions,
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
                  No transactions found.
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
            {txData && ` · ${txData.meta.total} total`}
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
    </div>
  );
}

// ── Grant Credits Tab ──────────────────────────────────────────────────────

function GrantCreditsTab() {
  const form = useForm({
    defaultValues: {
      userId: "",
      amount: "",
      reason: "",
    },
    onSubmit: async ({ value }) => {
      await adminApi.grantCredits({
        userId: value.userId,
        amount: Number(value.amount),
        reason: value.reason || undefined,
      });
      toast.success("Credits granted");
      form.reset();
    },
  });

  return (
    <div className="max-w-md space-y-4">
      <p className="text-sm text-muted-foreground">
        Manually grant credits to a user's wallet.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="space-y-4"
      >
        <FieldGroup>
          <form.Field
            name="userId"
            validators={{
              onChange: ({ value }) =>
                !value.trim() ? "User ID is required" : undefined,
            }}
          >
            {(field) => (
              <Field
                data-invalid={
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0
                }
              >
                <FieldLabel htmlFor={field.name}>User ID</FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="MongoDB ObjectId"
                />
                <FieldError
                  errors={field.state.meta.errors.map((e) => ({
                    message: String(e),
                  }))}
                />
              </Field>
            )}
          </form.Field>

          <form.Field
            name="amount"
            validators={{
              onChange: ({ value }) =>
                !value || Number(value) < 1 ? "Amount must be ≥ 1" : undefined,
            }}
          >
            {(field) => (
              <Field
                data-invalid={
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0
                }
              >
                <FieldLabel htmlFor={field.name}>Amount</FieldLabel>
                <Input
                  id={field.name}
                  type="number"
                  min={1}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="100"
                />
                <FieldError
                  errors={field.state.meta.errors.map((e) => ({
                    message: String(e),
                  }))}
                />
              </Field>
            )}
          </form.Field>

          <form.Field name="reason">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Reason (optional)</FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Compensation, bonus, etc."
                />
              </Field>
            )}
          </form.Field>
        </FieldGroup>

        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Granting…" : "Grant Credits"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function meta() {
  return [{ title: "Credits — FantaBeach Admin" }];
}

export default function CreditsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Credits</h1>

      <Tabs defaultValue="packs">
        <TabsList>
          <TabsTrigger value="packs">Packs</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="grant">Grant Credits</TabsTrigger>
        </TabsList>

        <TabsContent value="packs" className="mt-4">
          <PacksTab />
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <TransactionsTab />
        </TabsContent>

        <TabsContent value="grant" className="mt-4">
          <GrantCreditsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
