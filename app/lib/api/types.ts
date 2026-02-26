export type AdminRole = "super_admin" | "ops_admin";

export type Gender = "men" | "women";

export type SeasonStatus = "upcoming" | "active" | "closed";

export type TournamentStatus =
  | "draft"
  | "open"
  | "entry_locked"
  | "live"
  | "completed"
  | "archived";

export type TournamentPhase = "qualification" | "pools" | "main_draw";

export type MatchStatus = "scheduled" | "live" | "completed" | "cancelled";

export type EntryStatus = "pool" | "qualification" | "reserve";

export type LeagueMode = "overall" | "head_to_head";

export type LeagueStatus = "active" | "paused" | "completed";

export type PaymentProvider = "apple" | "google" | "stripe";

export type PaymentEventStatus = "received" | "verified" | "rejected";

export type NotificationStatus = "draft" | "scheduled" | "sent";

export type ScoringRunStatus = "running" | "completed" | "failed";

export type DayBucket = "friday" | "saturday" | "sunday";

export interface ApiErrorEnvelope {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  traceId?: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  active: boolean;
}

export interface Session {
  token: string;
  user: AdminUser;
  expiresAt: string;
}

export interface Season {
  id: string;
  year: number;
  name: string;
  status: SeasonStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentPolicy {
  rosterSize: number;
  starterCount: number;
  reserveCount: number;
  lineupLockAt: string;
  timezone: string;
  noRetroactiveScoring: boolean;
  genderIsolation: boolean;
}

export interface TournamentRegistration {
  userId: string;
  registeredAt: string;
}

export interface Tournament {
  id: string;
  seasonId: string;
  name: string;
  slug: string;
  location: string;
  gender: Gender;
  isPublic: boolean;
  status: TournamentStatus;
  startDate: string;
  endDate: string;
  policy: TournamentPolicy;
  entryListLocked: boolean;
  lineupLocked: boolean;
  bracketGeneratedAt?: string;
  createdAt: string;
  updatedAt: string;
  registrations: TournamentRegistration[];
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  countryCode: string;
  rankPoints: number;
  status: "active" | "injured" | "inactive";
}

export interface TournamentPair {
  id: string;
  tournamentId: string;
  playerIds: [string, string];
  seed: number;
  status: EntryStatus;
}

export interface EntryListItem {
  id: string;
  tournamentId: string;
  pair: TournamentPair;
  coach?: string;
  ranking: number;
  entryStatus: EntryStatus;
  reserveOrder?: number;
}

export interface SetScore {
  setNumber: number;
  pairAScore: number;
  pairBScore: number;
}

export interface Match {
  id: string;
  tournamentId: string;
  phase: TournamentPhase;
  day: DayBucket;
  round: number;
  slot: number;
  status: MatchStatus;
  bestOf: 3;
  pairAId: string;
  pairBId: string;
  setScores: SetScore[];
  winnerPairId?: string;
  scheduledAt: string;
  completedAt?: string;
}

export interface BracketNode {
  id: string;
  tournamentId: string;
  phase: TournamentPhase;
  round: number;
  slot: number;
  matchId: string;
  label: string;
  pairAId?: string;
  pairBId?: string;
  winnerPairId?: string;
}

export interface BracketEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  outcome: "winner";
}

export interface BracketData {
  tournamentId: string;
  nodes: BracketNode[];
  edges: BracketEdge[];
  updatedAt: string;
}

export interface ScoringConfig {
  tournamentId: string;
  basePointMultiplier: number;
  bonusWin20: number;
  bonusWin21: number;
  updatedAt: string;
}

export interface UserTournamentTeam {
  id: string;
  userId: string;
  tournamentId: string;
  rosterPlayerIds: string[];
  starters: string[];
  reserves: string[];
  createdAt: string;
}

export interface UserScoreTotal {
  userId: string;
  totalPoints: number;
  countedPlayers: string[];
}

export interface ScoringRun {
  id: string;
  tournamentId: string;
  status: ScoringRunStatus;
  triggeredBy: string;
  startedAt: string;
  finishedAt: string;
  totalsByUser: UserScoreTotal[];
}

export interface LeaderboardRow {
  id: string;
  leagueId: string;
  userId: string;
  displayName: string;
  rank: number;
  totalPoints: number;
  tieBreakerScore: number;
  lastUpdated: string;
}

export interface League {
  id: string;
  seasonId: string;
  name: string;
  mode: LeagueMode;
  status: LeagueStatus;
  tieBreakers: string[];
  updatedAt: string;
}

export interface WalletPack {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  currency: string;
  active: boolean;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  amountCredits: number;
  direction: "credit" | "debit";
  reason: string;
  createdAt: string;
}

export interface PaymentEvent {
  id: string;
  provider: PaymentProvider;
  externalId: string;
  status: PaymentEventStatus;
  receivedAt: string;
  verifiedAt?: string;
  payload: Record<string, unknown>;
}

export interface NotificationCampaign {
  id: string;
  title: string;
  body: string;
  audience: "all" | "active_users" | "season_users";
  status: NotificationStatus;
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  before?: unknown;
  after?: unknown;
}

export interface OverviewKpis {
  activeTournaments: number;
  lockedEntryLists: number;
  pendingMatches: number;
  completedMatches: number;
  scoringRuns: number;
  failedPaymentEvents: number;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface CreateSeasonInput {
  year: number;
  name: string;
}

export interface UpdateSeasonInput {
  name?: string;
  status?: SeasonStatus;
}

export interface TournamentFilters {
  seasonId?: string;
  status?: TournamentStatus;
  gender?: Gender;
}

export interface CreateTournamentInput {
  seasonId: string;
  name: string;
  slug: string;
  location: string;
  gender: Gender;
  isPublic: boolean;
  startDate: string;
  endDate: string;
  policy: TournamentPolicy;
}

export interface UpdateTournamentInput {
  name?: string;
  location?: string;
  status?: TournamentStatus;
  isPublic?: boolean;
  policy?: Partial<TournamentPolicy>;
}

export interface CreateMatchInput {
  tournamentId: string;
  phase: TournamentPhase;
  day: DayBucket;
  round: number;
  slot: number;
  pairAId: string;
  pairBId: string;
  scheduledAt: string;
}

export interface UpdateMatchInput {
  status?: MatchStatus;
  setScores?: SetScore[];
  scheduledAt?: string;
}

export interface CompleteMatchInput {
  setScores: SetScore[];
}

export interface UpdateScoringConfigInput {
  basePointMultiplier: number;
  bonusWin20: number;
  bonusWin21: number;
}

export interface CreateLeagueInput {
  seasonId: string;
  name: string;
  mode: LeagueMode;
}

export interface UpdateLeagueInput {
  name?: string;
  status?: LeagueStatus;
  tieBreakers?: string[];
}

export interface CreateWalletPackInput {
  name: string;
  credits: number;
  priceCents: number;
  currency: string;
}

export interface UpdateWalletPackInput {
  name?: string;
  credits?: number;
  priceCents?: number;
  active?: boolean;
}

export interface CreateNotificationCampaignInput {
  title: string;
  body: string;
  audience: NotificationCampaign["audience"];
  scheduledAt?: string;
}
