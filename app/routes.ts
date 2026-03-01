import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("admin", "routes/admin/layout.tsx", [
    index("routes/admin/overview.tsx"),
    route("championships", "routes/admin/championships.tsx"),
    route("athletes", "routes/admin/athletes.tsx"),
    route("tournaments", "routes/admin/tournaments.tsx"),
    route("tournaments/:id", "routes/admin/tournament-detail.tsx"),
    route("leagues", "routes/admin/leagues.tsx"),
    route("credits", "routes/admin/credits.tsx"),
    route("audit-logs", "routes/admin/audit-logs.tsx"),
  ]),
] satisfies RouteConfig;
