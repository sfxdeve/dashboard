import { z } from "zod";

const ISO_DATE_MESSAGE = "Use a valid ISO date/time";
const DATE_ONLY_MESSAGE = "Use a valid date (YYYY-MM-DD)";

function isoDate(value: string) {
  return Number.isFinite(Date.parse(value));
}

function dateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function numberFromString(label: string, min: number) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine(
      (value) => !Number.isNaN(Number(value)),
      `${label} must be a number`,
    )
    .transform((value) => Number(value))
    .pipe(z.number().int().min(min, `${label} must be >= ${min}`));
}

export const seasonSchema = z.object({
  name: z.string().trim().min(3, "Season name must be at least 3 characters"),
  year: numberFromString("Year", 2020),
});

export const tournamentSchema = z.object({
  seasonId: z.string().trim().min(1, "Season is required"),
  name: z
    .string()
    .trim()
    .min(3, "Tournament name must be at least 3 characters"),
  slug: z
    .string()
    .trim()
    .min(3, "Slug must be at least 3 characters")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug may contain lowercase letters, numbers and hyphens only",
    ),
  location: z.string().trim().min(2, "Location is required"),
  gender: z.enum(["men", "women"], { message: "Select a valid gender" }),
  startDate: z.string().trim().refine(dateOnly, DATE_ONLY_MESSAGE),
  endDate: z.string().trim().refine(dateOnly, DATE_ONLY_MESSAGE),
  rosterSize: numberFromString("Roster size", 1),
  starterCount: numberFromString("Starter count", 1),
  reserveCount: numberFromString("Reserve count", 0),
  lineupLockAt: z.string().trim().refine(isoDate, ISO_DATE_MESSAGE),
  timezone: z.string().trim().min(1, "Timezone is required"),
});

export const matchCreateSchema = z.object({
  phase: z.enum(["qualification", "pools", "main_draw"], {
    message: "Select a valid phase",
  }),
  day: z.enum(["friday", "saturday", "sunday"], {
    message: "Select a valid day",
  }),
  pairAId: z.string().trim().min(1, "Pair A is required"),
  pairBId: z.string().trim().min(1, "Pair B is required"),
  scheduledAt: z.string().trim().refine(isoDate, ISO_DATE_MESSAGE),
});

export const matchScoreSchema = z
  .object({
    set1A: numberFromString("Set 1 A", 0),
    set1B: numberFromString("Set 1 B", 0),
    set2A: numberFromString("Set 2 A", 0),
    set2B: numberFromString("Set 2 B", 0),
    set3A: z.string().trim().optional(),
    set3B: z.string().trim().optional(),
  })
  .superRefine((value, context) => {
    const hasThirdA = Boolean(value.set3A);
    const hasThirdB = Boolean(value.set3B);
    if (hasThirdA !== hasThirdB) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Set 3 scores must be provided for both sides",
        path: ["set3A"],
      });
    }
    if (hasThirdA && hasThirdB) {
      const asNumber = Number(value.set3A);
      const bsNumber = Number(value.set3B);
      if (Number.isNaN(asNumber) || Number.isNaN(bsNumber)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Set 3 scores must be valid numbers",
          path: ["set3A"],
        });
      }
    }
  });

export const scoringConfigSchema = z.object({
  basePointMultiplier: numberFromString("Base multiplier", 1),
  bonusWin20: numberFromString("2-0 bonus", 0),
  bonusWin21: numberFromString("2-1 bonus", 0),
});

export const lineupPolicySchema = z
  .object({
    rosterSize: numberFromString("Roster size", 1),
    starterCount: numberFromString("Starter count", 1),
    reserveCount: numberFromString("Reserve count", 0),
    lineupLockAt: z.string().trim().refine(isoDate, ISO_DATE_MESSAGE),
  })
  .superRefine((value, context) => {
    if (value.starterCount + value.reserveCount > value.rosterSize) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Starters + reserves cannot exceed roster size",
        path: ["starterCount"],
      });
    }
  });

export const leagueSchema = z.object({
  seasonId: z.string().trim().min(1, "Season is required"),
  name: z.string().trim().min(3, "League name must be at least 3 characters"),
  mode: z.enum(["overall", "head_to_head"], {
    message: "Select a valid league mode",
  }),
});

export const walletPackSchema = z.object({
  name: z.string().trim().min(2, "Pack name must be at least 2 characters"),
  credits: numberFromString("Credits", 1),
  priceCents: numberFromString("Price cents", 1),
});

export const campaignSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters"),
  body: z.string().trim().min(5, "Body must be at least 5 characters"),
  audience: z.enum(["all", "active_users", "season_users"], {
    message: "Select a valid audience",
  }),
});

export type FieldErrors = Record<string, string>;

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const next: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !next[key]) {
      next[key] = issue.message;
    }
  }
  return next;
}
