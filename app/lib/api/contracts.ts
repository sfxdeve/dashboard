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

export interface AdminApi {
  login(input: LoginInput): Promise<Session>;
  me(): Promise<Session["user"]>;
  logout(): Promise<void>;

  getSeasons(params?: PaginationParams): Promise<Paginated<Season>>;
  getOverview(): Promise<AdminOverview>;
  createSeason(input: CreateSeasonInput): Promise<Season>;
  updateSeason(seasonId: string, input: UpdateSeasonInput): Promise<Season>;

  getTournaments(
    filters?: TournamentFilters & PaginationParams,
  ): Promise<Paginated<Tournament>>;
  createTournament(input: CreateTournamentInput): Promise<Tournament>;
  getTournament(tournamentId: string): Promise<Tournament>;
  updateTournament(
    tournamentId: string,
    input: UpdateTournamentInput,
  ): Promise<Tournament>;
  lockEntryList(tournamentId: string): Promise<Tournament>;
  regenerateBracket(tournamentId: string): Promise<BracketData>;

  getEntryList(tournamentId: string): Promise<EntryListItem[]>;
  replaceEntryList(
    tournamentId: string,
    items: EntryListItem[],
  ): Promise<EntryListItem[]>;
  updateEntryListItem(
    tournamentId: string,
    itemId: string,
    input: Partial<EntryListItem>,
  ): Promise<EntryListItem>;

  getMatches(tournamentId: string): Promise<Match[]>;
  createMatch(tournamentId: string, input: CreateMatchInput): Promise<Match>;
  updateMatch(matchId: string, input: UpdateMatchInput): Promise<Match>;
  completeMatch(matchId: string, input: CompleteMatchInput): Promise<Match>;

  getBracket(tournamentId: string): Promise<BracketData>;
  rebuildBracket(tournamentId: string): Promise<BracketData>;

  getScoringConfig(tournamentId: string): Promise<ScoringConfig>;
  updateScoringConfig(
    tournamentId: string,
    input: UpdateScoringConfigInput,
  ): Promise<ScoringConfig>;
  recalculateScoring(tournamentId: string): Promise<ScoringRun>;
  getScoringRuns(tournamentId: string): Promise<ScoringRun[]>;

  getLeagues(params?: PaginationParams): Promise<Paginated<League>>;
  createLeague(input: CreateLeagueInput): Promise<League>;
  updateLeague(leagueId: string, input: UpdateLeagueInput): Promise<League>;
  getLeagueLeaderboard(leagueId: string): Promise<LeaderboardRow[]>;
  recomputeLeague(leagueId: string): Promise<LeaderboardRow[]>;

  getWalletPacks(params?: PaginationParams): Promise<Paginated<WalletPack>>;
  createWalletPack(input: CreateWalletPackInput): Promise<WalletPack>;
  updateWalletPack(
    packId: string,
    input: UpdateWalletPackInput,
  ): Promise<WalletPack>;
  getWalletTransactions(
    params?: PaginationParams,
  ): Promise<Paginated<WalletTransaction>>;

  getPaymentEvents(params?: PaginationParams): Promise<Paginated<PaymentEvent>>;
  reverifyPaymentEvent(eventId: string): Promise<PaymentEvent>;

  getNotificationCampaigns(
    params?: PaginationParams,
  ): Promise<Paginated<NotificationCampaign>>;
  createNotificationCampaign(
    input: CreateNotificationCampaignInput,
  ): Promise<NotificationCampaign>;
  sendNotificationCampaign(campaignId: string): Promise<NotificationCampaign>;

  getAuditLogs(params?: AuditLogFilters): Promise<Paginated<AuditLog>>;
  getAuditLog(logId: string): Promise<AuditLog>;
}
