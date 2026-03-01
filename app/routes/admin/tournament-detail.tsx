import { useState } from "react";
import { useParams, Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  PlusIcon,
  Trash2Icon,
  PencilIcon,
  LockIcon,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Checkbox } from "~/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { HttpAdminApi } from "~/lib/api/http-admin-api";
import type {
  Athlete,
  EntryStatus,
  Match,
  MatchRound,
  MatchStatus,
  Tournament,
  TournamentPair,
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

const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CORRECTED: "Corrected",
};

const MATCH_ROUND_LABEL: Record<MatchRound, string> = {
  QUALIFICATION_R1: "Qual R1",
  QUALIFICATION_R2: "Qual R2",
  POOL: "Pool",
  R12: "R12",
  QF: "QF",
  SF: "SF",
  FINAL: "Final",
  THIRD_PLACE: "3rd Place",
};

const ENTRY_STATUS_LABEL: Record<EntryStatus, string> = {
  DIRECT: "Direct",
  QUALIFICATION: "Qualification",
  RESERVE_1: "Reserve 1",
  RESERVE_2: "Reserve 2",
  RESERVE_3: "Reserve 3",
};

function athleteName(a: string | Athlete): string {
  if (typeof a === "object") return `${a.firstName} ${a.lastName}`;
  return a;
}

function pairLabel(pair: TournamentPair): string {
  return `${athleteName(pair.athleteAId)} / ${athleteName(pair.athleteBId)}`;
}

function getChampionshipId(t: Tournament): string {
  if (typeof t.championshipId === "object") return t.championshipId._id;
  return t.championshipId;
}

// ── Pairs Tab ─────────────────────────────────────────────────────────────

const pairColumnHelper = createColumnHelper<TournamentPair>();

function PairsTab({
  tournamentId,
  championshipId,
}: {
  tournamentId: string;
  championshipId: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: pairs = [], isLoading } = useQuery({
    queryKey: ["pairs", tournamentId],
    queryFn: () => adminApi.getTournamentPairs(tournamentId),
  });

  const { data: athletesData } = useQuery({
    queryKey: ["athletes", { championshipId, limit: 200 }],
    queryFn: () => adminApi.getAthletes({ championshipId, limit: 200 }),
    enabled: !!championshipId,
  });
  const athletes = athletesData?.items ?? [];

  const removeMutation = useMutation({
    mutationFn: (pairId: string) => adminApi.removePair(tournamentId, pairId),
    onSuccess: () => {
      toast.success("Pair removed");
      void queryClient.invalidateQueries({ queryKey: ["pairs", tournamentId] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Remove failed"),
  });

  const addMutation = useMutation({
    mutationFn: (input: {
      athleteAId: string;
      athleteBId: string;
      entryStatus: EntryStatus;
      seedRank?: number;
    }) => adminApi.addPair(tournamentId, input),
    onSuccess: () => {
      toast.success("Pair added");
      void queryClient.invalidateQueries({ queryKey: ["pairs", tournamentId] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Add failed"),
  });

  const form = useForm({
    defaultValues: {
      athleteAId: "",
      athleteBId: "",
      entryStatus: "DIRECT" as EntryStatus,
      seedRank: "",
    },
    onSubmit: async ({ value }) => {
      await addMutation.mutateAsync({
        athleteAId: value.athleteAId,
        athleteBId: value.athleteBId,
        entryStatus: value.entryStatus,
        seedRank: value.seedRank ? Number(value.seedRank) : undefined,
      });
    },
  });

  const columns = [
    pairColumnHelper.display({
      id: "athletes",
      header: "Pair",
      cell: ({ row }) => (
        <span className="font-medium">{pairLabel(row.original)}</span>
      ),
    }),
    pairColumnHelper.accessor("entryStatus", {
      header: "Entry",
      cell: (info) => (
        <Badge variant="outline">{ENTRY_STATUS_LABEL[info.getValue()]}</Badge>
      ),
    }),
    pairColumnHelper.accessor("seedRank", {
      header: "Seed",
      cell: (info) => info.getValue() ?? "—",
    }),
    pairColumnHelper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => removeMutation.mutate(row.original._id)}
          disabled={removeMutation.isPending}
        >
          <Trash2Icon className="size-4 text-destructive" />
        </Button>
      ),
    }),
  ];

  const table = useReactTable({
    data: pairs,
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
            Add Pair
          </Button>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Pair</DialogTitle>
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
                  name="athleteAId"
                  validators={{
                    onChange: ({ value }) => (!value ? "Required" : undefined),
                  }}
                >
                  {(field) => (
                    <Field
                      data-invalid={
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0
                      }
                    >
                      <FieldLabel>Athlete A</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(v) => field.handleChange(v ?? "")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select athlete" />
                        </SelectTrigger>
                        <SelectContent>
                          {athletes.map((a) => (
                            <SelectItem key={a._id} value={a._id}>
                              {a.firstName} {a.lastName}
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
                  name="athleteBId"
                  validators={{
                    onChange: ({ value }) => (!value ? "Required" : undefined),
                  }}
                >
                  {(field) => (
                    <Field
                      data-invalid={
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0
                      }
                    >
                      <FieldLabel>Athlete B</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(v) => field.handleChange(v ?? "")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select athlete" />
                        </SelectTrigger>
                        <SelectContent>
                          {athletes.map((a) => (
                            <SelectItem key={a._id} value={a._id}>
                              {a.firstName} {a.lastName}
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

                <form.Field name="entryStatus">
                  {(field) => (
                    <Field>
                      <FieldLabel>Entry Status</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(v) =>
                          field.handleChange(v as EntryStatus)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ENTRY_STATUS_LABEL).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                </form.Field>

                <form.Field name="seedRank">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        Seed Rank (optional)
                      </FieldLabel>
                      <Input
                        id={field.name}
                        type="number"
                        min={1}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="e.g. 1"
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
                        !canSubmit || isSubmitting || addMutation.isPending
                      }
                    >
                      {isSubmitting || addMutation.isPending
                        ? "Adding…"
                        : "Add Pair"}
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
                  No pairs yet.
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

// ── Match Edit Dialog ─────────────────────────────────────────────────────

function MatchEditDialog({
  match,
  pairs,
  onClose,
}: {
  match: Match;
  pairs: TournamentPair[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof adminApi.updateMatch>[1]) =>
      adminApi.updateMatch(match._id, input),
    onSuccess: () => {
      toast.success("Match updated");
      void queryClient.invalidateQueries({
        queryKey: ["matches", match.tournamentId],
      });
      onClose();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const pairAId =
    typeof match.pairAId === "object" ? match.pairAId._id : match.pairAId;
  const pairBId =
    typeof match.pairBId === "object" ? match.pairBId._id : match.pairBId;

  const form = useForm({
    defaultValues: {
      set1A: match.set1A != null ? String(match.set1A) : "",
      set1B: match.set1B != null ? String(match.set1B) : "",
      set2A: match.set2A != null ? String(match.set2A) : "",
      set2B: match.set2B != null ? String(match.set2B) : "",
      set3A: match.set3A != null ? String(match.set3A) : "",
      set3B: match.set3B != null ? String(match.set3B) : "",
      winnerPairId: match.winnerPairId ?? "",
      status: match.status,
      isRetirement: match.isRetirement,
    },
    onSubmit: async ({ value }) => {
      const toNum = (v: string) => (v.trim() !== "" ? Number(v) : undefined);
      await updateMutation.mutateAsync({
        set1A: toNum(value.set1A),
        set1B: toNum(value.set1B),
        set2A: toNum(value.set2A),
        set2B: toNum(value.set2B),
        set3A: toNum(value.set3A),
        set3B: toNum(value.set3B),
        winnerPairId: value.winnerPairId || undefined,
        status: value.status,
        isRetirement: value.isRetirement,
      });
    },
  });

  const pairAObj = pairs.find((p) => p._id === pairAId);
  const pairBObj = pairs.find((p) => p._id === pairBId);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="space-y-4"
    >
      <FieldGroup>
        {/* Scores */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Scores</p>
          <div className="grid grid-cols-3 gap-2">
            {(["1", "2", "3"] as const).map((set) => (
              <div key={set} className="space-y-1">
                <p className="text-xs text-muted-foreground text-center">
                  Set {set}
                </p>
                <div className="flex gap-1">
                  <form.Field
                    name={`set${set}A` as "set1A" | "set2A" | "set3A"}
                  >
                    {(field) => (
                      <Input
                        type="number"
                        min={0}
                        className="text-center"
                        placeholder="A"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    )}
                  </form.Field>
                  <Input disabled value=":" className="w-6 px-0 text-center" />
                  <form.Field
                    name={`set${set}B` as "set1B" | "set2B" | "set3B"}
                  >
                    {(field) => (
                      <Input
                        type="number"
                        min={0}
                        className="text-center"
                        placeholder="B"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    )}
                  </form.Field>
                </div>
              </div>
            ))}
          </div>
        </div>

        <form.Field name="winnerPairId">
          {(field) => (
            <Field>
              <FieldLabel>Winner</FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select winner" />
                </SelectTrigger>
                <SelectContent>
                  {pairAObj && (
                    <SelectItem value={pairAId}>
                      A: {pairLabel(pairAObj)}
                    </SelectItem>
                  )}
                  {pairBObj && (
                    <SelectItem value={pairBId}>
                      B: {pairLabel(pairBObj)}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>

        <form.Field name="status">
          {(field) => (
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(v) =>
                  field.handleChange((v ?? "SCHEDULED") as MatchStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MATCH_STATUS_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>

        <form.Field name="isRetirement">
          {(field) => (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={field.state.value}
                onCheckedChange={(checked) =>
                  field.handleChange(checked === true)
                }
                id="isRetirement"
              />
              <label
                htmlFor="isRetirement"
                className="text-sm font-medium cursor-pointer"
              >
                Retirement / walkover
              </label>
            </div>
          )}
        </form.Field>
      </FieldGroup>

      <DialogFooter>
        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting || updateMutation.isPending}
            >
              {isSubmitting || updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}

// ── Matches Tab ────────────────────────────────────────────────────────────

const matchColumnHelper = createColumnHelper<Match>();

function MatchesTab({
  tournamentId,
  pairs,
}: {
  tournamentId: string;
  pairs: TournamentPair[];
}) {
  const queryClient = useQueryClient();
  const [editMatch, setEditMatch] = useState<Match | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["matches", tournamentId],
    queryFn: () => adminApi.getMatches({ tournamentId }),
  });

  const createMutation = useMutation({
    mutationFn: (input: {
      round: MatchRound;
      pairAId: string;
      pairBId: string;
      scheduledAt?: string;
    }) =>
      adminApi.createMatch({
        tournamentId,
        ...input,
      }),
    onSuccess: () => {
      toast.success("Match created");
      void queryClient.invalidateQueries({
        queryKey: ["matches", tournamentId],
      });
      setCreateOpen(false);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Create failed"),
  });

  const createForm = useForm({
    defaultValues: {
      round: "POOL" as MatchRound,
      pairAId: pairs[0]?._id ?? "",
      pairBId: pairs[1]?._id ?? "",
      scheduledAt: "",
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync({
        round: value.round,
        pairAId: value.pairAId,
        pairBId: value.pairBId,
        scheduledAt: value.scheduledAt || undefined,
      });
    },
  });

  function formatScore(match: Match): string {
    const sets: string[] = [];
    if (match.set1A != null && match.set1B != null)
      sets.push(`${match.set1A}:${match.set1B}`);
    if (match.set2A != null && match.set2B != null)
      sets.push(`${match.set2A}:${match.set2B}`);
    if (match.set3A != null && match.set3B != null)
      sets.push(`${match.set3A}:${match.set3B}`);
    return sets.length > 0 ? sets.join(" ") : "—";
  }

  function matchPairName(id: string | TournamentPair): string {
    if (typeof id === "object") return pairLabel(id);
    const found = pairs.find((p) => p._id === id);
    return found ? pairLabel(found) : id;
  }

  const columns = [
    matchColumnHelper.accessor("round", {
      header: "Round",
      cell: (info) => MATCH_ROUND_LABEL[info.getValue()],
    }),
    matchColumnHelper.display({
      id: "pairA",
      header: "Pair A",
      cell: ({ row }) => (
        <span className="text-sm">{matchPairName(row.original.pairAId)}</span>
      ),
    }),
    matchColumnHelper.display({
      id: "pairB",
      header: "Pair B",
      cell: ({ row }) => (
        <span className="text-sm">{matchPairName(row.original.pairBId)}</span>
      ),
    }),
    matchColumnHelper.display({
      id: "score",
      header: "Score",
      cell: ({ row }) => (
        <span className="font-mono text-sm">{formatScore(row.original)}</span>
      ),
    }),
    matchColumnHelper.accessor("status", {
      header: "Status",
      cell: (info) => (
        <Badge
          variant={
            info.getValue() === "COMPLETED" || info.getValue() === "CORRECTED"
              ? "default"
              : info.getValue() === "IN_PROGRESS"
                ? "secondary"
                : "outline"
          }
        >
          {MATCH_STATUS_LABEL[info.getValue()]}
        </Badge>
      ),
    }),
    matchColumnHelper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditMatch(row.original)}
        >
          <PencilIcon className="size-4" />
          Edit
        </Button>
      ),
    }),
  ];

  const table = useReactTable({
    data: matches,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog
          open={createOpen}
          onOpenChange={(o) => {
            setCreateOpen(o);
            if (!o) createForm.reset();
          }}
        >
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            New Match
          </Button>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Match</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void createForm.handleSubmit();
              }}
              className="space-y-4"
            >
              <FieldGroup>
                <createForm.Field name="round">
                  {(field) => (
                    <Field>
                      <FieldLabel>Round</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(v) =>
                          field.handleChange(v as MatchRound)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(MATCH_ROUND_LABEL).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                </createForm.Field>

                <createForm.Field
                  name="pairAId"
                  validators={{
                    onChange: ({ value }) => (!value ? "Required" : undefined),
                  }}
                >
                  {(field) => (
                    <Field
                      data-invalid={
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0
                      }
                    >
                      <FieldLabel>Pair A</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(v) => field.handleChange(v ?? "")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select pair" />
                        </SelectTrigger>
                        <SelectContent>
                          {pairs.map((p) => (
                            <SelectItem key={p._id} value={p._id}>
                              {pairLabel(p)}
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

                <createForm.Field
                  name="pairBId"
                  validators={{
                    onChange: ({ value }) => (!value ? "Required" : undefined),
                  }}
                >
                  {(field) => (
                    <Field
                      data-invalid={
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0
                      }
                    >
                      <FieldLabel>Pair B</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(v) => field.handleChange(v ?? "")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select pair" />
                        </SelectTrigger>
                        <SelectContent>
                          {pairs.map((p) => (
                            <SelectItem key={p._id} value={p._id}>
                              {pairLabel(p)}
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

                <createForm.Field name="scheduledAt">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        Scheduled At (optional)
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
                </createForm.Field>
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
                  No matches yet.
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

      {/* Edit match dialog */}
      <Dialog
        open={!!editMatch}
        onOpenChange={(o) => {
          if (!o) setEditMatch(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Match</DialogTitle>
          </DialogHeader>
          {editMatch && (
            <MatchEditDialog
              match={editMatch}
              pairs={pairs}
              onClose={() => setEditMatch(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function meta() {
  return [{ title: "Tournament — FantaBeach Admin" }];
}

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: tournament, isLoading: tournamentLoading } = useQuery({
    queryKey: ["tournament", id],
    queryFn: () => adminApi.getTournament(id!),
    enabled: !!id,
  });

  const { data: pairs = [] } = useQuery({
    queryKey: ["pairs", id],
    queryFn: () => adminApi.getTournamentPairs(id!),
    enabled: !!id,
  });

  const lockMutation = useMutation({
    mutationFn: () => adminApi.lockLineups(id!),
    onSuccess: () => {
      toast.success("Lineups locked");
      void queryClient.invalidateQueries({ queryKey: ["tournament", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Lock failed"),
  });

  const championshipId = tournament ? getChampionshipId(tournament) : "";

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          render={<Link to="/admin/tournaments" />}
        >
          <ArrowLeftIcon className="size-4" />
          Tournaments
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div className="space-y-1">
          {tournamentLoading ? (
            <>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </>
          ) : tournament ? (
            <>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold">
                  {tournament.location}
                </h1>
                <Badge variant={STATUS_VARIANT[tournament.status]}>
                  {STATUS_LABEL[tournament.status]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {new Date(tournament.startDate).toLocaleDateString()} –{" "}
                {new Date(tournament.endDate).toLocaleDateString()}
                {tournament.lineupLockAt &&
                  ` · Lock: ${new Date(tournament.lineupLockAt).toLocaleString()}`}
              </p>
            </>
          ) : null}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => lockMutation.mutate()}
          disabled={lockMutation.isPending}
        >
          <LockIcon className="size-4" />
          {lockMutation.isPending ? "Locking…" : "Lock Lineups"}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pairs">
        <TabsList>
          <TabsTrigger value="pairs">Pairs</TabsTrigger>
          <TabsTrigger value="matches">Matches</TabsTrigger>
        </TabsList>

        <TabsContent value="pairs" className="mt-4">
          {id && <PairsTab tournamentId={id} championshipId={championshipId} />}
        </TabsContent>

        <TabsContent value="matches" className="mt-4">
          {id && <MatchesTab tournamentId={id} pairs={pairs} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
