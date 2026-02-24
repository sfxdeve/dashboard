import type { ScoringRun } from "~/lib/api/types";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";

export function ScoringRunPanel({ runs }: { runs: ScoringRun[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scoring Runs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {runs.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No scoring runs executed.
          </p>
        ) : (
          runs.map((run) => (
            <div key={run.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Run {run.id}</p>
                <p className="text-muted-foreground text-xs">
                  {new Date(run.finishedAt).toLocaleString()}
                </p>
              </div>
              {run.totalsByUser.map((score) => (
                <div key={`${run.id}-${score.userId}`} className="text-sm">
                  <span className="font-medium">{score.userId}</span>:{" "}
                  {score.totalPoints} pts
                </div>
              ))}
              <Separator />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
