import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("admin", "routes/admin/layout.tsx", [
    index("routes/admin/overview.tsx"),
    route("seasons", "routes/admin/seasons.tsx"),
    route("tournaments", "routes/admin/tournaments/index.tsx"),
    route("tournaments/:tournamentId", "routes/admin/tournaments/detail.tsx"),
    route(
      "tournaments/:tournamentId/entry-list",
      "routes/admin/tournaments/entry-list.tsx",
    ),
    route(
      "tournaments/:tournamentId/matches",
      "routes/admin/tournaments/matches.tsx",
    ),
    route(
      "tournaments/:tournamentId/bracket",
      "routes/admin/tournaments/bracket.tsx",
    ),
    route(
      "tournaments/:tournamentId/scoring",
      "routes/admin/tournaments/scoring.tsx",
    ),
    route(
      "tournaments/:tournamentId/lineup",
      "routes/admin/tournaments/lineup.tsx",
    ),
    route("leagues", "routes/admin/leagues.tsx"),
    route("wallet", "routes/admin/wallet.tsx"),
    route("payments", "routes/admin/payments.tsx"),
    route("notifications", "routes/admin/notifications.tsx"),
    route("audit-logs", "routes/admin/audit-logs.tsx"),
  ]),
  index("routes/home.tsx"),
] satisfies RouteConfig;
