import { z } from "zod";

export const errorCodes = {
  invalidInput: 40000,
  unauthenticated: 40100,
  forbidden: 40300,
  notFound: 40400,
  conflict: 40900,
  gone: 41000,
  businessRule: 42200,
  rateLimited: 42900,
  internal: 50000,
  upstreamProtocol: 50200,
  unavailable: 50300,
  timeout: 50400,
} as const;
export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes];
export type Recovery =
  "none" | "reauthenticate" | "refresh" | "observe" | "retry";
export const apiFailure = z.object({
  code: z.number().int().positive(),
  msg: z.string(),
  data: z.null(),
  requestId: z.string(),
  recovery: z.enum(["none", "reauthenticate", "refresh", "observe", "retry"]),
  issues: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .optional(),
});
export type ApiFailure = z.infer<typeof apiFailure>;
export type ApiResponse<T> =
  { code: 0; msg: "success"; data: T; requestId: string } | ApiFailure;
export const pageInput = z.object({
  cursor: z.string().max(2000).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type Page<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};
