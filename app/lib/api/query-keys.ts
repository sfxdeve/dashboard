export const queryKeys = {
  overview: ["overview"] as const,
  me: ["auth", "me"] as const,
  seasons: (page?: number, pageSize?: number) =>
    ["seasons", page, pageSize] as const,
  tournamentsRoot: ["tournaments"] as const,
  tournaments: (filters?: unknown) => ["tournaments", filters ?? {}] as const,
  tournament: (tournamentId: string) => ["tournament", tournamentId] as const,
  entryList: (tournamentId: string) => ["entry-list", tournamentId] as const,
  matchesRoot: ["matches"] as const,
  matches: (tournamentId: string) => ["matches", tournamentId] as const,
  bracket: (tournamentId: string) => ["bracket", tournamentId] as const,
  scoringConfig: (tournamentId: string) =>
    ["scoring-config", tournamentId] as const,
  scoringRunsRoot: ["scoring-runs"] as const,
  scoringRuns: (tournamentId: string) =>
    ["scoring-runs", tournamentId] as const,
  leagues: (page?: number, pageSize?: number) =>
    ["leagues", page, pageSize] as const,
  leaderboard: (leagueId: string) =>
    ["league", leagueId, "leaderboard"] as const,
  walletPacks: (page?: number, pageSize?: number) =>
    ["wallet-packs", page, pageSize] as const,
  walletTransactions: (page: number, pageSize: number) =>
    ["wallet-transactions", page, pageSize] as const,
  paymentEventsRoot: ["payment-events"] as const,
  paymentEvents: (page: number, pageSize: number) =>
    ["payment-events", page, pageSize] as const,
  campaigns: (page?: number, pageSize?: number) =>
    ["notification-campaigns", page, pageSize] as const,
  auditLogs: (params: unknown) => ["audit-logs", params ?? {}] as const,
  auditLog: (logId: string) => ["audit-log", logId] as const,
};
