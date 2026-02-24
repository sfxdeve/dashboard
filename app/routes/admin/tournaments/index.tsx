import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { DatePickerField } from "~/components/blocks/date-picker-field";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
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
import { adminApi } from "~/lib/api";
import { queryKeys } from "~/lib/api/query-keys";
import { CURATED_TIMEZONES, isValidTimeZone } from "~/lib/datetime";
import type {
  Gender,
  TournamentFilters,
  TournamentStatus,
} from "~/lib/api/types";
import { toFieldErrors, tournamentSchema } from "~/lib/validation/admin";

const TOURNAMENT_STATUS_ORDER: TournamentStatus[] = [
  "draft",
  "open",
  "entry_locked",
  "live",
  "completed",
  "archived",
];

const STATUS_OPTIONS = ["all", ...TOURNAMENT_STATUS_ORDER] as const;
const GENDER_OPTIONS = ["all", "men", "women"] as const;

type PendingStatusUpdate = {
  tournamentId: string;
  tournamentName: string;
  nextStatus: TournamentStatus;
};

type PendingLock = {
  tournamentId: string;
  tournamentName: string;
};

function canFinalizeEntryList(lineupLockAt: string) {
  const lockTs = Date.parse(lineupLockAt);
  if (!Number.isFinite(lockTs)) {
    return false;
  }
  return Date.now() >= lockTs;
}

export function meta() {
  return [{ title: "Tournaments" }];
}

export default function TournamentListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const seasonsQuery = useQuery({
    queryKey: queryKeys.seasons,
    queryFn: () => adminApi.getSeasons(),
  });

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [seasonId, setSeasonId] = React.useState("s_2026");
  const [name, setName] = React.useState("New Stage");
  const [slug, setSlug] = React.useState("new-stage");
  const [location, setLocation] = React.useState("Rome");
  const [gender, setGender] = React.useState<Gender>("men");
  const [startDate, setStartDate] = React.useState("2026-06-19");
  const [endDate, setEndDate] = React.useState("2026-06-21");
  const [rosterSize, setRosterSize] = React.useState("10");
  const [starterCount, setStarterCount] = React.useState("4");
  const [reserveCount, setReserveCount] = React.useState("3");
  const [lineupLockAt, setLineupLockAt] = React.useState(
    "2026-06-18T18:00:00.000Z",
  );
  const [timezone, setTimezone] = React.useState("Europe/Rome");
  const [createErrors, setCreateErrors] = React.useState<
    Record<string, string>
  >({});
  const [createFormError, setCreateFormError] = React.useState<string | null>(
    null,
  );

  const [filterSeasonId, setFilterSeasonId] = React.useState("all");
  const [filterStatus, setFilterStatus] =
    React.useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [filterGender, setFilterGender] =
    React.useState<(typeof GENDER_OPTIONS)[number]>("all");

  const [pendingStatusUpdate, setPendingStatusUpdate] =
    React.useState<PendingStatusUpdate | null>(null);
  const [pendingLock, setPendingLock] = React.useState<PendingLock | null>(
    null,
  );
  const timezoneError = !isValidTimeZone(timezone)
    ? "Select a valid timezone"
    : undefined;

  React.useEffect(() => {
    if (seasonsQuery.data?.[0]) {
      setSeasonId(seasonsQuery.data[0].id);
    }
  }, [seasonsQuery.data]);

  const activeFilters = React.useMemo<TournamentFilters>(() => {
    return {
      seasonId: filterSeasonId === "all" ? undefined : filterSeasonId,
      status: filterStatus === "all" ? undefined : filterStatus,
      gender: filterGender === "all" ? undefined : filterGender,
    };
  }, [filterGender, filterSeasonId, filterStatus]);

  const tournamentsQuery = useQuery({
    queryKey: queryKeys.tournaments(activeFilters),
    queryFn: () => adminApi.getTournaments(activeFilters),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.tournamentsRoot });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (timezoneError) {
        setCreateErrors((current) => ({ ...current, timezone: timezoneError }));
        throw new Error("Please correct the highlighted fields");
      }

      const parsed = tournamentSchema.safeParse({
        seasonId,
        name,
        slug,
        location,
        gender,
        startDate,
        endDate,
        rosterSize,
        starterCount,
        reserveCount,
        lineupLockAt,
        timezone,
      });

      if (!parsed.success) {
        setCreateErrors(toFieldErrors(parsed.error));
        throw new Error("Please correct the highlighted fields");
      }

      if (
        parsed.data.starterCount + parsed.data.reserveCount >
        parsed.data.rosterSize
      ) {
        setCreateErrors({
          starterCount: "Starters + reserves cannot exceed roster size",
        });
        throw new Error("Please correct the highlighted fields");
      }

      setCreateErrors({});
      setCreateFormError(null);

      return adminApi.createTournament({
        seasonId: parsed.data.seasonId,
        name: parsed.data.name,
        slug: parsed.data.slug,
        location: parsed.data.location,
        gender: parsed.data.gender,
        isPublic: true,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        policy: {
          rosterSize: parsed.data.rosterSize,
          starterCount: parsed.data.starterCount,
          reserveCount: parsed.data.reserveCount,
          lineupLockAt: parsed.data.lineupLockAt,
          timezone: parsed.data.timezone,
          noRetroactiveScoring: true,
          genderIsolation: true,
        },
      });
    },
    onSuccess: () => {
      toast.success("Tournament created");
      setIsCreateOpen(false);
      refresh();
    },
    onError: (error) => {
      setCreateFormError(
        error instanceof Error ? error.message : "Failed to create tournament",
      );
    },
  });

  const lockMutation = useMutation({
    mutationFn: (tournamentId: string) => adminApi.lockEntryList(tournamentId),
    onSuccess: () => {
      toast.success("Entry list locked");
      setPendingLock(null);
      refresh();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to lock entry list",
      );
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({
      tournamentId,
      status,
    }: {
      tournamentId: string;
      status: TournamentStatus;
    }) => adminApi.updateTournament(tournamentId, { status }),
    onSuccess: () => {
      toast.success("Tournament updated");
      setPendingStatusUpdate(null);
      refresh();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update tournament",
      );
    },
  });

  if (seasonsQuery.isLoading || tournamentsQuery.isLoading) {
    return (
      <QueryStateCard
        state="loading"
        title="Loading Tournaments"
        description="Fetching seasons and tournament operations data."
      />
    );
  }

  if (seasonsQuery.isError || tournamentsQuery.isError) {
    return (
      <QueryStateCard
        state="error"
        title="Tournaments Unavailable"
        description="Failed to load tournament data."
        onRetry={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.seasons });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.tournamentsRoot,
          });
        }}
      />
    );
  }

  const isPending =
    createMutation.isPending ||
    statusMutation.isPending ||
    lockMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tournament Operations"
        description="Manage tournament lifecycle, lock timing, and operational policies."
        action={
          <Button onClick={() => setIsCreateOpen(true)} disabled={isPending}>
            <PlusIcon />
            New Tournament
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <NativeSelect
          value={filterSeasonId}
          onChange={(event) => setFilterSeasonId(event.target.value)}
          disabled={isPending}
        >
          <NativeSelectOption value="all">All seasons</NativeSelectOption>
          {(seasonsQuery.data ?? []).map((season) => (
            <NativeSelectOption key={`filter-${season.id}`} value={season.id}>
              {season.year} - {season.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          value={filterStatus}
          onChange={(event) =>
            setFilterStatus(
              event.target.value as (typeof STATUS_OPTIONS)[number],
            )
          }
          disabled={isPending}
        >
          <NativeSelectOption value="all">All statuses</NativeSelectOption>
          {TOURNAMENT_STATUS_ORDER.map((status) => (
            <NativeSelectOption key={status} value={status}>
              {status.replaceAll("_", " ")}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          value={filterGender}
          onChange={(event) =>
            setFilterGender(
              event.target.value as (typeof GENDER_OPTIONS)[number],
            )
          }
          disabled={isPending}
        >
          <NativeSelectOption value="all">All genders</NativeSelectOption>
          <NativeSelectOption value="men">Men</NativeSelectOption>
          <NativeSelectOption value="women">Women</NativeSelectOption>
        </NativeSelect>
        <Button
          variant="outline"
          onClick={() => {
            setFilterSeasonId("all");
            setFilterStatus("all");
            setFilterGender("all");
          }}
          disabled={isPending}
        >
          Reset Filters
        </Button>
      </div>

      <EntityTable
        rows={tournamentsQuery.data ?? []}
        getRowKey={(row) => row.id}
        columns={[
          {
            key: "name",
            label: "Tournament",
            render: (row) => (
              <div>
                <div className="font-medium">{row.name}</div>
                <div className="text-muted-foreground text-xs">
                  {row.location}
                </div>
              </div>
            ),
          },
          {
            key: "gender",
            label: "Gender",
            render: (row) => row.gender.toUpperCase(),
          },
          {
            key: "status",
            label: "Status",
            render: (row) => <StatusChip status={row.status} />,
          },
          {
            key: "actions",
            label: "Actions",
            render: (row) => {
              const currentIndex = TOURNAMENT_STATUS_ORDER.indexOf(row.status);
              const nextStatus =
                TOURNAMENT_STATUS_ORDER[
                  (currentIndex + 1) % TOURNAMENT_STATUS_ORDER.length
                ];
              const lockWindowOpen = canFinalizeEntryList(
                row.policy.lineupLockAt,
              );
              const lockDisabled = row.entryListLocked || !lockWindowOpen;
              const lockLabel = row.entryListLocked
                ? "Entry list already locked"
                : !lockWindowOpen
                  ? "Lock available at configured lock time"
                  : "Lock entry list";

              return (
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
                      onClick={() => navigate(`/admin/tournaments/${row.id}`)}
                    >
                      Open
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setPendingStatusUpdate({
                          tournamentId: row.id,
                          tournamentName: row.name,
                          nextStatus,
                        });
                      }}
                    >
                      Set status to {nextStatus}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={lockDisabled}
                      onClick={() => {
                        setPendingLock({
                          tournamentId: row.id,
                          tournamentName: row.name,
                        });
                      }}
                    >
                      {lockLabel}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            },
          },
        ]}
      />

      {(tournamentsQuery.data ?? []).length === 0 ? (
        <QueryStateCard
          state="empty"
          title="No Tournaments Found"
          description="Create a tournament stage to begin admin operations."
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
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Create Tournament</SheetTitle>
            <SheetDescription>
              Set base structure, policy, and Thursday-evening lock windows for
              a new tournament.
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
              value={seasonId}
              onChange={(event) => setSeasonId(event.target.value)}
              disabled={createMutation.isPending}
            >
              {(seasonsQuery.data ?? []).map((season) => (
                <NativeSelectOption key={season.id} value={season.id}>
                  {season.year} - {season.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {createErrors.seasonId ? (
              <p className="text-destructive text-xs">
                {createErrors.seasonId}
              </p>
            ) : null}

            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name"
              disabled={createMutation.isPending}
            />
            {createErrors.name ? (
              <p className="text-destructive text-xs">{createErrors.name}</p>
            ) : null}

            <Input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="Slug"
              disabled={createMutation.isPending}
            />
            {createErrors.slug ? (
              <p className="text-destructive text-xs">{createErrors.slug}</p>
            ) : null}

            <Input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Location"
              disabled={createMutation.isPending}
            />
            {createErrors.location ? (
              <p className="text-destructive text-xs">
                {createErrors.location}
              </p>
            ) : null}

            <NativeSelect
              value={gender}
              onChange={(event) => setGender(event.target.value as Gender)}
              disabled={createMutation.isPending}
            >
              <NativeSelectOption value="men">Men</NativeSelectOption>
              <NativeSelectOption value="women">Women</NativeSelectOption>
            </NativeSelect>

            <DatePickerField
              label="Start Date"
              value={startDate}
              onChange={setStartDate}
              disabled={createMutation.isPending}
              required
              error={createErrors.startDate}
            />

            <DatePickerField
              label="End Date"
              value={endDate}
              onChange={setEndDate}
              disabled={createMutation.isPending}
              required
              error={createErrors.endDate}
            />

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Input
                  value={rosterSize}
                  onChange={(event) => setRosterSize(event.target.value)}
                  placeholder="Roster"
                  disabled={createMutation.isPending}
                />
                {createErrors.rosterSize ? (
                  <p className="text-destructive mt-1 text-xs">
                    {createErrors.rosterSize}
                  </p>
                ) : null}
              </div>
              <div>
                <Input
                  value={starterCount}
                  onChange={(event) => setStarterCount(event.target.value)}
                  placeholder="Starters"
                  disabled={createMutation.isPending}
                />
                {createErrors.starterCount ? (
                  <p className="text-destructive mt-1 text-xs">
                    {createErrors.starterCount}
                  </p>
                ) : null}
              </div>
              <div>
                <Input
                  value={reserveCount}
                  onChange={(event) => setReserveCount(event.target.value)}
                  placeholder="Reserves"
                  disabled={createMutation.isPending}
                />
                {createErrors.reserveCount ? (
                  <p className="text-destructive mt-1 text-xs">
                    {createErrors.reserveCount}
                  </p>
                ) : null}
              </div>
            </div>

            <DateTimePickerField
              label="Thursday-evening Lock"
              value={lineupLockAt}
              onChange={setLineupLockAt}
              timezone={timezone}
              disabled={createMutation.isPending}
              required
              error={createErrors.lineupLockAt}
            />

            <div className="space-y-2">
              <p className="text-sm font-medium">Timezone *</p>
              <NativeSelect
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                disabled={createMutation.isPending}
              >
                {CURATED_TIMEZONES.map((timeZone) => (
                  <NativeSelectOption key={timeZone} value={timeZone}>
                    {timeZone}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {timezoneError ? (
                <p className="text-destructive text-xs">{timezoneError}</p>
              ) : null}
              {createErrors.timezone ? (
                <p className="text-destructive text-xs">
                  {createErrors.timezone}
                </p>
              ) : null}
            </div>

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
                disabled={createMutation.isPending || Boolean(timezoneError)}
              >
                {createMutation.isPending ? "Creating..." : "Create Tournament"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={Boolean(pendingStatusUpdate)}
        onOpenChange={(open) => {
          if (!statusMutation.isPending && !open) {
            setPendingStatusUpdate(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm status change</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatusUpdate
                ? `Set ${pendingStatusUpdate.tournamentName} to ${pendingStatusUpdate.nextStatus}?`
                : "Confirm this action."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={statusMutation.isPending || !pendingStatusUpdate}
              onClick={() => {
                if (!pendingStatusUpdate) {
                  return;
                }
                statusMutation.mutate({
                  tournamentId: pendingStatusUpdate.tournamentId,
                  status: pendingStatusUpdate.nextStatus,
                });
              }}
            >
              {statusMutation.isPending ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingLock)}
        onOpenChange={(open) => {
          if (!lockMutation.isPending && !open) {
            setPendingLock(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lock entry list</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingLock
                ? `Locking ${pendingLock.tournamentName} entry list cannot be undone from this screen.`
                : "Confirm this action."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={lockMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={lockMutation.isPending || !pendingLock}
              onClick={() => {
                if (!pendingLock) {
                  return;
                }
                lockMutation.mutate(pendingLock.tournamentId);
              }}
            >
              {lockMutation.isPending ? "Locking..." : "Lock Entry List"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
