import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router";
import { toast } from "sonner";

import { BracketBoard } from "~/components/blocks/bracket-board";
import { PageHeader } from "~/components/blocks/page-header";
import { QueryStateCard } from "~/components/blocks/query-state-card";
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
import { adminApi } from "~/lib/api";
import { queryKeys } from "~/lib/api/query-keys";

export function meta() {
  return [{ title: "Bracket" }];
}

export default function BracketPage() {
  const params = useParams();
  const tournamentId = params.tournamentId as string;
  const queryClient = useQueryClient();
  const [confirmRebuildOpen, setConfirmRebuildOpen] = React.useState(false);

  const bracketQuery = useQuery({
    queryKey: queryKeys.bracket(tournamentId),
    queryFn: () => adminApi.getBracket(tournamentId),
  });

  const rebuildMutation = useMutation({
    mutationFn: () => adminApi.rebuildBracket(tournamentId),
    onSuccess: () => {
      toast.success("Bracket rebuilt");
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bracket(tournamentId),
      });
    },
  });

  if (bracketQuery.isLoading) {
    return (
      <QueryStateCard
        state="loading"
        title="Loading Bracket"
        description="Fetching deterministic bracket structure."
      />
    );
  }

  if (bracketQuery.isError) {
    return (
      <QueryStateCard
        state="error"
        title="Bracket Unavailable"
        description="Bracket data failed to load."
        onRetry={() => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.bracket(tournamentId),
          });
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bracket Engine"
        description="Deterministic bracket view generated from qualification, pools, and main draw results."
        action={
          <Button
            onClick={() => setConfirmRebuildOpen(true)}
            disabled={rebuildMutation.isPending}
          >
            Rebuild Bracket
          </Button>
        }
      />
      {bracketQuery.data && bracketQuery.data.nodes.length > 0 ? (
        <BracketBoard bracket={bracketQuery.data} />
      ) : (
        <QueryStateCard
          state="empty"
          title="Bracket Empty"
          description="No bracket nodes found yet. Insert initial round structure, then complete matches for deterministic progression."
        />
      )}

      <AlertDialog
        open={confirmRebuildOpen}
        onOpenChange={(open) => {
          if (!rebuildMutation.isPending) {
            setConfirmRebuildOpen(open);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rebuild bracket now?</AlertDialogTitle>
            <AlertDialogDescription>
              Bracket nodes will be regenerated from current qualification,
              pools, and main draw progression.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rebuildMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={rebuildMutation.isPending}
              onClick={() => rebuildMutation.mutate()}
            >
              {rebuildMutation.isPending ? "Rebuilding..." : "Rebuild"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
