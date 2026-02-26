import { httpClient } from "~/lib/api/client";
import type {
  AuditLog,
  AuditLogFilters,
  AdminOverview,
  BracketData,
  CompleteMatchInput,
  CreateLeagueInput,
  CreateMatchInput,
  CreateNotificationCampaignInput,
  CreateSeasonInput,
  CreateTournamentInput,
  CreateWalletPackInput,
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
  Session,
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

export class HttpAdminApi {
  async login(input: LoginInput) {
    const { data } = await httpClient.post<Session>("/admin/auth/login", input);
    return data;
  }

  async me() {
    const { data } = await httpClient.get<Session["user"]>("/admin/auth/me");
    return data;
  }

  async logout() {
    await httpClient.post("/admin/auth/logout");
  }

  async getSeasons(params?: PaginationParams) {
    const { data } = await httpClient.get<Paginated<Season>>("/admin/seasons", {
      params,
    });
    return data;
  }

  async getOverview() {
    const { data } = await httpClient.get<AdminOverview>("/admin/overview");
    return data;
  }

  async createSeason(input: CreateSeasonInput) {
    const { data } = await httpClient.post<Season>("/admin/seasons", input);
    return data;
  }

  async updateSeason(seasonId: string, input: UpdateSeasonInput) {
    const { data } = await httpClient.patch<Season>(
      `/admin/seasons/${seasonId}`,
      input,
    );
    return data;
  }

  async getTournaments(filters?: TournamentFilters & PaginationParams) {
    const { data } = await httpClient.get<Paginated<Tournament>>(
      "/admin/tournaments",
      {
        params: filters,
      },
    );
    return data;
  }

  async createTournament(input: CreateTournamentInput) {
    const { data } = await httpClient.post<Tournament>(
      "/admin/tournaments",
      input,
    );
    return data;
  }

  async getTournament(tournamentId: string) {
    const { data } = await httpClient.get<Tournament>(
      `/admin/tournaments/${tournamentId}`,
    );
    return data;
  }

  async updateTournament(tournamentId: string, input: UpdateTournamentInput) {
    const { data } = await httpClient.patch<Tournament>(
      `/admin/tournaments/${tournamentId}`,
      input,
    );
    return data;
  }

  async lockEntryList(tournamentId: string) {
    const { data } = await httpClient.post<Tournament>(
      `/admin/tournaments/${tournamentId}/lock-entry-list`,
    );
    return data;
  }

  async regenerateBracket(tournamentId: string) {
    const { data } = await httpClient.post<BracketData>(
      `/admin/tournaments/${tournamentId}/regenerate-bracket`,
    );
    return data;
  }

  async getEntryList(tournamentId: string) {
    const { data } = await httpClient.get<EntryListItem[]>(
      `/admin/tournaments/${tournamentId}/entry-list`,
    );
    return data;
  }

  async replaceEntryList(tournamentId: string, items: EntryListItem[]) {
    const { data } = await httpClient.put<EntryListItem[]>(
      `/admin/tournaments/${tournamentId}/entry-list`,
      items,
    );
    return data;
  }

  async updateEntryListItem(
    tournamentId: string,
    itemId: string,
    input: Partial<EntryListItem>,
  ) {
    const { data } = await httpClient.patch<EntryListItem>(
      `/admin/tournaments/${tournamentId}/entry-list/${itemId}`,
      input,
    );
    return data;
  }

  async getMatches(tournamentId: string) {
    const { data } = await httpClient.get<Match[]>(
      `/admin/tournaments/${tournamentId}/matches`,
    );
    return data;
  }

  async createMatch(tournamentId: string, input: CreateMatchInput) {
    const { data } = await httpClient.post<Match>(
      `/admin/tournaments/${tournamentId}/matches`,
      input,
    );
    return data;
  }

  async updateMatch(matchId: string, input: UpdateMatchInput) {
    const { data } = await httpClient.patch<Match>(
      `/admin/matches/${matchId}`,
      input,
    );
    return data;
  }

  async completeMatch(matchId: string, input: CompleteMatchInput) {
    const { data } = await httpClient.post<Match>(
      `/admin/matches/${matchId}/complete`,
      input,
    );
    return data;
  }

  async getBracket(tournamentId: string) {
    const { data } = await httpClient.get<BracketData>(
      `/admin/tournaments/${tournamentId}/bracket`,
    );
    return data;
  }

  async rebuildBracket(tournamentId: string) {
    const { data } = await httpClient.post<BracketData>(
      `/admin/tournaments/${tournamentId}/bracket/rebuild`,
    );
    return data;
  }

  async getScoringConfig(tournamentId: string) {
    const { data } = await httpClient.get<ScoringConfig>(
      `/admin/tournaments/${tournamentId}/scoring/config`,
    );
    return data;
  }

  async updateScoringConfig(
    tournamentId: string,
    input: UpdateScoringConfigInput,
  ) {
    const { data } = await httpClient.put<ScoringConfig>(
      `/admin/tournaments/${tournamentId}/scoring/config`,
      input,
    );
    return data;
  }

  async recalculateScoring(tournamentId: string) {
    const { data } = await httpClient.post<ScoringRun>(
      `/admin/tournaments/${tournamentId}/scoring/recalculate`,
    );
    return data;
  }

  async getScoringRuns(tournamentId: string) {
    const { data } = await httpClient.get<ScoringRun[]>(
      `/admin/tournaments/${tournamentId}/scoring/runs`,
    );
    return data;
  }

  async getLeagues(params?: PaginationParams) {
    const { data } = await httpClient.get<Paginated<League>>("/admin/leagues", {
      params,
    });
    return data;
  }

  async createLeague(input: CreateLeagueInput) {
    const { data } = await httpClient.post<League>("/admin/leagues", input);
    return data;
  }

  async updateLeague(leagueId: string, input: UpdateLeagueInput) {
    const { data } = await httpClient.patch<League>(
      `/admin/leagues/${leagueId}`,
      input,
    );
    return data;
  }

  async getLeagueLeaderboard(leagueId: string) {
    const { data } = await httpClient.get<LeaderboardRow[]>(
      `/admin/leagues/${leagueId}/leaderboard`,
    );
    return data;
  }

  async recomputeLeague(leagueId: string) {
    const { data } = await httpClient.post<LeaderboardRow[]>(
      `/admin/leagues/${leagueId}/recompute`,
    );
    return data;
  }

  async getWalletPacks(params?: PaginationParams) {
    const { data } = await httpClient.get<Paginated<WalletPack>>(
      "/admin/wallet/packs",
      { params },
    );
    return data;
  }

  async createWalletPack(input: CreateWalletPackInput) {
    const { data } = await httpClient.post<WalletPack>(
      "/admin/wallet/packs",
      input,
    );
    return data;
  }

  async updateWalletPack(packId: string, input: UpdateWalletPackInput) {
    const { data } = await httpClient.patch<WalletPack>(
      `/admin/wallet/packs/${packId}`,
      input,
    );
    return data;
  }

  async getWalletTransactions(params?: PaginationParams) {
    const { data } = await httpClient.get<Paginated<WalletTransaction>>(
      "/admin/wallet/transactions",
      {
        params,
      },
    );
    return data;
  }

  async getPaymentEvents(params?: PaginationParams) {
    const { data } = await httpClient.get<Paginated<PaymentEvent>>(
      "/admin/payments/events",
      {
        params,
      },
    );
    return data;
  }

  async reverifyPaymentEvent(eventId: string) {
    const { data } = await httpClient.post<PaymentEvent>(
      `/admin/payments/events/${eventId}/reverify`,
    );
    return data;
  }

  async getNotificationCampaigns(params?: PaginationParams) {
    const { data } = await httpClient.get<Paginated<NotificationCampaign>>(
      "/admin/notifications/campaigns",
      { params },
    );
    return data;
  }

  async createNotificationCampaign(input: CreateNotificationCampaignInput) {
    const { data } = await httpClient.post<NotificationCampaign>(
      "/admin/notifications/campaigns",
      input,
    );
    return data;
  }

  async sendNotificationCampaign(campaignId: string) {
    const { data } = await httpClient.post<NotificationCampaign>(
      `/admin/notifications/campaigns/${campaignId}/send`,
    );
    return data;
  }

  async getAuditLogs(params?: AuditLogFilters) {
    const { data } = await httpClient.get<Paginated<AuditLog>>(
      "/admin/audit-logs",
      {
        params,
      },
    );
    return data;
  }

  async getAuditLog(logId: string) {
    const { data } = await httpClient.get<AuditLog>(
      `/admin/audit-logs/${logId}`,
    );
    return data;
  }
}
