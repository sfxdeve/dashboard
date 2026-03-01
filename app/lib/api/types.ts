// ── Enums ─────────────────────────────────────────────────────

export type Gender = "M" | "F";

export type TournamentStatus =
  | "UPCOMING"
  | "REGISTRATION_OPEN"
  | "LOCKED"
  | "ONGOING"
  | "COMPLETED";

export type EntryStatus =
  | "DIRECT"
  | "QUALIFICATION"
  | "RESERVE_1"
  | "RESERVE_2"
  | "RESERVE_3";

export type MatchRound =
  | "QUALIFICATION_R1"
  | "QUALIFICATION_R2"
  | "POOL"
  | "R12"
  | "QF"
  | "SF"
  | "FINAL"
  | "THIRD_PLACE";

export type MatchStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CORRECTED";

export type LeagueType = "PUBLIC" | "PRIVATE";
export type LeagueStatus = "OPEN" | "ONGOING" | "COMPLETED";
export type RankingMode = "OVERALL" | "HEAD_TO_HEAD";

export type CreditTransactionType = "PURCHASE" | "SPEND" | "BONUS" | "REFUND";
export type CreditTransactionSource = "STRIPE" | "ADMIN" | "SYSTEM";

// ── Pagination ────────────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PagedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

// ── API Error ─────────────────────────────────────────────────

export interface ApiErrorEnvelope {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  traceId?: string;
}

// ── Auth & Session ────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  active: boolean;
}

export interface Session {
  token: string;
  user: AdminUser;
  expiresAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

// ── Championship ──────────────────────────────────────────────

export interface Championship {
  _id: string;
  name: string;
  gender: Gender;
  seasonYear: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChampionshipInput {
  name: string;
  gender: Gender;
  seasonYear: number;
}

export type UpdateChampionshipInput = Partial<CreateChampionshipInput>;

// ── Athlete ───────────────────────────────────────────────────

export interface Athlete {
  _id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  championshipId: string | Championship;
  pictureUrl?: string;
  entryPoints: number;
  globalPoints: number;
  averageFantasyScore: number;
  fantacoinCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface AthleteFilters extends PaginationParams {
  championshipId?: string;
  gender?: Gender;
  search?: string;
}

export interface CreateAthleteInput {
  firstName: string;
  lastName: string;
  gender: Gender;
  championshipId: string;
  pictureUrl?: string;
  entryPoints?: number;
  globalPoints?: number;
  fantacoinCost?: number;
}

export type UpdateAthleteInput = Partial<CreateAthleteInput>;

// ── Tournament ────────────────────────────────────────────────

export interface Tournament {
  _id: string;
  championshipId: string | Championship;
  location: string;
  startDate: string;
  endDate: string;
  status: TournamentStatus;
  lineupLockAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentFilters extends PaginationParams {
  championshipId?: string;
  status?: TournamentStatus;
  year?: number;
}

export interface CreateTournamentInput {
  championshipId: string;
  location: string;
  startDate: string;
  endDate: string;
  lineupLockAt?: string;
}

export interface UpdateTournamentInput {
  location?: string;
  startDate?: string;
  endDate?: string;
  status?: TournamentStatus;
  lineupLockAt?: string;
}

// ── TournamentPair ────────────────────────────────────────────

export interface TournamentPair {
  _id: string;
  tournamentId: string;
  athleteAId: string | Athlete;
  athleteBId: string | Athlete;
  entryStatus: EntryStatus;
  seedRank?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePairInput {
  athleteAId: string;
  athleteBId: string;
  entryStatus: EntryStatus;
  seedRank?: number;
}

// ── Match ─────────────────────────────────────────────────────

export interface Match {
  _id: string;
  tournamentId: string;
  round: MatchRound;
  pairAId: string | TournamentPair;
  pairBId: string | TournamentPair;
  scheduledAt?: string;
  set1A?: number;
  set1B?: number;
  set2A?: number;
  set2B?: number;
  set3A?: number;
  set3B?: number;
  winnerPairId?: string;
  status: MatchStatus;
  isRetirement: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MatchFilters {
  tournamentId?: string;
  round?: MatchRound;
  status?: MatchStatus;
}

export interface CreateMatchInput {
  tournamentId: string;
  round: MatchRound;
  pairAId: string;
  pairBId: string;
  scheduledAt?: string;
}

export interface UpdateMatchInput {
  scheduledAt?: string;
  set1A?: number;
  set1B?: number;
  set2A?: number;
  set2B?: number;
  set3A?: number;
  set3B?: number;
  winnerPairId?: string;
  status?: MatchStatus;
  isRetirement?: boolean;
  reason?: string;
}

// ── League ────────────────────────────────────────────────────

export interface League {
  _id: string;
  name: string;
  type: LeagueType;
  createdBy?: string;
  isOfficial: boolean;
  championshipId: string | Championship;
  rankingMode: RankingMode;
  rosterSize: number;
  startersPerGameweek: number;
  initialBudget: number;
  marketEnabled: boolean;
  status: LeagueStatus;
  entryFee?: number;
  prize1st?: string;
  prize2nd?: string;
  prize3rd?: string;
  inviteCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeagueFilters extends PaginationParams {
  type?: LeagueType;
  status?: LeagueStatus;
  championshipId?: string;
}

export interface CreateLeagueInput {
  name: string;
  type: LeagueType;
  championshipId: string;
  rankingMode: RankingMode;
  rosterSize: number;
  startersPerGameweek: number;
  initialBudget: number;
  marketEnabled?: boolean;
  entryFee?: number;
  prize1st?: string;
  prize2nd?: string;
  prize3rd?: string;
}

// ── CreditPack ────────────────────────────────────────────────

export interface CreditPack {
  _id: string;
  name: string;
  credits: number;
  stripePriceId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCreditPackInput {
  name: string;
  credits: number;
  stripePriceId: string;
  active?: boolean;
}

// ── CreditTransaction ─────────────────────────────────────────

export interface CreditTransaction {
  _id: string;
  walletId: string;
  type: CreditTransactionType;
  source: CreditTransactionSource;
  amount: number;
  balanceAfter: number;
  meta?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GrantCreditsInput {
  userId: string;
  amount: number;
  reason?: string;
}

// ── AuditLog ──────────────────────────────────────────────────

export interface AuditLog {
  _id: string;
  adminId: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogFilters extends PaginationParams {
  adminId?: string;
  entity?: string;
  from?: string;
  to?: string;
}
