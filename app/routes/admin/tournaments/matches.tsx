import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { DateTimePickerField } from "~/components/blocks/date-time-picker-field";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { adminApi } from "~/lib/api";
import { queryKeys } from "~/lib/api/query-keys";
import {
  formatDateTimeForButton,
  isValidTimeZone,
  toDateOnlyInput,
} from "~/lib/datetime";
import type {
  DayBucket,
  Match,
  SetScore,
  TournamentPhase,
} from "~/lib/api/types";
import {
  matchCreateSchema,
  matchScoreSchema,
  toFieldErrors,
} from "~/lib/validation/admin";

const DAY_TABS: Array<"all" | DayBucket> = [
  "all",
  "friday",
  "saturday",
  "sunday",
];
const PHASE_TABS: Array<"all" | TournamentPhase> = [
  "all",
  "qualification",
  "pools",
  "main_draw",
];
const DAY_OFFSET: Record<DayBucket, number> = {
  friday: 1,
  saturday: 2,
  sunday: 3,
};

type PendingCompletion = {
  matchId: string;
  setScores: SetScore[];
};

function toSetScores(values: {
  set1A: number;
  set1B: number;
  set2A: number;
  set2B: number;
  set3A?: string;
  set3B?: string;
}) {
  const base: SetScore[] = [
    { setNumber: 1, pairAScore: values.set1A, pairBScore: values.set1B },
    { setNumber: 2, pairAScore: values.set2A, pairBScore: values.set2B },
  ];

  if (values.set3A && values.set3B) {
    base.push({
      setNumber: 3,
      pairAScore: Number(values.set3A),
      pairBScore: Number(values.set3B),
    });
  }

  return base;
}

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  const utcDate = new Date(Date.UTC(year, month - 1, day + days));
  return utcDate.toISOString().slice(0, 10);
}

function getCadenceError(params: {
  day: DayBucket;
  scheduledAt: string;
  lineupLockAt: string;
  timezone: string;
}) {
  const lockDateKey = toDateOnlyInput(params.lineupLockAt, params.timezone);
  const scheduledDateKey = toDateOnlyInput(params.scheduledAt, params.timezone);
  if (!lockDateKey || !scheduledDateKey) {
    return "Match timing configuration is invalid.";
  }

  const dayOffset = DAY_OFFSET[params.day];
  const expectedDateKey = addDaysToDateKey(lockDateKey, dayOffset);
  if (scheduledDateKey !== expectedDateKey) {
    return `${params.day[0].toUpperCase()}${params.day.slice(1)} matches must be scheduled on ${expectedDateKey} (${params.timezone}).`;
  }

  const todayDateKey = toDateOnlyInput(
    new Date().toISOString(),
    params.timezone,
  );
  const windowStartKey = addDaysToDateKey(lockDateKey, dayOffset - 1);
  const windowEndKey = expectedDateKey;
  if (todayDateKey < windowStartKey || todayDateKey > windowEndKey) {
    return `${params.day[0].toUpperCase()}${params.day.slice(1)} match creation is only allowed between ${windowStartKey} and ${windowEndKey} (${params.timezone}).`;
  }

  return null;
}

export function meta() {
  return [{ title: "Matches" }];
}

export default function MatchesPage() {
  const params = useParams();
  const tournamentId = params.tournamentId as string;
  const queryClient = useQueryClient();

  const matchesQuery = useQuery({
    queryKey: queryKeys.matches(tournamentId),
    queryFn: () => adminApi.getMatches(tournamentId),
  });

  const entryListQuery = useQuery({
    queryKey: queryKeys.entryList(tournamentId),
    queryFn: () => adminApi.getEntryList(tournamentId),
  });
  const tournamentQuery = useQuery({
    queryKey: queryKeys.tournament(tournamentId),
    queryFn: () => adminApi.getTournament(tournamentId),
  });

  const [selectedDayTab, setSelectedDayTab] =
    React.useState<(typeof DAY_TABS)[number]>("all");
  const [selectedPhaseTab, setSelectedPhaseTab] =
    React.useState<(typeof PHASE_TABS)[number]>("all");

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<TournamentPhase>("qualification");
  const [day, setDay] = React.useState<DayBucket>("friday");
  const [pairAId, setPairAId] = React.useState("");
  const [pairBId, setPairBId] = React.useState("");
  const [scheduledAt, setScheduledAt] = React.useState(
    "2026-06-20T12:30:00.000Z",
  );
  const [createErrors, setCreateErrors] = React.useState<
    Record<string, string>
  >({});
  const [createFormError, setCreateFormError] = React.useState<string | null>(
    null,
  );

  const [scoreSheetMatchId, setScoreSheetMatchId] = React.useState<
    string | null
  >(null);
  const [set1A, setSet1A] = React.useState("21");
  const [set1B, setSet1B] = React.useState("18");
  const [set2A, setSet2A] = React.useState("21");
  const [set2B, setSet2B] = React.useState("16");
  const [set3A, setSet3A] = React.useState("");
  const [set3B, setSet3B] = React.useState("");
  const [scoreErrors, setScoreErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [scoreFormError, setScoreFormError] = React.useState<string | null>(
    null,
  );
  const [pendingCompletion, setPendingCompletion] =
    React.useState<PendingCompletion | null>(null);
  const tournamentTimeZone = tournamentQuery.data?.policy.timezone ?? "UTC";
  const timezoneError = !isValidTimeZone(tournamentTimeZone)
    ? "Tournament time zone is invalid. Match schedule time cannot be edited."
    : undefined;
  const cadenceError = React.useMemo(() => {
    if (!tournamentQuery.data || timezoneError) {
      return null;
    }

    return getCadenceError({
      day,
      scheduledAt,
      lineupLockAt: tournamentQuery.data.policy.lineupLockAt,
      timezone: tournamentQuery.data.policy.timezone,
    });
  }, [day, scheduledAt, timezoneError, tournamentQuery.data]);

  const filteredMatches = React.useMemo(() => {
    return (matchesQuery.data ?? []).filter((match) => {
      if (selectedDayTab !== "all" && match.day !== selectedDayTab) {
        return false;
      }
      if (selectedPhaseTab !== "all" && match.phase !== selectedPhaseTab) {
        return false;
      }
      return true;
    });
  }, [matchesQuery.data, selectedDayTab, selectedPhaseTab]);

  const selectedMatch = React.useMemo(() => {
    if (!scoreSheetMatchId) {
      return null;
    }
    return (
      (matchesQuery.data ?? []).find((item) => item.id === scoreSheetMatchId) ??
      null
    );
  }, [matchesQuery.data, scoreSheetMatchId]);

  React.useEffect(() => {
    const first = entryListQuery.data?.[0]?.pair.id;
    const second = entryListQuery.data?.[1]?.pair.id;
    if (first) {
      setPairAId(first);
    }
    if (second) {
      setPairBId(second);
    }
  }, [entryListQuery.data]);

  React.useEffect(() => {
    if (!selectedMatch) {
      return;
    }

    setSet1A(String(selectedMatch.setScores[0]?.pairAScore ?? "21"));
    setSet1B(String(selectedMatch.setScores[0]?.pairBScore ?? "18"));
    setSet2A(String(selectedMatch.setScores[1]?.pairAScore ?? "21"));
    setSet2B(String(selectedMatch.setScores[1]?.pairBScore ?? "16"));
    setSet3A(
      selectedMatch.setScores[2]
        ? String(selectedMatch.setScores[2].pairAScore)
        : "",
    );
    setSet3B(
      selectedMatch.setScores[2]
        ? String(selectedMatch.setScores[2].pairBScore)
        : "",
    );
    setScoreErrors({});
    setScoreFormError(null);
  }, [selectedMatch]);

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.matches(tournamentId),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.bracket(tournamentId),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.scoringRuns(tournamentId),
    });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (timezoneError) {
        throw new Error(timezoneError);
      }
      if (cadenceError) {
        throw new Error(cadenceError);
      }

      const parsed = matchCreateSchema.safeParse({
        phase,
        day,
        pairAId,
        pairBId,
        scheduledAt,
      });
      if (!parsed.success) {
        setCreateErrors(toFieldErrors(parsed.error));
        throw new Error("Please correct the highlighted fields");
      }
      if (parsed.data.pairAId === parsed.data.pairBId) {
        setCreateErrors({ pairBId: "Pair B must be different from Pair A" });
        throw new Error("Please correct the highlighted fields");
      }

      setCreateErrors({});
      setCreateFormError(null);
      return adminApi.createMatch(tournamentId, {
        tournamentId,
        phase: parsed.data.phase,
        day: parsed.data.day,
        round: 1,
        slot: (matchesQuery.data?.length ?? 0) + 1,
        pairAId: parsed.data.pairAId,
        pairBId: parsed.data.pairBId,
        scheduledAt: parsed.data.scheduledAt,
      });
    },
    onSuccess: () => {
      toast.success("Match created");
      setIsCreateOpen(false);
      refresh();
    },
    onError: (error) => {
      setCreateFormError(
        error instanceof Error ? error.message : "Failed to create match",
      );
    },
  });

  const updateScoreMutation = useMutation({
    mutationFn: ({
      matchId,
      setScores,
    }: {
      matchId: string;
      setScores: SetScore[];
    }) =>
      adminApi.updateMatch(matchId, {
        status: "live",
        setScores,
      }),
    onSuccess: () => {
      toast.success("Score draft saved");
      refresh();
    },
    onError: (error) => {
      setScoreFormError(
        error instanceof Error ? error.message : "Failed to save score draft",
      );
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({
      matchId,
      setScores,
    }: {
      matchId: string;
      setScores: SetScore[];
    }) =>
      adminApi.completeMatch(matchId, {
        setScores,
      }),
    onSuccess: () => {
      toast.success("Match completed");
      setPendingCompletion(null);
      setScoreSheetMatchId(null);
      refresh();
    },
    onError: (error) => {
      setScoreFormError(
        error instanceof Error ? error.message : "Failed to complete match",
      );
    },
  });

  if (
    matchesQuery.isLoading ||
    entryListQuery.isLoading ||
    tournamentQuery.isLoading
  ) {
    return (
      <QueryStateCard
        state="loading"
        title="Loading Matches"
        description="Fetching schedule and Entry List pair mappings."
      />
    );
  }

  if (
    matchesQuery.isError ||
    entryListQuery.isError ||
    tournamentQuery.isError
  ) {
    return (
      <QueryStateCard
        state="error"
        title="Matches Unavailable"
        description="Could not load match operations data."
        onRetry={() => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.matches(tournamentId),
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.entryList(tournamentId),
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.tournament(tournamentId),
          });
        }}
      />
    );
  }

  const isAnyPending =
    createMutation.isPending ||
    updateScoreMutation.isPending ||
    completeMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Match Operations"
        description="Schedule and score qualification, pool, and main draw matches with deterministic progression."
        action={
          <Button onClick={() => setIsCreateOpen(true)} disabled={isAnyPending}>
            <PlusIcon />
            New Match
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Schedule Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs
            value={selectedDayTab}
            onValueChange={(value) =>
              setSelectedDayTab(value as (typeof DAY_TABS)[number])
            }
          >
            <TabsList>
              <TabsTrigger value="all">All Days</TabsTrigger>
              <TabsTrigger value="friday">Friday</TabsTrigger>
              <TabsTrigger value="saturday">Saturday</TabsTrigger>
              <TabsTrigger value="sunday">Sunday</TabsTrigger>
            </TabsList>
            <TabsContent value={selectedDayTab} />
          </Tabs>

          <Tabs
            value={selectedPhaseTab}
            onValueChange={(value) =>
              setSelectedPhaseTab(value as (typeof PHASE_TABS)[number])
            }
          >
            <TabsList>
              <TabsTrigger value="all">All Phases</TabsTrigger>
              <TabsTrigger value="qualification">Qualification</TabsTrigger>
              <TabsTrigger value="pools">Pools</TabsTrigger>
              <TabsTrigger value="main_draw">Main Draw</TabsTrigger>
            </TabsList>
            <TabsContent value={selectedPhaseTab} />
          </Tabs>
        </CardContent>
      </Card>

      <EntityTable
        rows={filteredMatches}
        getRowKey={(row) => row.id}
        columns={[
          {
            key: "match",
            label: "Match",
            render: (row) => (
              <div>
                <p className="font-medium">{row.id}</p>
                <p className="text-muted-foreground text-xs">
                  {row.phase} · {row.day}
                </p>
              </div>
            ),
          },
          {
            key: "pairs",
            label: "Pairs",
            render: (row) => `${row.pairAId} vs ${row.pairBId}`,
          },
          {
            key: "status",
            label: "Status",
            render: (row) => <StatusChip status={row.status} />,
          },
          {
            key: "scheduled",
            label: "Scheduled",
            render: (row) =>
              formatDateTimeForButton(row.scheduledAt, tournamentTimeZone),
          },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={isAnyPending}
                      aria-label={`Open actions for ${row.id}`}
                    >
                      <MoreHorizontalIcon />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setScoreSheetMatchId(row.id)}
                  >
                    Edit Score
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]}
      />

      {(matchesQuery.data ?? []).length === 0 ? (
        <QueryStateCard
          state="empty"
          title="No Matches Scheduled"
          description="Insert first-round matches to start deterministic bracket and scoring progression."
        />
      ) : null}

      <Sheet
        open={isCreateOpen}
        onOpenChange={(nextOpen) => {
          if (!createMutation.isPending) {
            setIsCreateOpen(nextOpen);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Create Match</SheetTitle>
            <SheetDescription>
              Add a scheduled match for the selected phase and day.
            </SheetDescription>
          </SheetHeader>

          <form
            className="space-y-3 px-4"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
          >
            <NativeSelect
              value={phase}
              onChange={(event) =>
                setPhase(event.target.value as TournamentPhase)
              }
              disabled={createMutation.isPending}
            >
              <NativeSelectOption value="qualification">
                Qualification
              </NativeSelectOption>
              <NativeSelectOption value="pools">Pools</NativeSelectOption>
              <NativeSelectOption value="main_draw">
                Main Draw
              </NativeSelectOption>
            </NativeSelect>
            {createErrors.phase ? (
              <p className="text-destructive text-xs">{createErrors.phase}</p>
            ) : null}

            <NativeSelect
              value={day}
              onChange={(event) => setDay(event.target.value as DayBucket)}
              disabled={createMutation.isPending}
            >
              <NativeSelectOption value="friday">Friday</NativeSelectOption>
              <NativeSelectOption value="saturday">Saturday</NativeSelectOption>
              <NativeSelectOption value="sunday">Sunday</NativeSelectOption>
            </NativeSelect>
            {createErrors.day ? (
              <p className="text-destructive text-xs">{createErrors.day}</p>
            ) : null}

            <NativeSelect
              value={pairAId}
              onChange={(event) => setPairAId(event.target.value)}
              disabled={createMutation.isPending}
            >
              {(entryListQuery.data ?? []).map((item) => (
                <NativeSelectOption
                  key={`a-${item.pair.id}`}
                  value={item.pair.id}
                >
                  A: {item.pair.id}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {createErrors.pairAId ? (
              <p className="text-destructive text-xs">{createErrors.pairAId}</p>
            ) : null}

            <NativeSelect
              value={pairBId}
              onChange={(event) => setPairBId(event.target.value)}
              disabled={createMutation.isPending}
            >
              {(entryListQuery.data ?? []).map((item) => (
                <NativeSelectOption
                  key={`b-${item.pair.id}`}
                  value={item.pair.id}
                >
                  B: {item.pair.id}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {createErrors.pairBId ? (
              <p className="text-destructive text-xs">{createErrors.pairBId}</p>
            ) : null}

            <DateTimePickerField
              label="Scheduled At"
              value={scheduledAt}
              onChange={setScheduledAt}
              timezone={tournamentTimeZone}
              disabled={createMutation.isPending || Boolean(timezoneError)}
              required
              error={createErrors.scheduledAt}
            />
            {timezoneError ? (
              <p className="text-destructive text-xs">{timezoneError}</p>
            ) : null}
            {cadenceError ? (
              <p className="text-destructive text-xs">{cadenceError}</p>
            ) : null}

            {createFormError ? (
              <p className="text-destructive text-xs">{createFormError}</p>
            ) : null}

            <SheetFooter className="px-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createMutation.isPending ||
                  Boolean(timezoneError) ||
                  Boolean(cadenceError)
                }
              >
                {createMutation.isPending ? "Creating..." : "Create Match"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet
        open={Boolean(scoreSheetMatchId)}
        onOpenChange={(nextOpen) => {
          if (!isAnyPending && !nextOpen) {
            setScoreSheetMatchId(null);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Score Editor</SheetTitle>
            <SheetDescription>
              {selectedMatch
                ? `${selectedMatch.id} · ${selectedMatch.pairAId} vs ${selectedMatch.pairBId}`
                : "Select a match to edit score."}
            </SheetDescription>
          </SheetHeader>

          <form
            className="space-y-3 px-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!selectedMatch) {
                return;
              }

              const parsed = matchScoreSchema.safeParse({
                set1A,
                set1B,
                set2A,
                set2B,
                set3A,
                set3B,
              });

              if (!parsed.success) {
                setScoreErrors(toFieldErrors(parsed.error));
                setScoreFormError("Please correct the highlighted fields");
                return;
              }

              setScoreErrors({});
              setScoreFormError(null);
              updateScoreMutation.mutate({
                matchId: selectedMatch.id,
                setScores: toSetScores(parsed.data),
              });
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="match-score-set1a">Set 1 A</Label>
                <Input
                  id="match-score-set1a"
                  value={set1A}
                  onChange={(event) => setSet1A(event.target.value)}
                  placeholder="Set 1 A"
                  disabled={isAnyPending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="match-score-set1b">Set 1 B</Label>
                <Input
                  id="match-score-set1b"
                  value={set1B}
                  onChange={(event) => setSet1B(event.target.value)}
                  placeholder="Set 1 B"
                  disabled={isAnyPending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="match-score-set2a">Set 2 A</Label>
                <Input
                  id="match-score-set2a"
                  value={set2A}
                  onChange={(event) => setSet2A(event.target.value)}
                  placeholder="Set 2 A"
                  disabled={isAnyPending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="match-score-set2b">Set 2 B</Label>
                <Input
                  id="match-score-set2b"
                  value={set2B}
                  onChange={(event) => setSet2B(event.target.value)}
                  placeholder="Set 2 B"
                  disabled={isAnyPending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="match-score-set3a">Set 3 A (Optional)</Label>
                <Input
                  id="match-score-set3a"
                  value={set3A}
                  onChange={(event) => setSet3A(event.target.value)}
                  placeholder="Set 3 A (optional)"
                  disabled={isAnyPending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="match-score-set3b">Set 3 B (Optional)</Label>
                <Input
                  id="match-score-set3b"
                  value={set3B}
                  onChange={(event) => setSet3B(event.target.value)}
                  placeholder="Set 3 B (optional)"
                  disabled={isAnyPending}
                />
              </div>
            </div>

            {Object.values(scoreErrors).length > 0 ? (
              <p className="text-destructive text-xs">
                {Object.values(scoreErrors)[0]}
              </p>
            ) : null}
            {scoreFormError ? (
              <p className="text-destructive text-xs">{scoreFormError}</p>
            ) : null}

            <SheetFooter className="px-0">
              <Button
                type="button"
                variant="outline"
                disabled={isAnyPending}
                onClick={() => setScoreSheetMatchId(null)}
              >
                Close
              </Button>
              <Button
                type="submit"
                variant="outline"
                disabled={isAnyPending || !selectedMatch}
              >
                {updateScoreMutation.isPending ? "Saving..." : "Save Draft"}
              </Button>
              <Button
                type="button"
                disabled={isAnyPending || !selectedMatch}
                onClick={() => {
                  if (!selectedMatch) {
                    return;
                  }

                  const parsed = matchScoreSchema.safeParse({
                    set1A,
                    set1B,
                    set2A,
                    set2B,
                    set3A,
                    set3B,
                  });
                  if (!parsed.success) {
                    setScoreErrors(toFieldErrors(parsed.error));
                    setScoreFormError("Please correct the highlighted fields");
                    return;
                  }

                  setScoreErrors({});
                  setScoreFormError(null);
                  setPendingCompletion({
                    matchId: selectedMatch.id,
                    setScores: toSetScores(parsed.data),
                  });
                }}
              >
                Complete Match
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={Boolean(pendingCompletion)}
        onOpenChange={(open) => {
          if (!completeMutation.isPending && !open) {
            setPendingCompletion(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm match completion</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingCompletion
                ? `Match ${pendingCompletion.matchId} will be completed with ${pendingCompletion.setScores.length} sets.`
                : "Confirm this action."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingCompletion ? (
            <div className="text-muted-foreground rounded-md border p-3 text-xs">
              {pendingCompletion.setScores.map((set) => (
                <p key={set.setNumber}>
                  Set {set.setNumber}: {set.pairAScore} - {set.pairBScore}
                </p>
              ))}
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completeMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={completeMutation.isPending || !pendingCompletion}
              onClick={() => {
                if (!pendingCompletion) {
                  return;
                }
                completeMutation.mutate({
                  matchId: pendingCompletion.matchId,
                  setScores: pendingCompletion.setScores,
                });
              }}
            >
              {completeMutation.isPending
                ? "Completing..."
                : "Confirm Completion"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
