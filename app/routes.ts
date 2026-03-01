import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  // route("admin", "routes/admin/layout.tsx", [
  //   index("routes/admin/overview.tsx"),
  //   route("example", "routes/admin/example.tsx"),
  //   route("examples", "routes/admin/examples/index.tsx", [
  //     route(":exampleId", "routes/admin/examples/detail.tsx"),
  //   ]),
  // ]),
] satisfies RouteConfig;
