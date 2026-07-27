import { MemberRole } from "@prisma/client";
import { z } from "zod";

// Languages supported across rooms and execution (see .cursor/rules.md 10.5).
export const SUPPORTED_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "java",
  "cpp",
  "go",
  "rust",
] as const;

export const languageSchema = z.enum(SUPPORTED_LANGUAGES);

// ============================================
// ROOM SCHEMAS
// ============================================
export const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  language: languageSchema.default("javascript"),
  isPublic: z.boolean().default(true),
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const updateRoomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  language: languageSchema.optional(),
  isPublic: z.boolean().optional(),
});
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;

export const roomSlugSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase, alphanumeric, and hyphen-separated"),
});
export type RoomSlugParams = z.infer<typeof roomSlugSchema>;

// ============================================
// AUTH SCHEMAS
// ============================================
export const githubCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
export type GithubCallbackInput = z.infer<typeof githubCallbackSchema>;

// ============================================
// EXECUTION SCHEMAS
// ============================================
export const executeCodeSchema = z.object({
  roomId: z.string().uuid(),
  code: z.string(),
  language: languageSchema,
});
export type ExecuteCodeInput = z.infer<typeof executeCodeSchema>;

// ============================================
// AI SCHEMAS
// ============================================
const cursorPositionSchema = z.object({
  line: z.number().int().nonnegative(),
  ch: z.number().int().nonnegative(),
});

export const aiCompleteSchema = z.object({
  code: z.string(),
  language: z.string().min(1),
  cursorPosition: cursorPositionSchema,
});
export type AiCompleteInput = z.infer<typeof aiCompleteSchema>;

export const aiExplainSchema = z.object({
  code: z.string(),
  language: z.string().min(1),
});
export type AiExplainInput = z.infer<typeof aiExplainSchema>;

// ============================================
// SHARED QUERY / PARAM SCHEMAS
// ============================================
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const memberRoleSchema = z.object({
  role: z.nativeEnum(MemberRole),
});
export type MemberRoleInput = z.infer<typeof memberRoleSchema>;

export const roomIdParamSchema = z.object({
  roomId: z.string().uuid(),
});
export type RoomIdParam = z.infer<typeof roomIdParamSchema>;

export const signinSchema = z.object({
  provider: z.literal("github"),
});
export type SigninInput = z.infer<typeof signinSchema>;
