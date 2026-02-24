import type { BracketData } from "~/lib/api/types";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export function BracketBoard({ bracket }: { bracket: BracketData }) {
  const rounds = Array.from(
    new Set(bracket.nodes.map((node) => node.round)),
  ).sort((a, b) => a - b);
  const renderPair = (pairId?: string) =>
    pairId && pairId !== "__TBD__" ? pairId : "TBD";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {rounds.map((round) => {
        const nodes = bracket.nodes
          .filter((item) => item.round === round)
          .sort((a, b) => a.slot - b.slot);

        return (
          <Card key={round}>
            <CardHeader>
              <CardTitle>Round {round}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {nodes.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No matches in this round.
                </p>
              ) : (
                nodes.map((node) => (
                  <div key={node.id} className="rounded-md border p-3">
                    <p className="text-xs font-medium uppercase">
                      {node.phase}
                    </p>
                    <p className="mt-1 text-sm">Slot {node.slot}</p>
                    <p className="text-muted-foreground text-xs">
                      A: {renderPair(node.pairAId)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      B: {renderPair(node.pairBId)}
                    </p>
                    <p className="mt-1 text-xs">
                      Winner: {renderPair(node.winnerPairId)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
