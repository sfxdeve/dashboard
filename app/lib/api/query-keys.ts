export const queryKeys = {
  me: ["auth", "me"] as const,
  seasons: ["seasons"] as const,
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
  leagues: ["leagues"] as const,
  leaderboard: (leagueId: string) =>
    ["league", leagueId, "leaderboard"] as const,
  walletPacks: ["wallet-packs"] as const,
  walletTransactions: (page: number, pageSize: number) =>
    ["wallet-transactions", page, pageSize] as const,
  paymentEventsRoot: ["payment-events"] as const,
  paymentEvents: (page: number, pageSize: number) =>
    ["payment-events", page, pageSize] as const,
  campaigns: ["notification-campaigns"] as const,
  auditLogs: (page: number, pageSize: number) =>
    ["audit-logs", page, pageSize] as const,
  auditLog: (logId: string) => ["audit-log", logId] as const,
};
