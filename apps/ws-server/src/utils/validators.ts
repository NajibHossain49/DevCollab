import { MemberRole, OrgRole } from "@prisma/client";
import { z } from "zod";

// Git provider slug as used in URLs and the client (lowercase). Mapped to the
// Prisma GitProvider enum server-side.
export const GIT_PROVIDER_SLUGS = ["github", "gitlab", "bitbucket"] as const;
export const gitProviderSlugSchema = z.enum(GIT_PROVIDER_SLUGS);
export type GitProviderSlug = z.infer<typeof gitProviderSlugSchema>;

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

// Email/password credential auth.
const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(255)
  .email("Enter a valid email address")
  .toLowerCase();

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters"); // bcrypt truncates beyond 72 bytes

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ============================================
// ORGANIZATION SCHEMAS
// ============================================
export const orgSlugSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase, alphanumeric, and hyphen-separated",
    ),
});
export type OrgSlugParams = z.infer<typeof orgSlugSchema>;

export const createOrgSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required").max(100),
});
export type CreateOrgInput = z.infer<typeof createOrgSchema>;

export const updateOrgSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    slug: orgSlugSchema.shape.slug.optional(),
  })
  .refine((data) => data.name !== undefined || data.slug !== undefined, {
    message: "Provide at least one field to update",
  });
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;

// Only ADMIN or MEMBER can be assigned via invite / role change; ownership is
// transferred through a dedicated flow, never assigned directly.
const assignableOrgRoleSchema = z
  .nativeEnum(OrgRole)
  .refine((role) => role !== OrgRole.OWNER, {
    message: "Role must be ADMIN or MEMBER",
  });

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: assignableOrgRoleSchema.default(OrgRole.MEMBER),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(1, "Invite token is required"),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const orgMemberRoleSchema = z.object({
  role: assignableOrgRoleSchema,
});
export type OrgMemberRoleInput = z.infer<typeof orgMemberRoleSchema>;

export const orgUserIdParamSchema = z.object({
  slug: orgSlugSchema.shape.slug,
  userId: z.string().uuid(),
});
export type OrgUserIdParams = z.infer<typeof orgUserIdParamSchema>;

// ============================================
// BILLING SCHEMAS
// ============================================
export const verifyCheckoutSchema = z.object({
  sessionId: z.string().min(1, "Checkout session id is required"),
});
export type VerifyCheckoutInput = z.infer<typeof verifyCheckoutSchema>;

// ============================================
// GIT INTEGRATION SCHEMAS
// ============================================
export const gitProviderParamSchema = z.object({
  provider: gitProviderSlugSchema,
});
export type GitProviderParams = z.infer<typeof gitProviderParamSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
export type IdParams = z.infer<typeof idParamSchema>;

export const linkRepoSchema = z.object({
  roomId: z.string().uuid(),
});
export type LinkRepoInput = z.infer<typeof linkRepoSchema>;

export const syncRepoSchema = z.object({
  roomId: z.string().uuid(),
  direction: z.enum(["toRepo", "toRoom"]).default("toRepo"),
  branch: z.string().min(1).max(200).optional(),
  commitMessage: z.string().max(500).optional(),
});
export type SyncRepoInput = z.infer<typeof syncRepoSchema>;

export const repoFilesQuerySchema = z.object({
  path: z.string().max(400).optional(),
  branch: z.string().min(1).max(200).optional(),
});
export type RepoFilesQuery = z.infer<typeof repoFilesQuerySchema>;

export const fileContentQuerySchema = z.object({
  path: z.string().min(1).max(400),
  branch: z.string().min(1).max(200).optional(),
});
export type FileContentQuery = z.infer<typeof fileContentQuerySchema>;

export const createPullRequestSchema = z.object({
  roomId: z.string().uuid(),
  title: z.string().trim().min(1).max(256),
  description: z.string().max(10000).optional(),
  headBranch: z.string().min(1).max(200).optional(),
  baseBranch: z.string().min(1).max(200).optional(),
});
export type CreatePullRequestInput = z.infer<typeof createPullRequestSchema>;

const gitStateSchema = z.enum(["open", "closed", "all"]).default("open");

export const listByRoomQuerySchema = z.object({
  roomId: z.string().uuid(),
  state: gitStateSchema,
});
export type ListByRoomQuery = z.infer<typeof listByRoomQuerySchema>;

export const commitsQuerySchema = z.object({
  roomId: z.string().uuid(),
  branch: z.string().min(1).max(200).optional(),
});
export type CommitsQuery = z.infer<typeof commitsQuerySchema>;

export const createIssueSchema = z.object({
  roomId: z.string().uuid(),
  title: z.string().trim().min(1).max(256),
  body: z.string().max(10000).optional(),
});
export type CreateIssueInput = z.infer<typeof createIssueSchema>;
