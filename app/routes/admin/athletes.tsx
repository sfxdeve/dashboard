import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { useDebouncer } from "@tanstack/react-pacer";
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
import { PlusIcon, PencilIcon, SearchIcon } from "lucide-react";
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
import type { Athlete, Championship, Gender } from "~/lib/api/types";

const adminApi = new HttpAdminApi();

const columnHelper = createColumnHelper<Athlete>();

function getChampionshipName(
  champ: string | Championship | null | undefined,
): string {
  if (!champ) return "—";
  if (typeof champ === "object") return `${champ.name} (${champ.seasonYear})`;
  return champ;
}

export function meta() {
  return [{ title: "Athletes — FantaBeach Admin" }];
}

export default function AthletesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Athlete | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [championshipFilter, setChampionshipFilter] = useState<string>("all");
  const [rawSearch, setRawSearch] = useState("");
  const [search, setSearch] = useState("");
  const debouncer = useDebouncer(setSearch, { wait: 300 });

  const { data: championships = [] } = useQuery({
    queryKey: ["championships"],
    queryFn: () => adminApi.getChampionships(),
  });

  const { data: athletesData, isLoading } = useQuery({
    queryKey: [
      "athletes",
      {
        championshipId:
          championshipFilter === "all" ? undefined : championshipFilter,
        search: search || undefined,
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
      },
    ],
    queryFn: () =>
      adminApi.getAthletes({
        championshipId:
          championshipFilter === "all" ? undefined : championshipFilter,
        search: search || undefined,
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
      }),
  });

  const athletes = athletesData?.items ?? [];
  const totalPages = athletesData?.meta.pages ?? 0;

  const createMutation = useMutation({
    mutationFn: (input: {
      firstName: string;
      lastName: string;
      gender: Gender;
      championshipId: string;
      pictureUrl?: string;
      entryPoints: number;
      globalPoints: number;
      fantacoinCost: number;
    }) => adminApi.createAthlete(input),
    onSuccess: () => {
      toast.success("Athlete created");
      void queryClient.invalidateQueries({ queryKey: ["athletes"] });
      setOpen(false);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Create failed"),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      firstName: string;
      lastName: string;
      gender: Gender;
      championshipId: string;
      pictureUrl?: string;
      entryPoints: number;
      globalPoints: number;
      fantacoinCost: number;
    }) => adminApi.updateAthlete(id, input),
    onSuccess: () => {
      toast.success("Athlete updated");
      void queryClient.invalidateQueries({ queryKey: ["athletes"] });
      setOpen(false);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const form = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      gender: "M" as Gender,
      championshipId: "",
      pictureUrl: "",
      entryPoints: 0,
      globalPoints: 0,
      fantacoinCost: 0,
    },
    onSubmit: async ({ value }) => {
      const payload = {
        ...value,
        pictureUrl: value.pictureUrl || undefined,
      };
      if (editing) {
        await updateMutation.mutateAsync({ id: editing._id, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    },
  });

  function openCreate() {
    setEditing(null);
    form.reset({
      firstName: "",
      lastName: "",
      gender: "M",
      championshipId: championships[0]?._id ?? "",
      pictureUrl: "",
      entryPoints: 0,
      globalPoints: 0,
      fantacoinCost: 0,
    });
    setOpen(true);
  }

  function openEdit(item: Athlete) {
    setEditing(item);
    setOpen(true);
  }

  useEffect(() => {
    if (open && editing) {
      const champId =
        typeof editing.championshipId === "object"
          ? editing.championshipId._id
          : editing.championshipId;
      form.reset({
        firstName: editing.firstName,
        lastName: editing.lastName,
        gender: editing.gender,
        championshipId: champId,
        pictureUrl: editing.pictureUrl ?? "",
        entryPoints: editing.entryPoints,
        globalPoints: editing.globalPoints,
        fantacoinCost: editing.fantacoinCost,
      });
    }
  }, [open, editing]);

  const columns = [
    columnHelper.display({
      id: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.firstName} {row.original.lastName}
        </span>
      ),
    }),
    columnHelper.accessor("gender", {
      header: "Gender",
      cell: (info) => (
        <Badge variant="outline">
          {info.getValue() === "M" ? "Men" : "Women"}
        </Badge>
      ),
    }),
    columnHelper.accessor("championshipId", {
      header: "Championship",
      cell: (info) => (
        <span className="text-sm text-muted-foreground">
          {getChampionshipName(info.getValue() as string | Championship)}
        </span>
      ),
    }),
    columnHelper.accessor("fantacoinCost", {
      header: "Cost",
      cell: (info) => `${info.getValue()} FC`,
    }),
    columnHelper.accessor("averageFantasyScore", {
      header: "Avg Score",
      cell: (info) => info.getValue().toFixed(1),
    }),
    columnHelper.accessor("entryPoints", {
      header: "Entry Pts",
      cell: (info) => info.getValue(),
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openEdit(row.original)}
        >
          <PencilIcon className="size-4" />
        </Button>
      ),
    }),
  ];

  const table = useReactTable({
    data: athletes,
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

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Athletes</h1>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) {
              setEditing(null);
              form.reset();
            }
          }}
        >
          <Button onClick={openCreate}>
            <PlusIcon className="size-4" />
            New Athlete
          </Button>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Athlete" : "New Athlete"}
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit();
              }}
              className="space-y-4"
            >
              <FieldGroup>
                <div className="grid grid-cols-2 gap-3">
                  <form.Field
                    name="firstName"
                    validators={{
                      onChange: ({ value }) =>
                        !value.trim() ? "Required" : undefined,
                    }}
                  >
                    {(field) => (
                      <Field
                        data-invalid={
                          field.state.meta.isTouched &&
                          field.state.meta.errors.length > 0
                        }
                      >
                        <FieldLabel htmlFor={field.name}>First Name</FieldLabel>
                        <Input
                          id={field.name}
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
                    name="lastName"
                    validators={{
                      onChange: ({ value }) =>
                        !value.trim() ? "Required" : undefined,
                    }}
                  >
                    {(field) => (
                      <Field
                        data-invalid={
                          field.state.meta.isTouched &&
                          field.state.meta.errors.length > 0
                        }
                      >
                        <FieldLabel htmlFor={field.name}>Last Name</FieldLabel>
                        <Input
                          id={field.name}
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

                <form.Field name="gender">
                  {(field) => (
                    <Field>
                      <FieldLabel>Gender</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(v) => field.handleChange(v as Gender)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender">
                            {(value) =>
                              value === "M"
                                ? "Men"
                                : value === "F"
                                  ? "Women"
                                  : undefined
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Men</SelectItem>
                          <SelectItem value="F">Women</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                </form.Field>

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
                          <SelectValue placeholder="Select championship">
                            {(value) => {
                              if (value == null || value === "")
                                return undefined;
                              const c = championships.find(
                                (ch) => ch._id === String(value),
                              );
                              return c
                                ? `${c.name} (${c.seasonYear})`
                                : "Select championship";
                            }}
                          </SelectValue>
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

                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      { name: "fantacoinCost", label: "FC Cost" },
                      { name: "entryPoints", label: "Entry Pts" },
                      { name: "globalPoints", label: "Global Pts" },
                    ] as const
                  ).map(({ name, label }) => (
                    <form.Field key={name} name={name}>
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
                          <Input
                            id={field.name}
                            type="number"
                            min={0}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) =>
                              field.handleChange(Number(e.target.value))
                            }
                          />
                        </Field>
                      )}
                    </form.Field>
                  ))}
                </div>

                <form.Field name="pictureUrl">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        Picture URL (optional)
                      </FieldLabel>
                      <Input
                        id={field.name}
                        type="url"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="https://..."
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
                      disabled={!canSubmit || isSubmitting || isPending}
                    >
                      {isSubmitting || isPending
                        ? "Saving…"
                        : editing
                          ? "Save changes"
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
        <div className="relative flex-1 max-w-xs">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search athletes..."
            value={rawSearch}
            onChange={(e) => {
              setRawSearch(e.target.value);
              debouncer.maybeExecute(e.target.value);
            }}
          />
        </div>
        <Select
          value={championshipFilter}
          onValueChange={(v) => {
            setChampionshipFilter(v ?? "all");
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All championships">
              {(value) => {
                if (value == null || value === "all")
                  return "All Championships";
                const c = championships.find((ch) => ch._id === String(value));
                return c ? `${c.name} (${c.seasonYear})` : "All championships";
              }}
            </SelectValue>
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
                  <TableHead
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    className={
                      h.column.getCanSort() ? "cursor-pointer select-none" : ""
                    }
                  >
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
                  No athletes found.
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {totalPages}
            {athletesData && ` · ${athletesData.meta.total} total`}
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
