import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
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
import type { League, LeagueType, RankingMode } from "~/lib/api/types";

const adminApi = new HttpAdminApi();

const TYPE_VARIANT: Record<LeagueType, "default" | "outline"> = {
  PUBLIC: "default",
  PRIVATE: "outline",
};

export function meta() {
  return [{ title: "Leagues — FantaBeach Admin" }];
}

export default function LeaguesPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<League | null>(null);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: championships = [] } = useQuery({
    queryKey: ["championships"],
    queryFn: () => adminApi.getChampionships(),
  });

  const { data: leaguesData, isLoading } = useQuery({
    queryKey: [
      "leagues",
      {
        type: typeFilter === "all" ? undefined : typeFilter,
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
      },
    ],
    queryFn: () =>
      adminApi.getLeagues({
        type: typeFilter === "all" ? undefined : (typeFilter as LeagueType),
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
      setCreateOpen(false);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Create failed"),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...input
    }: { id: string } & Parameters<typeof adminApi.updateLeague>[1]) =>
      adminApi.updateLeague(id, input),
    onSuccess: () => {
      toast.success("League updated");
      void queryClient.invalidateQueries({ queryKey: ["leagues"] });
      setEditing(null);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  // ── Create form ──────────────────────────────────────────────────────────

  const createForm = useForm({
    defaultValues: {
      name: "",
      type: "PUBLIC" as LeagueType,
      championshipId: "",
      rankingMode: "OVERALL" as RankingMode,
      rosterSize: "10",
      startersSize: "5",
      budgetPerTeam: "100",
      isMarketEnabled: "true",
      isOpen: "false",
      entryFeeCredits: "",
      maxMembers: "",
      prize1st: "",
      prize2nd: "",
      prize3rd: "",
    },
    onSubmit: async ({ value }) => {
      const base = {
        name: value.name,
        championshipId: value.championshipId,
        rosterSize: Number(value.rosterSize),
        startersSize: Number(value.startersSize),
        budgetPerTeam: Number(value.budgetPerTeam),
        isMarketEnabled: value.isMarketEnabled === "true",
        isOpen: value.isOpen === "true",
        entryFeeCredits: value.entryFeeCredits
          ? Number(value.entryFeeCredits)
          : undefined,
        maxMembers: value.maxMembers ? Number(value.maxMembers) : undefined,
        prize1st: value.prize1st || undefined,
        prize2nd: value.prize2nd || undefined,
        prize3rd: value.prize3rd || undefined,
      };
      if (value.type === "PUBLIC") {
        await createMutation.mutateAsync({ type: "PUBLIC", ...base });
      } else {
        await createMutation.mutateAsync({
          type: "PRIVATE",
          rankingMode: value.rankingMode,
          ...base,
        });
      }
    },
  });

  function openCreate() {
    createForm.reset({
      name: "",
      type: "PUBLIC",
      championshipId: championships[0]?.id ?? "",
      rankingMode: "OVERALL",
      rosterSize: "10",
      startersSize: "5",
      budgetPerTeam: "100",
      isMarketEnabled: "true",
      isOpen: "false",
      entryFeeCredits: "",
      maxMembers: "",
      prize1st: "",
      prize2nd: "",
      prize3rd: "",
    });
    setCreateOpen(true);
  }

  // ── Edit form ────────────────────────────────────────────────────────────

  const editForm = useForm({
    defaultValues: {
      name: "",
      isOpen: "true",
      maxMembers: "",
      prize1st: "",
      prize2nd: "",
      prize3rd: "",
    },
    onSubmit: async ({ value }) => {
      if (!editing) return;
      await updateMutation.mutateAsync({
        id: editing.id,
        name: value.name || undefined,
        isOpen: value.isOpen === "true",
        maxMembers: value.maxMembers ? Number(value.maxMembers) : null,
        prize1st: value.prize1st || null,
        prize2nd: value.prize2nd || null,
        prize3rd: value.prize3rd || null,
      });
    },
  });

  useEffect(() => {
    if (editing) {
      editForm.reset({
        name: editing.name,
        isOpen: editing.isOpen ? "true" : "false",
        maxMembers: editing.maxMembers ? String(editing.maxMembers) : "",
        prize1st: editing.prize1st ?? "",
        prize2nd: editing.prize2nd ?? "",
        prize3rd: editing.prize3rd ?? "",
      });
    }
  }, [editing]);

  function getChampionshipLabel(championshipId: string): string {
    const c = championships.find((ch) => ch.id === championshipId);
    return c ? `${c.name} (${c.seasonYear})` : championshipId.slice(-8);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Leagues</h1>

        <Dialog
          open={createOpen}
          onOpenChange={(o) => {
            setCreateOpen(o);
            if (!o) createForm.reset();
          }}
        >
          <Button onClick={openCreate}>
            <PlusIcon className="size-4" />
            New League
          </Button>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New League</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void createForm.handleSubmit();
              }}
              className="space-y-4"
            >
              <FieldGroup>
                <createForm.Field
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
                </createForm.Field>

                <div className="grid grid-cols-2 gap-3">
                  <createForm.Field name="type">
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
                  </createForm.Field>

                  <createForm.Subscribe selector={(s) => s.values.type}>
                    {(type) =>
                      type === "PRIVATE" ? (
                        <createForm.Field name="rankingMode">
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
                                  <SelectValue placeholder="Select mode">
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
                                  <SelectItem value="OVERALL">
                                    Overall
                                  </SelectItem>
                                  <SelectItem value="HEAD_TO_HEAD">
                                    Head to Head
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </Field>
                          )}
                        </createForm.Field>
                      ) : (
                        <Field>
                          <FieldLabel>Ranking Mode</FieldLabel>
                          <div className="flex h-9 items-center rounded-md border px-3 text-sm text-muted-foreground">
                            Overall (fixed for public)
                          </div>
                        </Field>
                      )
                    }
                  </createForm.Subscribe>
                </div>

                <createForm.Field
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
                              if (!value) return undefined;
                              const c = championships.find(
                                (ch) => ch.id === String(value),
                              );
                              return c
                                ? `${c.name} (${c.seasonYear})`
                                : "Select championship";
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {championships.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
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
                </createForm.Field>

                <div className="grid grid-cols-3 gap-3">
                  <createForm.Field
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
                  </createForm.Field>

                  <createForm.Field
                    name="startersSize"
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
                  </createForm.Field>

                  <createForm.Field
                    name="budgetPerTeam"
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
                        <FieldLabel htmlFor={field.name}>
                          Budget (FC)
                        </FieldLabel>
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
                  </createForm.Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <createForm.Field name="isMarketEnabled">
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
                  </createForm.Field>

                  <createForm.Field name="entryFeeCredits">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>
                          Entry Fee Credits (optional)
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
                  </createForm.Field>
                </div>

                <createForm.Field name="isOpen">
                  {(field) => (
                    <Field>
                      <FieldLabel>Open for Joining</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(v) => field.handleChange(v ?? "false")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status">
                            {(value) =>
                              value === "true"
                                ? "Open"
                                : value === "false"
                                  ? "Closed"
                                  : undefined
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="false">Closed</SelectItem>
                          <SelectItem value="true">Open</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                </createForm.Field>

                <createForm.Field name="maxMembers">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        Max Members (optional)
                      </FieldLabel>
                      <Input
                        id={field.name}
                        type="number"
                        min={2}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="unlimited"
                      />
                    </Field>
                  )}
                </createForm.Field>

                <div className="grid grid-cols-3 gap-3">
                  {(["prize1st", "prize2nd", "prize3rd"] as const).map(
                    (name, i) => (
                      <createForm.Field key={name} name={name}>
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
                      </createForm.Field>
                    ),
                  )}
                </div>
              </FieldGroup>

              <DialogFooter>
                <createForm.Subscribe
                  selector={(s) => [s.canSubmit, s.isSubmitting]}
                >
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
                </createForm.Subscribe>
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
              <TableHead>Budget</TableHead>
              <TableHead>Entry Fee</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : leagues.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No leagues found.
                </TableCell>
              </TableRow>
            ) : (
              leagues.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell>
                    <Badge variant={TYPE_VARIANT[l.type]}>
                      {l.type === "PUBLIC" ? "Public" : "Private"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {getChampionshipLabel(l.championshipId)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.rankingMode === "HEAD_TO_HEAD" ? "H2H" : "Overall"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={l.isOpen ? "secondary" : "outline"}>
                      {l.isOpen ? "Open" : "Closed"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.budgetPerTeam} FC
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {l.entryFeeCredits ? `${l.entryFeeCredits} cr` : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(l)}
                    >
                      <PencilIcon className="size-4" />
                    </Button>
                  </TableCell>
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

      {/* Edit Dialog */}
      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            editForm.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit League</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void editForm.handleSubmit();
            }}
            className="space-y-4"
          >
            <FieldGroup>
              <editForm.Field
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
                    />
                    <FieldError
                      errors={field.state.meta.errors.map((e) => ({
                        message: String(e),
                      }))}
                    />
                  </Field>
                )}
              </editForm.Field>

              <div className="grid grid-cols-2 gap-3">
                <editForm.Field name="isOpen">
                  {(field) => (
                    <Field>
                      <FieldLabel>Status</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(v) => field.handleChange(v ?? "true")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status">
                            {(value) =>
                              value === "true"
                                ? "Open"
                                : value === "false"
                                  ? "Closed"
                                  : undefined
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Open</SelectItem>
                          <SelectItem value="false">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                </editForm.Field>

                <editForm.Field name="maxMembers">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Max Members</FieldLabel>
                      <Input
                        id={field.name}
                        type="number"
                        min={2}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="unlimited"
                      />
                    </Field>
                  )}
                </editForm.Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {(["prize1st", "prize2nd", "prize3rd"] as const).map(
                  (name, i) => (
                    <editForm.Field key={name} name={name}>
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
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="optional"
                          />
                        </Field>
                      )}
                    </editForm.Field>
                  ),
                )}
              </div>
            </FieldGroup>

            <DialogFooter>
              <editForm.Subscribe
                selector={(s) => [s.canSubmit, s.isSubmitting]}
              >
                {([canSubmit, isSubmitting]) => (
                  <Button
                    type="submit"
                    disabled={
                      !canSubmit || isSubmitting || updateMutation.isPending
                    }
                  >
                    {isSubmitting || updateMutation.isPending
                      ? "Saving…"
                      : "Save changes"}
                  </Button>
                )}
              </editForm.Subscribe>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
