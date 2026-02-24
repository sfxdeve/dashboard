import type { AdminApi } from "~/lib/api/contracts";
import { HttpAdminApi } from "~/lib/api/http-admin-api";
import { MockAdminApi } from "~/lib/api/mock-admin-api";
import { apiRuntimeMode } from "~/lib/env";

export const adminApi: AdminApi =
  apiRuntimeMode === "http" ? new HttpAdminApi() : new MockAdminApi();
