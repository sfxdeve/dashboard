import { httpClient } from "~/lib/api/client";
import type {
  AuditLog,
  AuditLogFilters,
  Athlete,
  AthleteFilters,
  Championship,
  CreditPack,
  CreditTransaction,
  CreateAthleteInput,
  CreateChampionshipInput,
  CreateCreditPackInput,
  CreateLeagueInput,
  CreateMatchInput,
  CreatePairInput,
  CreateTournamentInput,
  GrantCreditsInput,
  League,
  LeagueFilters,
  LoginInput,
  Match,
  MatchFilters,
  PagedResult,
  Session,
  Tournament,
  TournamentFilters,
  TournamentPair,
  UpdateAthleteInput,
  UpdateChampionshipInput,
  UpdateMatchInput,
  UpdateTournamentInput,
} from "~/lib/api/types";

function decodeJwtExpiry(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as { exp: number };
    return new Date(payload.exp * 1000).toISOString();
  } catch {
    return new Date(Date.now() + 15 * 60 * 1000).toISOString();
  }
}

export class HttpAdminApi {
  // ── Auth ───────────────────────────────────────────────────

  async login(input: LoginInput): Promise<Session> {
    const { data } = await httpClient.post<{
      accessToken: string;
      user: { id: string; name: string; email: string; role: string };
    }>("/api/v1/auth/login", input);
    return {
      token: data.accessToken,
      user: {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.name,
        active: true,
      },
      expiresAt: decodeJwtExpiry(data.accessToken),
    };
  }

  async logout(): Promise<void> {
    await httpClient.post("/api/v1/auth/logout");
  }

  // ── Championships ──────────────────────────────────────────

  async getChampionships(): Promise<Championship[]> {
    const { data } = await httpClient.get<Championship[]>(
      "/api/v1/championships",
    );
    return data;
  }

  async createChampionship(
    input: CreateChampionshipInput,
  ): Promise<Championship> {
    const { data } = await httpClient.post<Championship>(
      "/api/v1/championships",
      input,
    );
    return data;
  }

  async updateChampionship(
    id: string,
    input: UpdateChampionshipInput,
  ): Promise<Championship> {
    const { data } = await httpClient.patch<Championship>(
      `/api/v1/championships/${id}`,
      input,
    );
    return data;
  }

  // ── Athletes ───────────────────────────────────────────────

  async getAthletes(filters?: AthleteFilters): Promise<PagedResult<Athlete>> {
    const { data } = await httpClient.get<PagedResult<Athlete>>(
      "/api/v1/athletes",
      { params: filters },
    );
    return data;
  }

  async createAthlete(input: CreateAthleteInput): Promise<Athlete> {
    const { data } = await httpClient.post<Athlete>("/api/v1/athletes", input);
    return data;
  }

  async updateAthlete(id: string, input: UpdateAthleteInput): Promise<Athlete> {
    const { data } = await httpClient.patch<Athlete>(
      `/api/v1/athletes/${id}`,
      input,
    );
    return data;
  }

  // ── Tournaments ────────────────────────────────────────────

  async getTournaments(
    filters?: TournamentFilters,
  ): Promise<PagedResult<Tournament>> {
    const { data } = await httpClient.get<PagedResult<Tournament>>(
      "/api/v1/tournaments",
      { params: filters },
    );
    return data;
  }

  async getTournament(id: string): Promise<Tournament> {
    const { data } = await httpClient.get<Tournament>(
      `/api/v1/tournaments/${id}`,
    );
    return data;
  }

  async createTournament(input: CreateTournamentInput): Promise<Tournament> {
    const { data } = await httpClient.post<Tournament>(
      "/api/v1/tournaments",
      input,
    );
    return data;
  }

  async updateTournament(
    id: string,
    input: UpdateTournamentInput,
  ): Promise<Tournament> {
    const { data } = await httpClient.patch<Tournament>(
      `/api/v1/tournaments/${id}`,
      input,
    );
    return data;
  }

  async lockLineups(tournamentId: string): Promise<Tournament> {
    const { data } = await httpClient.post<Tournament>(
      `/api/v1/tournaments/${tournamentId}/lock`,
    );
    return data;
  }

  // ── Tournament Pairs ───────────────────────────────────────

  async getTournamentPairs(tournamentId: string): Promise<TournamentPair[]> {
    const { data } = await httpClient.get<TournamentPair[]>(
      `/api/v1/tournaments/${tournamentId}/pairs`,
    );
    return data;
  }

  async addPair(
    tournamentId: string,
    input: CreatePairInput,
  ): Promise<TournamentPair> {
    const { data } = await httpClient.post<TournamentPair>(
      `/api/v1/tournaments/${tournamentId}/pairs`,
      input,
    );
    return data;
  }

  async removePair(tournamentId: string, pairId: string): Promise<void> {
    await httpClient.delete(
      `/api/v1/tournaments/${tournamentId}/pairs/${pairId}`,
    );
  }

  // ── Matches ────────────────────────────────────────────────

  async getMatches(filters?: MatchFilters): Promise<Match[]> {
    const { data } = await httpClient.get<Match[]>("/api/v1/matches", {
      params: filters,
    });
    return data;
  }

  async createMatch(input: CreateMatchInput): Promise<Match> {
    const { data } = await httpClient.post<Match>("/api/v1/matches", input);
    return data;
  }

  async updateMatch(id: string, input: UpdateMatchInput): Promise<Match> {
    const { data } = await httpClient.patch<Match>(
      `/api/v1/matches/${id}`,
      input,
    );
    return data;
  }

  // ── Leagues ────────────────────────────────────────────────

  async getLeagues(filters?: LeagueFilters): Promise<PagedResult<League>> {
    const { data } = await httpClient.get<PagedResult<League>>(
      "/api/v1/leagues",
      { params: filters },
    );
    return data;
  }

  async createLeague(input: CreateLeagueInput): Promise<League> {
    const { data } = await httpClient.post<League>("/api/v1/leagues", input);
    return data;
  }

  // ── Credit Packs ───────────────────────────────────────────

  async getCreditPacks(): Promise<CreditPack[]> {
    const { data } = await httpClient.get<CreditPack[]>(
      "/api/v1/credits/packs",
    );
    return data;
  }

  async createCreditPack(input: CreateCreditPackInput): Promise<CreditPack> {
    const { data } = await httpClient.post<CreditPack>(
      "/api/v1/credits/admin/packs",
      input,
    );
    return data;
  }

  async toggleCreditPack(id: string): Promise<CreditPack> {
    const { data } = await httpClient.patch<CreditPack>(
      `/api/v1/credits/admin/packs/${id}`,
    );
    return data;
  }

  // ── Credit Transactions ────────────────────────────────────

  async getWalletTransactions(params?: {
    page?: number;
    limit?: number;
  }): Promise<PagedResult<CreditTransaction>> {
    const { data } = await httpClient.get<PagedResult<CreditTransaction>>(
      "/api/v1/credits/wallet",
      { params },
    );
    return data;
  }

  async grantCredits(input: GrantCreditsInput): Promise<void> {
    await httpClient.post("/api/v1/credits/admin/grant", input);
  }

  // ── Audit Logs ─────────────────────────────────────────────

  async getAuditLogs(
    filters?: AuditLogFilters,
  ): Promise<PagedResult<AuditLog>> {
    const { data } = await httpClient.get<PagedResult<AuditLog>>(
      "/api/v1/admin/audit-log",
      { params: filters },
    );
    return data;
  }
}
