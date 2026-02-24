import type { AdminApi } from "~/lib/api/contracts";
import { ApiError } from "~/lib/api/client";
import { getSessionToken } from "~/lib/auth/session";
import { buildBracketFromMatches } from "~/lib/mock/engines/bracket";
import {
  computeTournamentTotals,
  computeWinner,
} from "~/lib/mock/engines/scoring";
import {
  advanceTournamentProgression,
  isPlaceholderPairId,
} from "~/lib/mock/engines/progression";
import {
  getMockState,
  nextId,
  updateMockState,
  withLatency,
} from "~/lib/mock/store";
import type {
  AuditLog,
  BracketData,
  CompleteMatchInput,
  CreateLeagueInput,
  CreateMatchInput,
  CreateNotificationCampaignInput,
  CreateSeasonInput,
  CreateTournamentInput,
  CreateWalletPackInput,
  DayBucket,
  EntryListItem,
  League,
  LeaderboardRow,
  LoginInput,
  Match,
  NotificationCampaign,
  Paginated,
  PaginationParams,
  PaymentEvent,
  ScoringConfig,
  ScoringRun,
  Season,
  Tournament,
  TournamentFilters,
  UpdateLeagueInput,
  UpdateMatchInput,
  UpdateScoringConfigInput,
  UpdateSeasonInput,
  UpdateTournamentInput,
  UpdateWalletPackInput,
  WalletPack,
  WalletTransaction,
} from "~/lib/api/types";
import type { MockState } from "~/lib/mock/seed";

function notFound(entity: string) {
  return new ApiError(`${entity} not found`, "NOT_FOUND");
}

function unauthorized() {
  return new ApiError("Unauthorized", "UNAUTHORIZED");
}

function badRequest(
  message: string,
  details?: Record<string, unknown>,
  code = "BAD_REQUEST",
) {
  return new ApiError(message, code, details);
}

function paginate<T>(items: T[], params?: PaginationParams): Paginated<T> {
  const page = Math.max(1, params?.page ?? 1);
  const pageSize = Math.max(1, params?.pageSize ?? 20);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: items.slice(start, end),
    page,
    pageSize,
    total: items.length,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function cloneAuditPayload<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function isTournamentLockTimePassed(
  tournament: Tournament,
  referenceTs = Date.now(),
) {
  if (!Number.isFinite(Date.parse(tournament.policy.lineupLockAt))) {
    return false;
  }

  return Date.parse(tournament.policy.lineupLockAt) <= referenceTs;
}

function resolveTimeZone(timeZone: string) {
  if (!timeZone.trim()) {
    return "UTC";
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
  }
}

function getZonedDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return "1970-01-01";
  }

  return `${year}-${month}-${day}`;
}

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  const utcDate = new Date(Date.UTC(year, month - 1, day + days));
  return utcDate.toISOString().slice(0, 10);
}

const MATCH_DAY_OFFSET: Record<DayBucket, number> = {
  friday: 1,
  saturday: 2,
  sunday: 3,
};

function assertEntryListFinalizationWindow(
  tournament: Tournament,
  referenceTs = Date.now(),
) {
  const lockTs = Date.parse(tournament.policy.lineupLockAt);
  if (!Number.isFinite(lockTs)) {
    throw badRequest(
      "Entry List lock timestamp is invalid",
      {
        tournamentId: tournament.id,
        lineupLockAt: tournament.policy.lineupLockAt,
      },
      "ENTRY_LIST_LOCK_INVALID",
    );
  }

  if (referenceTs < lockTs) {
    throw badRequest(
      "Entry List cannot be finalized before the configured lock time",
      {
        lineupLockAt: tournament.policy.lineupLockAt,
        timezone: tournament.policy.timezone,
      },
      "ENTRY_LIST_NOT_FINAL",
    );
  }
}

function assertMatchInsertionCadence(
  tournament: Tournament,
  input: Pick<CreateMatchInput, "day" | "scheduledAt">,
  referenceDate = new Date(),
) {
  const lockAt = new Date(tournament.policy.lineupLockAt);
  const scheduledAt = new Date(input.scheduledAt);
  if (!Number.isFinite(lockAt.getTime())) {
    throw badRequest(
      "Lineup lock timestamp is invalid",
      { lineupLockAt: tournament.policy.lineupLockAt },
      "SCHEDULE_WINDOW_VIOLATION",
    );
  }
  if (!Number.isFinite(scheduledAt.getTime())) {
    throw badRequest(
      "Scheduled timestamp is invalid",
      { scheduledAt: input.scheduledAt },
      "SCHEDULE_WINDOW_VIOLATION",
    );
  }

  const dayOffset = MATCH_DAY_OFFSET[input.day];
  const lockDateKey = getZonedDateKey(lockAt, tournament.policy.timezone);
  const expectedMatchDateKey = addDaysToDateKey(lockDateKey, dayOffset);
  const scheduledDateKey = getZonedDateKey(
    scheduledAt,
    tournament.policy.timezone,
  );

  if (scheduledDateKey !== expectedMatchDateKey) {
    throw badRequest(
      "Scheduled date does not match the required tournament day bucket",
      {
        day: input.day,
        expectedDate: expectedMatchDateKey,
        scheduledDate: scheduledDateKey,
        timezone: resolveTimeZone(tournament.policy.timezone),
      },
      "SCHEDULE_WINDOW_VIOLATION",
    );
  }

  const windowStartKey = addDaysToDateKey(lockDateKey, dayOffset - 1);
  const windowEndKey = expectedMatchDateKey;
  const nowDateKey = getZonedDateKey(referenceDate, tournament.policy.timezone);

  if (nowDateKey < windowStartKey || nowDateKey > windowEndKey) {
    throw badRequest(
      "Match creation is outside the allowed schedule window for this day",
      {
        day: input.day,
        windowStartDate: windowStartKey,
        windowEndDate: windowEndKey,
        todayDate: nowDateKey,
        timezone: resolveTimeZone(tournament.policy.timezone),
      },
      "SCHEDULE_WINDOW_VIOLATION",
    );
  }
}

function syncLineupLocks(state: MockState) {
  const nowTs = Date.now();
  state.tournaments = state.tournaments.map((tournament) => {
    if (!isTournamentLockTimePassed(tournament, nowTs)) {
      return tournament;
    }

    if (tournament.lineupLocked && tournament.entryListLocked) {
      return tournament;
    }

    return {
      ...tournament,
      lineupLocked: true,
      entryListLocked: true,
      updatedAt: nowIso(),
    };
  });
}

function validateTournamentPolicy(policy: Tournament["policy"]) {
  if (policy.rosterSize < 1) {
    throw badRequest("Roster size must be at least 1");
  }
  if (policy.starterCount < 1) {
    throw badRequest("Starter count must be at least 1");
  }
  if (policy.reserveCount < 0) {
    throw badRequest("Reserve count must be 0 or greater");
  }
  if (policy.starterCount + policy.reserveCount > policy.rosterSize) {
    throw badRequest("Starter and reserve counts cannot exceed roster size", {
      rosterSize: policy.rosterSize,
      starterCount: policy.starterCount,
      reserveCount: policy.reserveCount,
    });
  }
  if (!policy.timezone.trim()) {
    throw badRequest("Time zone is required");
  }
  if (!Number.isFinite(Date.parse(policy.lineupLockAt))) {
    throw badRequest("Lineup lock timestamp is invalid");
  }
}

function normalizeEntryList(items: EntryListItem[]) {
  const next = items.map((item) => ({
    ...item,
    pair: {
      ...item.pair,
    },
  }));

  for (const item of next) {
    item.pair.status = item.entryStatus;
    if (item.entryStatus !== "reserve") {
      item.reserveOrder = undefined;
    }
  }

  const reserves = next
    .filter((item) => item.entryStatus === "reserve")
    .sort((a, b) => {
      const aOrder = a.reserveOrder ?? Number.POSITIVE_INFINITY;
      const bOrder = b.reserveOrder ?? Number.POSITIVE_INFINITY;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return b.ranking - a.ranking;
    });

  reserves.forEach((item, index) => {
    item.reserveOrder = index + 1;
  });

  return next;
}

function getCurrentUserId(state: MockState): string {
  const token = getSessionToken();
  if (!token) {
    throw unauthorized();
  }

  const session = state.sessions.find((item) => item.token === token);
  if (!session) {
    throw unauthorized();
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    throw unauthorized();
  }

  return session.user.id;
}

function writeAudit(
  state: MockState,
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  before?: unknown,
  after?: unknown,
) {
  const log: AuditLog = {
    id: nextId("audit"),
    actorUserId,
    action,
    entityType,
    entityId,
    before: cloneAuditPayload(before),
    after: cloneAuditPayload(after),
    timestamp: nowIso(),
  };

  state.auditLogs.unshift(log);
}

function recomputeLeagueRows(
  state: MockState,
  league: League,
): LeaderboardRow[] {
  const seasonTournamentIds = state.tournaments
    .filter((item) => item.seasonId === league.seasonId)
    .map((item) => item.id);

  const latestRunByTournament = new Map<string, ScoringRun>();
  for (const tournamentId of seasonTournamentIds) {
    const runs = state.scoringRuns[tournamentId] ?? [];
    if (runs.length > 0) {
      latestRunByTournament.set(tournamentId, runs[0]);
    }
  }

  const totals = new Map<string, number>();
  for (const run of latestRunByTournament.values()) {
    for (const result of run.totalsByUser) {
      totals.set(
        result.userId,
        (totals.get(result.userId) ?? 0) + result.totalPoints,
      );
    }
  }

  const rows = Array.from(totals.entries()).map(([userId, total]) => {
    const user = state.users.find((item) => item.id === userId);
    return {
      id: nextId("lb"),
      leagueId: league.id,
      userId,
      displayName: user?.displayName ?? userId,
      rank: 0,
      totalPoints: total,
      tieBreakerScore: total % 17,
      lastUpdated: nowIso(),
    } satisfies LeaderboardRow;
  });

  rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }

    return b.tieBreakerScore - a.tieBreakerScore;
  });

  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

function assertTournamentGenderIntegrity(
  state: MockState,
  tournamentId: string,
  entries: EntryListItem[],
) {
  const tournament = state.tournaments.find((item) => item.id === tournamentId);
  if (!tournament) {
    throw notFound("Tournament");
  }

  for (const entry of entries) {
    if (
      entry.tournamentId !== tournamentId ||
      entry.pair.tournamentId !== tournamentId
    ) {
      throw badRequest("Entry item must belong to the target tournament", {
        entryId: entry.id,
      });
    }

    const players = entry.pair.playerIds.map((playerId) =>
      state.players.find((player) => player.id === playerId),
    );

    if (players.some((item) => !item)) {
      throw badRequest("Entry List contains an unknown player");
    }

    if (players.some((item) => item && item.gender !== tournament.gender)) {
      throw badRequest("Gender separation rule violation", {
        tournamentGender: tournament.gender,
        pairId: entry.pair.id,
      });
    }
  }
}

function getPairToPlayers(state: MockState, tournamentId: string) {
  const map: Record<string, string[]> = {};
  for (const item of state.entryLists[tournamentId] ?? []) {
    map[item.pair.id] = item.pair.playerIds;
  }
  return map;
}

export class MockAdminApi implements AdminApi {
  async login(input: LoginInput) {
    const valid =
      (input.email === "admin@fantabeach.io" ||
        input.email === "ops@fantabeach.io") &&
      input.password === "admin123";

    if (!valid) {
      throw unauthorized();
    }

    const state = updateMockState((current) => {
      const user = current.users.find((item) => item.email === input.email);
      if (!user) {
        throw unauthorized();
      }

      const session = {
        token: nextId("token"),
        user,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(),
      };

      current.sessions = current.sessions.filter(
        (item) => item.user.id !== user.id,
      );
      current.sessions.push(session);
      writeAudit(
        current,
        user.id,
        "auth.login",
        "session",
        session.token,
        undefined,
        session,
      );
      return current;
    });

    const createdSession = state.sessions[state.sessions.length - 1];
    return withLatency(createdSession);
  }

  async me() {
    const state = getMockState();
    const token = getSessionToken();
    if (!token) {
      throw unauthorized();
    }

    const session = state.sessions.find((item) => item.token === token);
    if (!session) {
      throw unauthorized();
    }

    return withLatency(session.user);
  }

  async logout() {
    updateMockState((state) => {
      const token = getSessionToken();
      if (!token) {
        return state;
      }

      const session = state.sessions.find((item) => item.token === token);
      state.sessions = state.sessions.filter((item) => item.token !== token);
      if (session) {
        writeAudit(
          state,
          session.user.id,
          "auth.logout",
          "session",
          token,
          session,
          undefined,
        );
      }
      return state;
    });

    return withLatency(undefined);
  }

  async getSeasons() {
    const state = getMockState();
    getCurrentUserId(state);
    return withLatency([...state.seasons].sort((a, b) => b.year - a.year));
  }

  async createSeason(input: CreateSeasonInput) {
    const state = updateMockState((current) => {
      const actor = getCurrentUserId(current);
      const created: Season = {
        id: nextId("season"),
        year: input.year,
        name: input.name,
        status: "upcoming",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

      current.seasons.unshift(created);
      writeAudit(
        current,
        actor,
        "season.create",
        "season",
        created.id,
        undefined,
        created,
      );
      return current;
    });

    return withLatency(state.seasons[0]);
  }

  async updateSeason(seasonId: string, input: UpdateSeasonInput) {
    let updated: Season | undefined;
    updateMockState((current) => {
      const actor = getCurrentUserId(current);
      const index = current.seasons.findIndex((item) => item.id === seasonId);
      if (index < 0) {
        throw notFound("Season");
      }

      const before = current.seasons[index];
      updated = {
        ...before,
        ...input,
        updatedAt: nowIso(),
      };

      current.seasons[index] = updated;
      writeAudit(
        current,
        actor,
        "season.update",
        "season",
        seasonId,
        before,
        updated,
      );
      return current;
    });

    if (!updated) {
      throw notFound("Season");
    }

    return withLatency(updated);
  }

  async getTournaments(filters?: TournamentFilters) {
    const state = updateMockState((current) => {
      syncLineupLocks(current);
      return current;
    });
    getCurrentUserId(state);

    let items = [...state.tournaments];
    if (filters?.seasonId) {
      items = items.filter((item) => item.seasonId === filters.seasonId);
    }
    if (filters?.status) {
      items = items.filter((item) => item.status === filters.status);
    }
    if (filters?.gender) {
      items = items.filter((item) => item.gender === filters.gender);
    }

    items.sort((a, b) => (a.startDate > b.startDate ? -1 : 1));
    return withLatency(items);
  }

  async createTournament(input: CreateTournamentInput) {
    const state = updateMockState((current) => {
      const actor = getCurrentUserId(current);
      syncLineupLocks(current);
      const seasonExists = current.seasons.some(
        (season) => season.id === input.seasonId,
      );
      if (!seasonExists) {
        throw badRequest("Season does not exist", { seasonId: input.seasonId });
      }
      validateTournamentPolicy(input.policy);

      const created: Tournament = {
        id: nextId("tournament"),
        seasonId: input.seasonId,
        name: input.name,
        slug: input.slug,
        location: input.location,
        gender: input.gender,
        isPublic: input.isPublic,
        status: "draft",
        startDate: input.startDate,
        endDate: input.endDate,
        policy: input.policy,
        entryListLocked: false,
        lineupLocked: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        registrations: [],
      };

      current.tournaments.unshift(created);
      current.entryLists[created.id] = [];
      current.scoringConfigs[created.id] = {
        tournamentId: created.id,
        basePointMultiplier: 1,
        bonusWin20: 6,
        bonusWin21: 3,
        updatedAt: nowIso(),
      };
      current.scoringRuns[created.id] = [];
      writeAudit(
        current,
        actor,
        "tournament.create",
        "tournament",
        created.id,
        undefined,
        created,
      );
      return current;
    });

    return withLatency(state.tournaments[0]);
  }

  async getTournament(tournamentId: string) {
    const state = updateMockState((current) => {
      syncLineupLocks(current);
      return current;
    });
    getCurrentUserId(state);
    const tournament = state.tournaments.find(
      (item) => item.id === tournamentId,
    );
    if (!tournament) {
      throw notFound("Tournament");
    }

    return withLatency(tournament);
  }

  async updateTournament(tournamentId: string, input: UpdateTournamentInput) {
    let updated: Tournament | undefined;
    updateMockState((current) => {
      const actor = getCurrentUserId(current);
      syncLineupLocks(current);
      const index = current.tournaments.findIndex(
        (item) => item.id === tournamentId,
      );
      if (index < 0) {
        throw notFound("Tournament");
      }

      const before = current.tournaments[index];
      if (isTournamentLockTimePassed(before) && input.policy) {
        throw badRequest("Lineup policy is immutable after lock");
      }

      const nextPolicy = input.policy
        ? { ...before.policy, ...input.policy }
        : before.policy;
      validateTournamentPolicy(nextPolicy);
      updated = {
        ...before,
        ...input,
        policy: nextPolicy,
        updatedAt: nowIso(),
      };

      current.tournaments[index] = updated;
      writeAudit(
        current,
        actor,
        "tournament.update",
        "tournament",
        tournamentId,
        before,
        updated,
      );
      return current;
    });

    if (!updated) {
      throw notFound("Tournament");
    }

    return withLatency(updated);
  }

  async lockEntryList(tournamentId: string) {
    let updated: Tournament | undefined;
    updateMockState((current) => {
      const actor = getCurrentUserId(current);
      syncLineupLocks(current);
      const index = current.tournaments.findIndex(
        (item) => item.id === tournamentId,
      );
      if (index < 0) {
        throw notFound("Tournament");
      }

      const before = current.tournaments[index];
      assertEntryListFinalizationWindow(before);
      updated = {
        ...before,
        entryListLocked: true,
        status: before.status === "draft" ? "entry_locked" : before.status,
        updatedAt: nowIso(),
      };

      current.tournaments[index] = updated;
      writeAudit(
        current,
        actor,
        "tournament.entry_list.lock",
        "tournament",
        tournamentId,
        before,
        updated,
      );
      return current;
    });

    if (!updated) {
      throw notFound("Tournament");
    }

    return withLatency(updated);
  }

  async regenerateBracket(tournamentId: string) {
    const state = updateMockState((current) => {
      const actor = getCurrentUserId(current);
      syncLineupLocks(current);
      const tournament = current.tournaments.find(
        (item) => item.id === tournamentId,
      );
      if (!tournament) {
        throw notFound("Tournament");
      }

      const nextBracket = buildBracketFromMatches(
        tournamentId,
        current.matches,
      );
      current.brackets[tournamentId] = nextBracket;
      writeAudit(
        current,
        actor,
        "tournament.bracket.regenerate",
        "tournament",
        tournamentId,
        undefined,
        nextBracket,
      );
      return current;
    });

    const bracket = state.brackets[tournamentId];
    if (!bracket) {
      throw notFound("Bracket");
    }

    return withLatency(bracket);
  }

  async getEntryList(tournamentId: string) {
    const state = updateMockState((current) => {
      syncLineupLocks(current);
      return current;
    });
    getCurrentUserId(state);
    return withLatency([...(state.entryLists[tournamentId] ?? [])]);
  }

  async replaceEntryList(tournamentId: string, items: EntryListItem[]) {
    const state = updateMockState((current) => {
      const actor = getCurrentUserId(current);
      syncLineupLocks(current);
      const tournament = current.tournaments.find(
        (item) => item.id === tournamentId,
      );
      if (!tournament) {
        throw notFound("Tournament");
      }

      if (tournament.entryListLocked) {
        throw badRequest("Entry List is locked");
      }

      const normalized = normalizeEntryList(items);
      assertTournamentGenderIntegrity(current, tournamentId, normalized);
      const before = current.entryLists[tournamentId] ?? [];
      current.entryLists[tournamentId] = normalized;
      writeAudit(
        current,
        actor,
        "entry_list.replace",
        "entry_list",
        tournamentId,
        before,
        normalized,
      );
      return current;
    });

    return withLatency(state.entryLists[tournamentId] ?? []);
  }

  async updateEntryListItem(
    tournamentId: string,
    itemId: string,
    input: Partial<EntryListItem>,
  ) {
    let updated: EntryListItem | undefined;
    updateMockState((current) => {
      const actor = getCurrentUserId(current);
      syncLineupLocks(current);
      const tournament = current.tournaments.find(
        (item) => item.id === tournamentId,
      );
      if (!tournament) {
        throw notFound("Tournament");
      }

      if (tournament.entryListLocked) {
        throw badRequest("Entry List is locked");
      }

      const list = current.entryLists[tournamentId] ?? [];
      const index = list.findIndex((item) => item.id === itemId);
      if (index < 0) {
        throw notFound("Entry List item");
      }

      const before = list[index];
      const targetReserveOrder =
        input.entryStatus === "reserve" && input.reserveOrder === undefined
          ? list.filter((item) => item.entryStatus === "reserve").length + 1
          : input.reserveOrder;

      updated = {
        ...before,
        ...input,
        reserveOrder: targetReserveOrder,
      };
      list[index] = updated;
      const normalized = normalizeEntryList(list);
      assertTournamentGenderIntegrity(current, tournamentId, normalized);
      current.entryLists[tournamentId] = normalized;
      writeAudit(
        current,
        actor,
        "entry_list.update",
        "entry_list_item",
        itemId,
        before,
        updated,
      );
      return current;
    });

    if (!updated) {
      throw notFound("Entry List item");
    }

    return withLatency(updated);
  }

  async getMatches(tournamentId: string) {
    const state = updateMockState((current) => {
      syncLineupLocks(current);
      return current;
    });
    getCurrentUserId(state);
    return withLatency(
      state.matches.filter((item) => item.tournamentId === tournamentId),
    );
  }

  async createMatch(tournamentId: string, input: CreateMatchInput) {
    const state = updateMockState((current) => {
      const actor = getCurrentUserId(current);
      syncLineupLocks(current);
      const tournament = current.tournaments.find(
        (item) => item.id === tournamentId,
      );
      if (!tournament) {
        throw notFound("Tournament");
      }

      const entryList = current.entryLists[tournamentId] ?? [];
      const pairIds = new Set(entryList.map((item) => item.pair.id));
      if (!pairIds.has(input.pairAId) || !pairIds.has(input.pairBId)) {
        throw badRequest("Match references unknown pair");
      }
      assertMatchInsertionCadence(tournament, input);

      const created: Match = {
        id: nextId("match"),
        tournamentId,
        phase: input.phase,
        day: input.day,
        round: input.round,
        slot: input.slot,
        status: "scheduled",
        bestOf: 3,
        pairAId: input.pairAId,
        pairBId: input.pairBId,
        setScores: [],
        scheduledAt: input.scheduledAt,
      };

      current.matches.unshift(created);
      writeAudit(
        current,
        actor,
        "match.create",
        "match",
        created.id,
        undefined,
        created,
      );
      return current;
    });

    return withLatency(state.matches[0]);
  }

  async updateMatch(matchId: string, input: UpdateMatchInput) {
    let updated: Match | undefined;
    updateMockState((current) => {
      const actor = getCurrentUserId(current);
      syncLineupLocks(current);
      const index = current.matches.findIndex((item) => item.id === matchId);
      if (index < 0) {
        throw notFound("Match");
      }

      const before = current.matches[index];
      const tournament = current.tournaments.find(
        (item) => item.id === before.tournamentId,
      );
      if (!tournament) {
        throw notFound("Tournament");
      }

      if (
        isTournamentLockTimePassed(tournament) &&
        before.status === "completed"
      ) {
        throw badRequest("Lineup is locked and completed match is immutable");
      }

      updated = {
        ...before,
        ...input,
      };
      current.matches[index] = updated;
      writeAudit(
        current,
        actor,
        "match.update",
        "match",
        matchId,
        before,
        updated,
      );
      return current;
    });

    if (!updated) {
      throw notFound("Match");
    }

    return withLatency(updated);
  }

  async completeMatch(matchId: string, input: CompleteMatchInput) {
    let completed: Match | undefined;
    updateMockState((current) => {
      const actor = getCurrentUserId(current);
      syncLineupLocks(current);
      const index = current.matches.findIndex((item) => item.id === matchId);
      if (index < 0) {
        throw notFound("Match");
      }

      const before = current.matches[index];
      if (
        isPlaceholderPairId(before.pairAId) ||
        isPlaceholderPairId(before.pairBId)
      ) {
        throw badRequest("Match pairings are incomplete");
      }

      const winnerPairId = computeWinner({
        pairAId: before.pairAId,
        pairBId: before.pairBId,
        setScores: input.setScores,
      });

      if (!winnerPairId) {
        throw badRequest("Cannot complete match without a winner");
      }

      completed = {
        ...before,
        setScores: input.setScores,
        winnerPairId,
        status: "completed",
        completedAt: nowIso(),
      };

      current.matches[index] = completed;
      const progressionResult = advanceTournamentProgression({
        matches: current.matches,
        completedMatch: completed,
        nowIso: nowIso(),
        createMatchId: () => nextId("match"),
      });
      current.matches = progressionResult.matches;
      for (const change of progressionResult.changes) {
        writeAudit(
          current,
          actor,
          `match.progression.${change.action}`,
          "match",
          change.after.id,
          change.before,
          change.after,
        );
      }
      current.brackets[completed.tournamentId] = buildBracketFromMatches(
        completed.tournamentId,
        current.matches,
      );

      writeAudit(
        current,
        actor,
        "match.complete",
        "match",
        matchId,
        before,
        completed,
      );
      return current;
    });

    if (!completed) {
      throw notFound("Match");
    }

    return withLatency(completed);
  }

  async getBracket(tournamentId: string) {
    const state = updateMockState((current) => {
      syncLineupLocks(current);
      return current;
    });
    getCurrentUserId(state);
    const bracket =
      state.brackets[tournamentId] ??
      buildBracketFromMatches(tournamentId, state.matches);
    return withLatency(bracket);
  }

  async rebuildBracket(tournamentId: string) {
    return this.regenerateBracket(tournamentId);
  }

  async getScoringConfig(tournamentId: string) {
    const state = getMockState();
    getCurrentUserId(state);
    const config = state.scoringConfigs[tournamentId];
    if (!config) {
      throw notFound("Scoring config");
    }

    return withLatency(config);
  }

  async updateScoringConfig(
    tournamentId: string,
    input: UpdateScoringConfigInput,
  ) {
    let updated: ScoringConfig | undefined;
    updateMockState((current) => {
      const actor = getCurrentUserId(current);
      syncLineupLocks(current);
      const before = current.scoringConfigs[tournamentId];
      if (!before) {
        throw notFound("Scoring config");
      }

      updated = {
        ...before,
        ...input,
        updatedAt: nowIso(),
      };

      current.scoringConfigs[tournamentId] = updated;
      writeAudit(
        current,
        actor,
        "scoring.config.update",
        "scoring_config",
        tournamentId,
        before,
        updated,
      );
      return current;
    });

    if (!updated) {
      throw notFound("Scoring config");
    }

    return withLatency(updated);
  }

  async recalculateScoring(tournamentId: string) {
    let run: ScoringRun | undefined;

    updateMockState((current) => {
      const actor = getCurrentUserId(current);
      syncLineupLocks(current);
      const tournament = current.tournaments.find(
        (item) => item.id === tournamentId,
      );
      if (!tournament) {
        throw notFound("Tournament");
      }

      const config = current.scoringConfigs[tournamentId];
      if (!config) {
        throw notFound("Scoring config");
      }

      const pairToPlayers = getPairToPlayers(current, tournamentId);
      const totalsByUser = computeTournamentTotals({
        tournament,
        teams: current.teams,
        matches: current.matches,
        pairToPlayers,
        config,
      });

      run = {
        id: nextId("run"),
        tournamentId,
        status: "completed",
        triggeredBy: actor,
        startedAt: nowIso(),
        finishedAt: nowIso(),
        totalsByUser,
      };

      current.scoringRuns[tournamentId] = [
        run,
        ...(current.scoringRuns[tournamentId] ?? []),
      ];

      const affectedLeagues = current.leagues.filter(
        (item) => item.seasonId === tournament.seasonId,
      );
      for (const league of affectedLeagues) {
        current.leaderboards[league.id] = recomputeLeagueRows(current, league);
      }

      writeAudit(
        current,
        actor,
        "scoring.recalculate",
        "tournament",
        tournamentId,
        undefined,
        run,
      );
      return current;
    });

    if (!run) {
      throw badRequest("Could not run recalculation");
    }

    return withLatency(run);
  }

  async getScoringRuns(tournamentId: string) {
    const state = getMockState();
    getCurrentUserId(state);
    return withLatency(state.scoringRuns[tournamentId] ?? []);
  }

  async getLeagues() {
    const state = updateMockState((current) => {
      syncLineupLocks(current);
      return current;
    });
    getCurrentUserId(state);
    return withLatency(state.leagues);
  }

  async createLeague(input: CreateLeagueInput) {
    const state = updateMockState((current) => {
      const actor = getCurrentUserId(current);
      syncLineupLocks(current);
      const created: League = {
        id: nextId("league"),
        seasonId: input.seasonId,
        name: input.name,
        mode: input.mode,
        status: "active",
        tieBreakers: ["highest_player_score", "match_dominance"],
        updatedAt: nowIso(),
      };

      current.leagues.unshift(created);
      current.leaderboards[created.id] = recomputeLeagueRows(current, created);
      writeAudit(
        current,
        actor,
        "league.create",
        "league",
        created.id,
        undefined,
        created,
      );
      return current;
    });

    return withLatency(state.leagues[0]);
  }

  async updateLeague(leagueId: string, input: UpdateLeagueInput) {
    let updated: League | undefined;
    updateMockState((current) => {
      const actor = getCurrentUserId(current);
      syncLineupLocks(current);
      const index = current.leagues.findIndex((item) => item.id === leagueId);
      if (index < 0) {
        throw notFound("League");
      }

      const before = current.leagues[index];
      updated = {
        ...before,
        ...input,
        updatedAt: nowIso(),
      };

      current.leagues[index] = updated;
      writeAudit(
        current,
        actor,
        "league.update",
        "league",
        leagueId,
        before,
        updated,
      );
      return current;
    });

    if (!updated) {
      throw notFound("League");
    }

    return withLatency(updated);
  }

  async getLeagueLeaderboard(leagueId: string) {
    const state = updateMockState((current) => {
      syncLineupLocks(current);
      return current;
    });
    getCurrentUserId(state);
    return withLatency(state.leaderboards[leagueId] ?? []);
  }

  async recomputeLeague(leagueId: string) {
    const state = updateMockState((current) => {
      const actor = getCurrentUserId(current);
      syncLineupLocks(current);
      const league = current.leagues.find((item) => item.id === leagueId);
      if (!league) {
        throw notFound("League");
      }

      current.leaderboards[leagueId] = recomputeLeagueRows(current, league);
      writeAudit(
        current,
        actor,
        "league.recompute",
        "league",
        leagueId,
        undefined,
        current.leaderboards[leagueId],
      );
      return current;
    });

    return withLatency(state.leaderboards[leagueId] ?? []);
  }

  async getWalletPacks() {
    const state = updateMockState((current) => {
      syncLineupLocks(current);
      return current;
    });
    getCurrentUserId(state);
    return withLatency(state.walletPacks);
  }

  async createWalletPack(input: CreateWalletPackInput) {
    const state = updateMockState((current) => {
      const actor = getCurrentUserId(current);
      syncLineupLocks(current);
      const created: WalletPack = {
        id: nextId("pack"),
        ...input,
        active: true,
      };
      current.walletPacks.unshift(created);
      writeAudit(
        current,
        actor,
        "wallet.pack.create",
        "wallet_pack",
        created.id,
        undefined,
        created,
      );
      return current;
    });

    return withLatency(state.walletPacks[0]);
  }

  async updateWalletPack(packId: string, input: UpdateWalletPackInput) {
    let updated: WalletPack | undefined;
    updateMockState((current) => {
      const actor = getCurrentUserId(current);
      syncLineupLocks(current);
      const index = current.walletPacks.findIndex((item) => item.id === packId);
      if (index < 0) {
        throw notFound("Wallet pack");
      }

      const before = current.walletPacks[index];
      updated = {
        ...before,
        ...input,
      };
      current.walletPacks[index] = updated;
      writeAudit(
        current,
        actor,
        "wallet.pack.update",
        "wallet_pack",
        packId,
        before,
        updated,
      );
      return current;
    });

    if (!updated) {
      throw notFound("Wallet pack");
    }

    return withLatency(updated);
  }

  async getWalletTransactions(params?: PaginationParams) {
    const state = updateMockState((current) => {
      syncLineupLocks(current);
      return current;
    });
    getCurrentUserId(state);
    return withLatency(paginate(state.walletTransactions, params));
  }

  async getPaymentEvents(params?: PaginationParams) {
    const state = updateMockState((current) => {
      syncLineupLocks(current);
      return current;
    });
    getCurrentUserId(state);
    return withLatency(paginate(state.paymentEvents, params));
  }

  async reverifyPaymentEvent(eventId: string) {
    let updated: PaymentEvent | undefined;
    updateMockState((current) => {
      const actor = getCurrentUserId(current);
      syncLineupLocks(current);
      const index = current.paymentEvents.findIndex(
        (item) => item.id === eventId,
      );
      if (index < 0) {
        throw notFound("Payment event");
      }

      const before = current.paymentEvents[index];
      updated = {
        ...before,
        status: "verified",
        verifiedAt: nowIso(),
      };

      current.paymentEvents[index] = updated;
      writeAudit(
        current,
        actor,
        "payment.reverify",
        "payment_event",
        eventId,
        before,
        updated,
      );
      return current;
    });

    if (!updated) {
      throw notFound("Payment event");
    }

    return withLatency(updated);
  }

  async getNotificationCampaigns() {
    const state = updateMockState((current) => {
      syncLineupLocks(current);
      return current;
    });
    getCurrentUserId(state);
    return withLatency(state.notificationCampaigns);
  }

  async createNotificationCampaign(input: CreateNotificationCampaignInput) {
    const state = updateMockState((current) => {
      const actor = getCurrentUserId(current);
      syncLineupLocks(current);
      const created: NotificationCampaign = {
        id: nextId("campaign"),
        title: input.title,
        body: input.body,
        audience: input.audience,
        status: input.scheduledAt ? "scheduled" : "draft",
        scheduledAt: input.scheduledAt,
        createdAt: nowIso(),
      };

      current.notificationCampaigns.unshift(created);
      writeAudit(
        current,
        actor,
        "notification.campaign.create",
        "notification_campaign",
        created.id,
        undefined,
        created,
      );
      return current;
    });

    return withLatency(state.notificationCampaigns[0]);
  }

  async sendNotificationCampaign(campaignId: string) {
    let updated: NotificationCampaign | undefined;
    updateMockState((current) => {
      const actor = getCurrentUserId(current);
      syncLineupLocks(current);
      const index = current.notificationCampaigns.findIndex(
        (item) => item.id === campaignId,
      );
      if (index < 0) {
        throw notFound("Campaign");
      }

      const before = current.notificationCampaigns[index];
      updated = {
        ...before,
        status: "sent",
        sentAt: nowIso(),
      };
      current.notificationCampaigns[index] = updated;
      writeAudit(
        current,
        actor,
        "notification.campaign.send",
        "notification_campaign",
        campaignId,
        before,
        updated,
      );
      return current;
    });

    if (!updated) {
      throw notFound("Campaign");
    }

    return withLatency(updated);
  }

  async getAuditLogs(params?: PaginationParams) {
    const state = updateMockState((current) => {
      syncLineupLocks(current);
      return current;
    });
    getCurrentUserId(state);
    return withLatency(paginate(state.auditLogs, params));
  }

  async getAuditLog(logId: string) {
    const state = updateMockState((current) => {
      syncLineupLocks(current);
      return current;
    });
    getCurrentUserId(state);
    const log = state.auditLogs.find((item) => item.id === logId);
    if (!log) {
      throw notFound("Audit log");
    }

    return withLatency(log);
  }
}
