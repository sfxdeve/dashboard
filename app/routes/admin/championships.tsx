import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { toast } from "sonner";
import { PlusIcon, PencilIcon } from "lucide-react";
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
import type { Championship, Gender } from "~/lib/api/types";

const adminApi = new HttpAdminApi();

const columnHelper = createColumnHelper<Championship>();

export function meta() {
  return [{ title: "Championships — FantaBeach Admin" }];
}

export default function ChampionshipsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Championship | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const { data: championships = [], isLoading } = useQuery({
    queryKey: ["championships"],
    queryFn: () => adminApi.getChampionships(),
  });

  const createMutation = useMutation({
    mutationFn: (input: { name: string; gender: Gender; seasonYear: number }) =>
      adminApi.createChampionship(input),
    onSuccess: () => {
      toast.success("Championship created");
      void queryClient.invalidateQueries({ queryKey: ["championships"] });
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
      name: string;
      gender: Gender;
      seasonYear: number;
    }) => adminApi.updateChampionship(id, input),
    onSuccess: () => {
      toast.success("Championship updated");
      void queryClient.invalidateQueries({ queryKey: ["championships"] });
      setOpen(false);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const form = useForm({
    defaultValues: {
      name: "",
      gender: "M" as Gender,
      seasonYear: new Date().getFullYear(),
    },
    onSubmit: async ({ value }) => {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing._id, ...value });
      } else {
        await createMutation.mutateAsync(value);
      }
    },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ name: "", gender: "M", seasonYear: new Date().getFullYear() });
    setOpen(true);
  }

  function openEdit(item: Championship) {
    setEditing(item);
    form.reset({
      name: item.name,
      gender: item.gender,
      seasonYear: item.seasonYear,
    });
    setOpen(true);
  }

  const columns = [
    columnHelper.accessor("name", {
      header: "Name",
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor("gender", {
      header: "Gender",
      cell: (info) => (
        <Badge variant="outline">
          {info.getValue() === "M" ? "Men" : "Women"}
        </Badge>
      ),
    }),
    columnHelper.accessor("seasonYear", {
      header: "Season Year",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("createdAt", {
      header: "Created",
      cell: (info) => new Date(info.getValue()).toLocaleDateString(),
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
    data: championships,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Championships</h1>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) form.reset();
          }}
        >
          <Button onClick={openCreate}>
            <PlusIcon className="size-4" />
            New Championship
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Championship" : "New Championship"}
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
                        placeholder="e.g. AVP 2025"
                      />
                      <FieldError
                        errors={field.state.meta.errors.map((e) => ({
                          message: String(e),
                        }))}
                      />
                    </Field>
                  )}
                </form.Field>

                <form.Field name="gender">
                  {(field) => (
                    <Field>
                      <FieldLabel>Gender</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(v) => field.handleChange(v as Gender)}
                      >
                        <SelectTrigger>
                          <SelectValue />
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
                  name="seasonYear"
                  validators={{
                    onChange: ({ value }) =>
                      value < 2020 || value > 2100
                        ? "Enter a valid year (2020-2100)"
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
                      <FieldLabel htmlFor={field.name}>Season Year</FieldLabel>
                      <Input
                        id={field.name}
                        type="number"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(Number(e.target.value))
                        }
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
              Array.from({ length: 4 }).map((_, i) => (
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
                  No championships yet. Create one to get started.
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
