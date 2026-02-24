import type { Match } from "~/lib/api/types";

const PLACEHOLDER_PAIR_ID = "__TBD__";

export type ProgressionChange = {
  action: "created" | "updated";
  before?: Match;
  after: Match;
};

export type ProgressionResult = {
  matches: Match[];
  changes: ProgressionChange[];
};

export function isPlaceholderPairId(pairId: string) {
  return pairId.trim().length === 0 || pairId === PLACEHOLDER_PAIR_ID;
}

function cloneMatch(match: Match): Match {
  return {
    ...match,
    setScores: match.setScores.map((set) => ({ ...set })),
  };
}

function findMatchIndex(
  matches: Match[],
  lookup: Pick<Match, "tournamentId" | "phase" | "round" | "slot">,
) {
  return matches.findIndex(
    (match) =>
      match.tournamentId === lookup.tournamentId &&
      match.phase === lookup.phase &&
      match.round === lookup.round &&
      match.slot === lookup.slot,
  );
}

function getLoserPairId(match: Match) {
  if (!match.winnerPairId) {
    return undefined;
  }

  if (match.winnerPairId === match.pairAId) {
    return match.pairBId;
  }

  if (match.winnerPairId === match.pairBId) {
    return match.pairAId;
  }

  return undefined;
}

function buildProgressionMatch(params: {
  source: Match;
  round: number;
  slot: number;
  nowIso: string;
  createMatchId: () => string;
}): Match {
  const { source, round, slot, nowIso, createMatchId } = params;
  return {
    id: createMatchId(),
    tournamentId: source.tournamentId,
    phase: source.phase,
    day: source.day,
    round,
    slot,
    status: "scheduled",
    bestOf: 3,
    pairAId: PLACEHOLDER_PAIR_ID,
    pairBId: PLACEHOLDER_PAIR_ID,
    setScores: [],
    scheduledAt: source.completedAt ?? source.scheduledAt ?? nowIso,
  };
}

function upsertProgressionMatch(params: {
  matches: Match[];
  source: Match;
  round: number;
  slot: number;
  pairAId?: string;
  pairBId?: string;
  nowIso: string;
  createMatchId: () => string;
  changes: ProgressionChange[];
}) {
  const {
    matches,
    source,
    round,
    slot,
    pairAId,
    pairBId,
    nowIso,
    createMatchId,
    changes,
  } = params;

  const index = findMatchIndex(matches, {
    tournamentId: source.tournamentId,
    phase: source.phase,
    round,
    slot,
  });

  if (index < 0) {
    const created = buildProgressionMatch({
      source,
      round,
      slot,
      nowIso,
      createMatchId,
    });

    if (pairAId) {
      created.pairAId = pairAId;
    }
    if (pairBId) {
      created.pairBId = pairBId;
    }

    matches.push(created);
    changes.push({ action: "created", after: cloneMatch(created) });
    return;
  }

  const existing = matches[index];
  if (existing.status === "completed") {
    return;
  }

  const next = cloneMatch(existing);
  let changed = false;

  if (pairAId && next.pairAId !== pairAId) {
    next.pairAId = pairAId;
    changed = true;
  }
  if (pairBId && next.pairBId !== pairBId) {
    next.pairBId = pairBId;
    changed = true;
  }

  if (!changed) {
    return;
  }

  matches[index] = next;
  changes.push({
    action: "updated",
    before: cloneMatch(existing),
    after: cloneMatch(next),
  });
}

export function advanceKnockoutWinner(params: {
  matches: Match[];
  completedMatch: Match;
  nowIso: string;
  createMatchId: () => string;
  changes: ProgressionChange[];
}) {
  const { matches, completedMatch, nowIso, createMatchId, changes } = params;

  if (
    !completedMatch.winnerPairId ||
    (completedMatch.phase !== "qualification" &&
      completedMatch.phase !== "main_draw")
  ) {
    return;
  }

  const nextRound = completedMatch.round + 1;
  const nextSlot = Math.ceil(completedMatch.slot / 2);
  const sourceIsOdd = completedMatch.slot % 2 === 1;

  upsertProgressionMatch({
    matches,
    source: completedMatch,
    round: nextRound,
    slot: nextSlot,
    pairAId: sourceIsOdd ? completedMatch.winnerPairId : undefined,
    pairBId: sourceIsOdd ? undefined : completedMatch.winnerPairId,
    nowIso,
    createMatchId,
    changes,
  });
}

export function advancePools(params: {
  matches: Match[];
  completedMatch: Match;
  nowIso: string;
  createMatchId: () => string;
  changes: ProgressionChange[];
}) {
  const { matches, completedMatch, nowIso, createMatchId, changes } = params;

  if (completedMatch.phase !== "pools" || completedMatch.round !== 1) {
    return;
  }

  const poolBaseSlot =
    completedMatch.slot % 2 === 0
      ? completedMatch.slot - 1
      : completedMatch.slot;

  const firstRoundMatches = matches.filter(
    (match) =>
      match.tournamentId === completedMatch.tournamentId &&
      match.phase === "pools" &&
      match.round === 1 &&
      (match.slot === poolBaseSlot || match.slot === poolBaseSlot + 1),
  );

  if (firstRoundMatches.length !== 2) {
    return;
  }

  const ordered = [...firstRoundMatches].sort((a, b) => a.slot - b.slot);
  const first = ordered[0];
  const second = ordered[1];

  if (
    first.status !== "completed" ||
    second.status !== "completed" ||
    !first.winnerPairId ||
    !second.winnerPairId
  ) {
    return;
  }

  const firstLoser = getLoserPairId(first);
  const secondLoser = getLoserPairId(second);

  if (!firstLoser || !secondLoser) {
    return;
  }

  const poolIndex = (poolBaseSlot + 1) / 2;
  const winnersSlot = poolIndex * 2 - 1;
  const losersSlot = winnersSlot + 1;

  upsertProgressionMatch({
    matches,
    source: completedMatch,
    round: 2,
    slot: winnersSlot,
    pairAId: first.winnerPairId,
    pairBId: second.winnerPairId,
    nowIso,
    createMatchId,
    changes,
  });

  upsertProgressionMatch({
    matches,
    source: completedMatch,
    round: 2,
    slot: losersSlot,
    pairAId: firstLoser,
    pairBId: secondLoser,
    nowIso,
    createMatchId,
    changes,
  });
}

export function advanceTournamentProgression(params: {
  matches: Match[];
  completedMatch: Match;
  nowIso: string;
  createMatchId: () => string;
}): ProgressionResult {
  const nextMatches = params.matches.map(cloneMatch);
  const changes: ProgressionChange[] = [];

  advanceKnockoutWinner({
    matches: nextMatches,
    completedMatch: params.completedMatch,
    nowIso: params.nowIso,
    createMatchId: params.createMatchId,
    changes,
  });

  advancePools({
    matches: nextMatches,
    completedMatch: params.completedMatch,
    nowIso: params.nowIso,
    createMatchId: params.createMatchId,
    changes,
  });

  return {
    matches: nextMatches,
    changes,
  };
}
