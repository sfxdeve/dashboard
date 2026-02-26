import { z } from "zod";

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().trim().min(1, "VITE_API_BASE_URL is required"),
  VITE_API_TIMEOUT_MS: z
    .string()
    .default("10000")
    .transform((value) => Number.parseInt(value, 10))
    .pipe(z.number().int().positive()),
});

const parsed = envSchema.safeParse(import.meta.env);
if (!parsed.success) {
  const reason = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment: ${reason}`);
}

export const env = parsed.data;
