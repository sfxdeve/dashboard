import type {
  BracketData,
  BracketEdge,
  BracketNode,
  Match,
} from "~/lib/api/types";

function byRoundAndSlot(a: Match, b: Match) {
  if (a.round !== b.round) {
    return a.round - b.round;
  }

  return a.slot - b.slot;
}

export function buildBracketFromMatches(
  tournamentId: string,
  matches: Match[],
): BracketData {
  const tournamentMatches = matches
    .filter((item) => item.tournamentId === tournamentId)
    .sort(byRoundAndSlot);

  const nodes: BracketNode[] = tournamentMatches.map((match) => ({
    id: `node_${match.id}`,
    tournamentId,
    phase: match.phase,
    round: match.round,
    slot: match.slot,
    matchId: match.id,
    label: `${match.phase} R${match.round} · M${match.slot}`,
    pairAId: match.pairAId,
    pairBId: match.pairBId,
    winnerPairId: match.winnerPairId,
  }));

  const edges: BracketEdge[] = [];
  const nodesByPhase = new Map<Match["phase"], BracketNode[]>();

  for (const node of nodes) {
    const phaseNodes = nodesByPhase.get(node.phase) ?? [];
    phaseNodes.push(node);
    nodesByPhase.set(node.phase, phaseNodes);
  }

  for (const phaseNodes of nodesByPhase.values()) {
    const nodeByRound = new Map<number, BracketNode[]>();

    for (const node of phaseNodes) {
      const existing = nodeByRound.get(node.round) ?? [];
      existing.push(node);
      nodeByRound.set(node.round, existing);
    }

    const rounds = Array.from(nodeByRound.keys()).sort((a, b) => a - b);
    for (let index = 0; index < rounds.length - 1; index += 1) {
      const fromNodes = (nodeByRound.get(rounds[index]) ?? []).sort(
        (a, b) => a.slot - b.slot,
      );
      const toNodes = (nodeByRound.get(rounds[index + 1]) ?? []).sort(
        (a, b) => a.slot - b.slot,
      );

      for (let fromIndex = 0; fromIndex < fromNodes.length; fromIndex += 1) {
        const target = toNodes[Math.floor(fromIndex / 2)];
        if (!target) {
          continue;
        }

        edges.push({
          id: `edge_${fromNodes[fromIndex].id}_${target.id}`,
          fromNodeId: fromNodes[fromIndex].id,
          toNodeId: target.id,
          outcome: "winner",
        });
      }
    }
  }

  return {
    tournamentId,
    nodes,
    edges,
    updatedAt: new Date().toISOString(),
  };
}
