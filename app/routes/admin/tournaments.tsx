import { useState } from "react";
import { Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
  type SortingState,
  type PaginationState,
} from "@tanstack/react-table";
import { toast } from "sonner";
import { PlusIcon, EyeIcon } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { HttpAdminApi } from "~/lib/api/http-admin-api";
import type {
  Championship,
  Tournament,
  TournamentStatus,
} from "~/lib/api/types";

const adminApi = new HttpAdminApi();

const STATUS_VARIANT: Record<
  TournamentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  UPCOMING: "outline",
  REGISTRATION_OPEN: "secondary",
  LOCKED: "destructive",
  ONGOING: "default",
  COMPLETED: "outline",
};

const STATUS_LABEL: Record<TournamentStatus, string> = {
  UPCOMING: "Upcoming",
  REGISTRATION_OPEN: "Open",
  LOCKED: "Locked",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
};

const columnHelper = createColumnHelper<Tournament>();

function getChampionshipName(c: string | Championship): string {
  if (typeof c === "object") return `${c.name} (${c.seasonYear})`;
  return c;
}

export function meta() {
  return [{ title: "Tournaments — FantaBeach Admin" }];
}

export default function TournamentsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [champFilter, setChampFilter] = useState<string>("all");

  const { data: championships = [] } = useQuery({
    queryKey: ["championships"],
    queryFn: () => adminApi.getChampionships(),
  });

  const { data: tournamentsData, isLoading } = useQuery({
    queryKey: [
      "tournaments",
      {
        status: statusFilter === "all" ? undefined : statusFilter,
        championshipId: champFilter === "all" ? undefined : champFilter,
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
      },
    ],
    queryFn: () =>
      adminApi.getTournaments({
        status:
          statusFilter === "all"
            ? undefined
            : (statusFilter as TournamentStatus),
        championshipId: champFilter === "all" ? undefined : champFilter,
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
      }),
  });

  const tournaments = tournamentsData?.items ?? [];
  const totalPages = tournamentsData?.meta.pages ?? 0;

  const createMutation = useMutation({
    mutationFn: (input: {
      championshipId: string;
      location: string;
      startDate: string;
      endDate: string;
      lineupLockAt: string;
    }) => adminApi.createTournament(input),
    onSuccess: () => {
      toast.success("Tournament created");
      void queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      setOpen(false);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Create failed"),
  });

  const form = useForm({
    defaultValues: {
      championshipId: "",
      location: "",
      startDate: "",
      endDate: "",
      lineupLockAt: "",
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync({
        ...value,
        lineupLockAt: value.lineupLockAt || undefined,
      } as never);
    },
  });

  const columns = [
    columnHelper.accessor("location", {
      header: "Location",
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor("championshipId", {
      header: "Championship",
      cell: (info) => (
        <span className="text-sm text-muted-foreground">
          {getChampionshipName(info.getValue() as string | Championship)}
        </span>
      ),
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: (info) => (
        <Badge variant={STATUS_VARIANT[info.getValue()]}>
          {STATUS_LABEL[info.getValue()]}
        </Badge>
      ),
    }),
    columnHelper.accessor("startDate", {
      header: "Start",
      cell: (info) => new Date(info.getValue()).toLocaleDateString(),
    }),
    columnHelper.accessor("endDate", {
      header: "End",
      cell: (info) => new Date(info.getValue()).toLocaleDateString(),
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          render={<Link to={`/admin/tournaments/${row.original._id}`} />}
        >
          <EyeIcon className="size-4" />
          View
        </Button>
      ),
    }),
  ];

  const table = useReactTable({
    data: tournaments,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    manualPagination: true,
    pageCount: totalPages,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tournaments</h1>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) form.reset();
          }}
        >
          <Button
            onClick={() => {
              form.reset({
                championshipId: championships[0]?._id ?? "",
                location: "",
                startDate: "",
                endDate: "",
                lineupLockAt: "",
              });
              setOpen(true);
            }}
          >
            <PlusIcon className="size-4" />
            New Tournament
          </Button>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New Tournament</DialogTitle>
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
                  name="championshipId"
                  validators={{
                    onChange: ({ value }) =>
                      !value ? "Championship is required" : undefined,
                  }}
                >
                  {(field) => (
                    <Field
                      data-invalid={
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0
                      }
                    >
                      <FieldLabel>Championship</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(v) => field.handleChange(v ?? "")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select championship" />
                        </SelectTrigger>
                        <SelectContent>
                          {championships.map((c) => (
                            <SelectItem key={c._id} value={c._id}>
                              {c.name} ({c.seasonYear})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError
                        errors={field.state.meta.errors.map((e) => ({
                          message: String(e),
                        }))}
                      />
                    </Field>
                  )}
                </form.Field>

                <form.Field
                  name="location"
                  validators={{
                    onChange: ({ value }) =>
                      !value.trim() ? "Location is required" : undefined,
                  }}
                >
                  {(field) => (
                    <Field
                      data-invalid={
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0
                      }
                    >
                      <FieldLabel htmlFor={field.name}>Location</FieldLabel>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="e.g. Huntington Beach, CA"
                      />
                      <FieldError
                        errors={field.state.meta.errors.map((e) => ({
                          message: String(e),
                        }))}
                      />
                    </Field>
                  )}
                </form.Field>

                <div className="grid grid-cols-2 gap-3">
                  <form.Field
                    name="startDate"
                    validators={{
                      onChange: ({ value }) =>
                        !value ? "Required" : undefined,
                    }}
                  >
                    {(field) => (
                      <Field
                        data-invalid={
                          field.state.meta.isTouched &&
                          field.state.meta.errors.length > 0
                        }
                      >
                        <FieldLabel htmlFor={field.name}>Start Date</FieldLabel>
                        <Input
                          id={field.name}
                          type="date"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
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
                    name="endDate"
                    validators={{
                      onChange: ({ value }) =>
                        !value ? "Required" : undefined,
                    }}
                  >
                    {(field) => (
                      <Field
                        data-invalid={
                          field.state.meta.isTouched &&
                          field.state.meta.errors.length > 0
                        }
                      >
                        <FieldLabel htmlFor={field.name}>End Date</FieldLabel>
                        <Input
                          id={field.name}
                          type="date"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                        <FieldError
                          errors={field.state.meta.errors.map((e) => ({
                            message: String(e),
                          }))}
                        />
                      </Field>
                    )}
                  </form.Field>
                </div>

                <form.Field name="lineupLockAt">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        Lineup Lock Date (optional)
                      </FieldLabel>
                      <Input
                        id={field.name}
                        type="datetime-local"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
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

      {/* Filters */}
      <div className="flex gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v ?? "all");
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={champFilter}
          onValueChange={(v) => {
            setChampFilter(v ?? "all");
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All championships" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Championships</SelectItem>
            {championships.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {c.name} ({c.seasonYear})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                  No tournaments found.
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
            {tournamentsData && ` · ${tournamentsData.meta.total} total`}
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
