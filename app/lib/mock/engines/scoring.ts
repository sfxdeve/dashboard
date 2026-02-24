import type {
  Match,
  ScoringConfig,
  Tournament,
  UserTournamentTeam,
  UserScoreTotal,
} from "~/lib/api/types";

export function computeWinner(
  match: Pick<Match, "setScores" | "pairAId" | "pairBId">,
) {
  let setsA = 0;
  let setsB = 0;

  for (const set of match.setScores) {
    if (set.pairAScore > set.pairBScore) {
      setsA += 1;
    } else if (set.pairBScore > set.pairAScore) {
      setsB += 1;
    }
  }

  if (setsA === setsB) {
    return undefined;
  }

  return setsA > setsB ? match.pairAId : match.pairBId;
}

export function calculatePlayerPointsByMatch(
  match: Match,
  pairToPlayers: Record<string, string[]>,
  config: ScoringConfig,
) {
  const pointsByPlayer = new Map<string, number>();

  const firstTwoSets = match.setScores.slice(0, 2);
  let pairABase = 0;
  let pairBBase = 0;

  for (const set of firstTwoSets) {
    pairABase += set.pairAScore;
    pairBBase += set.pairBScore;
  }

  const pairAPlayers = pairToPlayers[match.pairAId] ?? [];
  const pairBPlayers = pairToPlayers[match.pairBId] ?? [];

  for (const playerId of pairAPlayers) {
    pointsByPlayer.set(
      playerId,
      (pointsByPlayer.get(playerId) ?? 0) +
        pairABase * config.basePointMultiplier,
    );
  }

  for (const playerId of pairBPlayers) {
    pointsByPlayer.set(
      playerId,
      (pointsByPlayer.get(playerId) ?? 0) +
        pairBBase * config.basePointMultiplier,
    );
  }

  const winnerPairId = match.winnerPairId ?? computeWinner(match);
  if (winnerPairId) {
    const winnerPlayers = pairToPlayers[winnerPairId] ?? [];
    const setsWon = match.setScores.reduce((acc, set) => {
      if (set.pairAScore > set.pairBScore) {
        if (winnerPairId === match.pairAId) {
          acc += 1;
        }
      } else if (set.pairBScore > set.pairAScore) {
        if (winnerPairId === match.pairBId) {
          acc += 1;
        }
      }
      return acc;
    }, 0);

    const bonus =
      setsWon >= 2 && match.setScores.length === 2
        ? config.bonusWin20
        : config.bonusWin21;

    for (const playerId of winnerPlayers) {
      pointsByPlayer.set(playerId, (pointsByPlayer.get(playerId) ?? 0) + bonus);
    }
  }

  return pointsByPlayer;
}

export function computeTournamentTotals(params: {
  tournament: Tournament;
  teams: UserTournamentTeam[];
  matches: Match[];
  pairToPlayers: Record<string, string[]>;
  config: ScoringConfig;
}): UserScoreTotal[] {
  const { tournament, teams, matches, pairToPlayers, config } = params;

  const completedMatches = matches.filter(
    (item) =>
      item.tournamentId === tournament.id &&
      item.status === "completed" &&
      Boolean(item.completedAt),
  );

  const totalByPlayer = new Map<string, number>();
  const playedMatchesByPlayer = new Map<string, number>();

  for (const match of completedMatches) {
    const matchPoints = calculatePlayerPointsByMatch(
      match,
      pairToPlayers,
      config,
    );
    for (const [playerId, points] of matchPoints.entries()) {
      totalByPlayer.set(playerId, (totalByPlayer.get(playerId) ?? 0) + points);
    }

    for (const pairId of [match.pairAId, match.pairBId]) {
      const players = pairToPlayers[pairId] ?? [];
      for (const playerId of players) {
        playedMatchesByPlayer.set(
          playerId,
          (playedMatchesByPlayer.get(playerId) ?? 0) + 1,
        );
      }
    }
  }

  const output: UserScoreTotal[] = [];

  for (const team of teams.filter(
    (item) => item.tournamentId === tournament.id,
  )) {
    const registration = tournament.registrations.find(
      (item) => item.userId === team.userId,
    );
    const registrationTs = registration
      ? new Date(registration.registeredAt).getTime()
      : Number.NEGATIVE_INFINITY;

    const eligibleMatchIds = new Set(
      completedMatches
        .filter((match) => {
          if (!match.completedAt) {
            return false;
          }
          return new Date(match.completedAt).getTime() >= registrationTs;
        })
        .map((match) => match.id),
    );

    const eligiblePlayed = new Map<string, number>();
    for (const match of completedMatches) {
      if (!eligibleMatchIds.has(match.id)) {
        continue;
      }
      for (const pairId of [match.pairAId, match.pairBId]) {
        for (const playerId of pairToPlayers[pairId] ?? []) {
          eligiblePlayed.set(playerId, (eligiblePlayed.get(playerId) ?? 0) + 1);
        }
      }
    }

    const countedPlayers: string[] = [];
    const usedReserves = new Set<string>();

    for (const starter of team.starters) {
      const played = (eligiblePlayed.get(starter) ?? 0) > 0;
      if (played) {
        countedPlayers.push(starter);
        continue;
      }

      const replacement = team.reserves.find(
        (reserve) =>
          !usedReserves.has(reserve) && (eligiblePlayed.get(reserve) ?? 0) > 0,
      );
      if (replacement) {
        usedReserves.add(replacement);
        countedPlayers.push(replacement);
      }
    }

    const totalPoints = countedPlayers.reduce(
      (sum, playerId) => sum + (totalByPlayer.get(playerId) ?? 0),
      0,
    );

    output.push({
      userId: team.userId,
      totalPoints,
      countedPlayers,
    });
  }

  output.sort((a, b) => b.totalPoints - a.totalPoints);
  return output;
}
