import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_API_BASE_URL: z
      .string()
      .trim()
      .min(1, "VITE_API_BASE_URL is required"),
    VITE_API_TIMEOUT_MS: z
      .string()
      .default("10000")
      .transform((value) => Number.parseInt(value, 10))
      .pipe(z.number().int().positive()),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: false,
});
