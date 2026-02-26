import type { AdminApi } from "~/lib/api/contracts";
import { HttpAdminApi } from "~/lib/api/http-admin-api";

export const adminApi: AdminApi = new HttpAdminApi();
