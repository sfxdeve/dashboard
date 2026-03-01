import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
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
  League,
  LeagueStatus,
  LeagueType,
  RankingMode,
} from "~/lib/api/types";

const adminApi = new HttpAdminApi();

const TYPE_VARIANT: Record<LeagueType, "default" | "outline"> = {
  PUBLIC: "default",
  PRIVATE: "outline",
};

const TYPE_LABEL: Record<LeagueType, string> = {
  PUBLIC: "Public",
  PRIVATE: "Private",
};

const STATUS_VARIANT: Record<
  LeagueStatus,
  "default" | "secondary" | "outline"
> = {
  OPEN: "secondary",
  ONGOING: "default",
  COMPLETED: "outline",
};

const STATUS_LABEL: Record<LeagueStatus, string> = {
  OPEN: "Open",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
};

function getChampionshipName(c: string | Championship): string {
  if (typeof c === "object") return `${c.name} (${c.seasonYear})`;
  return c;
}

export function meta() {
  return [{ title: "Leagues — FantaBeach Admin" }];
}

export default function LeaguesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [champFilter, setChampFilter] = useState<string>("all");

  const { data: championships = [] } = useQuery({
    queryKey: ["championships"],
    queryFn: () => adminApi.getChampionships(),
  });

  const { data: leaguesData, isLoading } = useQuery({
    queryKey: [
      "leagues",
      {
        type: typeFilter === "all" ? undefined : typeFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
        championshipId: champFilter === "all" ? undefined : champFilter,
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
      },
    ],
    queryFn: () =>
      adminApi.getLeagues({
        type: typeFilter === "all" ? undefined : (typeFilter as LeagueType),
        status:
          statusFilter === "all" ? undefined : (statusFilter as LeagueStatus),
        championshipId: champFilter === "all" ? undefined : champFilter,
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
      }),
  });

  const leagues = leaguesData?.items ?? [];
  const totalPages = leaguesData?.meta.pages ?? 0;

  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof adminApi.createLeague>[0]) =>
      adminApi.createLeague(input),
    onSuccess: () => {
      toast.success("League created");
      void queryClient.invalidateQueries({ queryKey: ["leagues"] });
      setOpen(false);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Create failed"),
  });

  const form = useForm({
    defaultValues: {
      name: "",
      type: "PUBLIC" as LeagueType,
      championshipId: "",
      rankingMode: "OVERALL" as RankingMode,
      rosterSize: "10",
      startersPerGameweek: "5",
      initialBudget: "100",
      marketEnabled: "true",
      entryFee: "",
      prize1st: "",
      prize2nd: "",
      prize3rd: "",
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync({
        name: value.name,
        type: value.type,
        championshipId: value.championshipId,
        rankingMode: value.rankingMode,
        rosterSize: Number(value.rosterSize),
        startersPerGameweek: Number(value.startersPerGameweek),
        initialBudget: Number(value.initialBudget),
        marketEnabled: value.marketEnabled === "true",
        entryFee: value.entryFee ? Number(value.entryFee) : undefined,
        prize1st: value.prize1st || undefined,
        prize2nd: value.prize2nd || undefined,
        prize3rd: value.prize3rd || undefined,
      });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Leagues</h1>
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
                name: "",
                type: "PUBLIC",
                championshipId: championships[0]?._id ?? "",
                rankingMode: "OVERALL",
                rosterSize: "10",
                startersPerGameweek: "5",
                initialBudget: "100",
                marketEnabled: "true",
                entryFee: "",
                prize1st: "",
                prize2nd: "",
                prize3rd: "",
              });
              setOpen(true);
            }}
          >
            <PlusIcon className="size-4" />
            New League
          </Button>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New League</DialogTitle>
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
                        placeholder="e.g. Pro League 2025"
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
                  <form.Field name="type">
                    {(field) => (
                      <Field>
                        <FieldLabel>Type</FieldLabel>
                        <Select
                          value={field.state.value}
                          onValueChange={(v) =>
                            field.handleChange(v as LeagueType)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type">
                              {(value) =>
                                value === "PUBLIC"
                                  ? "Public"
                                  : value === "PRIVATE"
                                    ? "Private"
                                    : undefined
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PUBLIC">Public</SelectItem>
                            <SelectItem value="PRIVATE">Private</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  </form.Field>

                  <form.Field name="rankingMode">
                    {(field) => (
                      <Field>
                        <FieldLabel>Ranking Mode</FieldLabel>
                        <Select
                          value={field.state.value}
                          onValueChange={(v) =>
                            field.handleChange(v as RankingMode)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select ranking mode">
                              {(value) =>
                                value === "OVERALL"
                                  ? "Overall"
                                  : value === "HEAD_TO_HEAD"
                                    ? "Head to Head"
                                    : undefined
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OVERALL">Overall</SelectItem>
                            <SelectItem value="HEAD_TO_HEAD">
                              Head to Head
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  </form.Field>
                </div>

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
                  <form.Field
                    name="rosterSize"
                    validators={{
                      onChange: ({ value }) =>
                        !value || Number(value) < 1 ? "Min 1" : undefined,
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
                          Roster Size
                        </FieldLabel>
                        <Input
                          id={field.name}
                          type="number"
                          min={1}
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
                    name="startersPerGameweek"
                    validators={{
                      onChange: ({ value }) =>
                        !value || Number(value) < 1 ? "Min 1" : undefined,
                    }}
                  >
                    {(field) => (
                      <Field
                        data-invalid={
                          field.state.meta.isTouched &&
                          field.state.meta.errors.length > 0
                        }
                      >
                        <FieldLabel htmlFor={field.name}>Starters</FieldLabel>
                        <Input
                          id={field.name}
                          type="number"
                          min={1}
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
                    name="initialBudget"
                    validators={{
                      onChange: ({ value }) =>
                        !value || Number(value) < 0 ? "Invalid" : undefined,
                    }}
                  >
                    {(field) => (
                      <Field
                        data-invalid={
                          field.state.meta.isTouched &&
                          field.state.meta.errors.length > 0
                        }
                      >
                        <FieldLabel htmlFor={field.name}>Budget</FieldLabel>
                        <Input
                          id={field.name}
                          type="number"
                          min={0}
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

                <div className="grid grid-cols-2 gap-3">
                  <form.Field name="marketEnabled">
                    {(field) => (
                      <Field>
                        <FieldLabel>Market</FieldLabel>
                        <Select
                          value={field.state.value}
                          onValueChange={(v) => field.handleChange(v ?? "")}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select market">
                              {(value) =>
                                value === "true"
                                  ? "Enabled"
                                  : value === "false"
                                    ? "Disabled"
                                    : undefined
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Enabled</SelectItem>
                            <SelectItem value="false">Disabled</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  </form.Field>

                  <form.Field name="entryFee">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>
                          Entry Fee (optional)
                        </FieldLabel>
                        <Input
                          id={field.name}
                          type="number"
                          min={0}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="0"
                        />
                      </Field>
                    )}
                  </form.Field>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {(["prize1st", "prize2nd", "prize3rd"] as const).map(
                    (name, i) => (
                      <form.Field key={name} name={name}>
                        {(field) => (
                          <Field>
                            <FieldLabel htmlFor={field.name}>
                              {i + 1}
                              {i === 0 ? "st" : i === 1 ? "nd" : "rd"} Prize
                            </FieldLabel>
                            <Input
                              id={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              placeholder="optional"
                            />
                          </Field>
                        )}
                      </form.Field>
                    ),
                  )}
                </div>
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
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v ?? "all");
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All types">
              {(value) =>
                value == null || value === "all"
                  ? "All Types"
                  : value === "PUBLIC"
                    ? "Public"
                    : value === "PRIVATE"
                      ? "Private"
                      : value
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="PUBLIC">Public</SelectItem>
            <SelectItem value="PRIVATE">Private</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v ?? "all");
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All statuses">
              {(value) =>
                value == null || value === "all"
                  ? "All Statuses"
                  : (STATUS_LABEL[value as LeagueStatus] ?? value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="ONGOING">Ongoing</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
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
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Championship</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Official</TableHead>
              <TableHead>Budget</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : leagues.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No leagues found.
                </TableCell>
              </TableRow>
            ) : (
              leagues.map((l) => (
                <TableRow key={l._id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell>
                    <Badge variant={TYPE_VARIANT[l.type]}>
                      {TYPE_LABEL[l.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {getChampionshipName(
                      l.championshipId as string | Championship,
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.rankingMode === "HEAD_TO_HEAD" ? "H2H" : "Overall"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[l.status]}>
                      {STATUS_LABEL[l.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {l.isOfficial ? (
                      <Badge variant="secondary">Official</Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>{l.initialBudget}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.pageIndex + 1} of {totalPages}
            {leaguesData && ` · ${leaguesData.meta.total} total`}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPagination((p) => ({ ...p, pageIndex: p.pageIndex - 1 }))
              }
              disabled={pagination.pageIndex === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPagination((p) => ({ ...p, pageIndex: p.pageIndex + 1 }))
              }
              disabled={pagination.pageIndex >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
