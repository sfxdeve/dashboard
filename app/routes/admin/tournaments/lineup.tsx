import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2Icon } from "lucide-react";
import { useParams } from "react-router";
import { toast } from "sonner";

import { DateTimePickerField } from "~/components/blocks/date-time-picker-field";
import { PageHeader } from "~/components/blocks/page-header";
import { QueryStateCard } from "~/components/blocks/query-state-card";
import { StatusChip } from "~/components/blocks/status-chip";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
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
import { formatDateTimeForButton, isValidTimeZone } from "~/lib/datetime";
import { lineupPolicySchema, toFieldErrors } from "~/lib/validation/admin";

export function meta() {
  return [{ title: "Lineup Policy" }];
}

export default function LineupPolicyPage() {
  const params = useParams();
  const tournamentId = params.tournamentId as string;
  const queryClient = useQueryClient();

  const tournamentQuery = useQuery({
    queryKey: queryKeys.tournament(tournamentId),
    queryFn: () => adminApi.getTournament(tournamentId),
  });

  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [rosterSize, setRosterSize] = React.useState("10");
  const [starterCount, setStarterCount] = React.useState("4");
  const [reserveCount, setReserveCount] = React.useState("3");
  const [lineupLockAt, setLineupLockAt] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!tournamentQuery.data) {
      return;
    }

    setRosterSize(String(tournamentQuery.data.policy.rosterSize));
    setStarterCount(String(tournamentQuery.data.policy.starterCount));
    setReserveCount(String(tournamentQuery.data.policy.reserveCount));
    setLineupLockAt(tournamentQuery.data.policy.lineupLockAt);
  }, [tournamentQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const activeTimeZone = tournamentQuery.data?.policy.timezone ?? "";
      if (!isValidTimeZone(activeTimeZone)) {
        throw new Error(
          "Tournament time zone is invalid. Update the time zone before saving lineup lock.",
        );
      }

      const parsed = lineupPolicySchema.safeParse({
        rosterSize,
        starterCount,
        reserveCount,
        lineupLockAt,
      });

      if (!parsed.success) {
        setErrors(toFieldErrors(parsed.error));
        throw new Error("Please correct the highlighted fields");
      }

      setErrors({});
      setFormError(null);

      return adminApi.updateTournament(tournamentId, {
        policy: {
          rosterSize: parsed.data.rosterSize,
          starterCount: parsed.data.starterCount,
          reserveCount: parsed.data.reserveCount,
          lineupLockAt: parsed.data.lineupLockAt,
        },
      });
    },
    onSuccess: () => {
      toast.success("Lineup policy updated");
      setIsSheetOpen(false);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tournament(tournamentId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tournamentsRoot,
      });
    },
    onError: (error) => {
      setFormError(
        error instanceof Error
          ? error.message
          : "Failed to update lineup policy",
      );
    },
  });

  const tournament = tournamentQuery.data;
  const isLocked = Boolean(tournament?.lineupLocked);
  const tournamentTimeZone = tournament?.policy.timezone ?? "UTC";
  const timezoneError = !isValidTimeZone(tournamentTimeZone)
    ? "Tournament time zone is invalid. Lineup lock cannot be edited until the time zone is corrected."
    : undefined;

  if (tournamentQuery.isLoading) {
    return (
      <QueryStateCard
        state="loading"
        title="Loading Lineup Policy"
        description="Fetching lineup lock and roster policy configuration."
      />
    );
  }

  if (tournamentQuery.isError) {
    return (
      <QueryStateCard
        state="error"
        title="Lineup Policy Unavailable"
        description="Could not load lineup policy data."
        onRetry={() => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.tournament(tournamentId),
          });
        }}
      />
    );
  }

  if (!tournament) {
    return (
      <QueryStateCard
        state="empty"
        title="No Tournament Selected"
        description="Lineup policy cannot be displayed because the tournament is missing."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lineup Policy"
        description="Roster constraints and Thursday evening lock policy for lineup operations."
        action={
          <Button
            variant="outline"
            onClick={() => setIsSheetOpen(true)}
            disabled={
              isLocked || saveMutation.isPending || Boolean(timezoneError)
            }
          >
            <Settings2Icon />
            Edit Policy
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Current Lock Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <StatusChip status={isLocked ? "locked" : "open"} />
            <span className="text-muted-foreground text-sm">
              Thursday evening lock at{" "}
              {formatDateTimeForButton(
                tournament.policy.lineupLockAt,
                tournamentTimeZone,
              )}{" "}
              ({tournament.policy.timezone})
            </span>
          </div>
          {timezoneError ? (
            <p className="text-destructive text-sm">{timezoneError}</p>
          ) : null}
          {isLocked ? (
            <p className="text-destructive text-sm">
              Lineup policy is immutable after lock time.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Policy edits remain available until lock time.
            </p>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={isSheetOpen}
        onOpenChange={(nextOpen) => {
          if (!saveMutation.isPending) {
            setIsSheetOpen(nextOpen);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Edit Lineup Policy</SheetTitle>
            <SheetDescription>
              Update lineup constraints before the Thursday evening lock time.
            </SheetDescription>
          </SheetHeader>

          <form
            className="space-y-3 px-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate();
            }}
          >
            <Input
              value={rosterSize}
              onChange={(event) => setRosterSize(event.target.value)}
              placeholder="Roster size"
              disabled={saveMutation.isPending || isLocked}
            />
            {errors.rosterSize ? (
              <p className="text-destructive text-xs">{errors.rosterSize}</p>
            ) : null}

            <Input
              value={starterCount}
              onChange={(event) => setStarterCount(event.target.value)}
              placeholder="Starters"
              disabled={saveMutation.isPending || isLocked}
            />
            {errors.starterCount ? (
              <p className="text-destructive text-xs">{errors.starterCount}</p>
            ) : null}

            <Input
              value={reserveCount}
              onChange={(event) => setReserveCount(event.target.value)}
              placeholder="Reserves"
              disabled={saveMutation.isPending || isLocked}
            />
            {errors.reserveCount ? (
              <p className="text-destructive text-xs">{errors.reserveCount}</p>
            ) : null}

            <DateTimePickerField
              label="Lineup Lock Timestamp"
              value={lineupLockAt}
              onChange={setLineupLockAt}
              timezone={tournamentTimeZone}
              disabled={
                saveMutation.isPending || isLocked || Boolean(timezoneError)
              }
              required
              error={errors.lineupLockAt}
            />
            {timezoneError ? (
              <p className="text-destructive text-xs">{timezoneError}</p>
            ) : null}

            {formError ? (
              <p className="text-destructive text-xs">{formError}</p>
            ) : null}

            <SheetFooter className="px-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSheetOpen(false)}
                disabled={saveMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  saveMutation.isPending || isLocked || Boolean(timezoneError)
                }
              >
                {saveMutation.isPending ? "Saving..." : "Save Policy"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
