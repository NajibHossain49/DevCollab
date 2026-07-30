import {
  OrgRole,
  Prisma,
  type Organization,
  type OrganizationMember,
  type User,
} from "@prisma/client";
import jwt from "jsonwebtoken";

import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import {
  sendInviteEmail,
  sendRoleChangeEmail,
  sendWelcomeEmail,
  type EmailStatus,
} from "./email.service.js";
import {
  AppError,
  ConflictError,
  DatabaseError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../utils/errors.js";

// Invite tokens are short-lived JWTs signed with the shared auth secret, tagged
// with a dedicated purpose so they can't be confused with session tokens.
const INVITE_TOKEN_PURPOSE = "org_invite";
const INVITE_TOKEN_EXPIRES_IN = "7d";

interface InvitePayload {
  purpose: typeof INVITE_TOKEN_PURPOSE;
  orgId: string;
  email: string;
  role: OrgRole;
  invitedBy: string;
}

function webBaseUrl(): string {
  return env.WEB_APP_URL ?? env.NEXTAUTH_URL;
}

// ---------------------------------------------------------------------------
// Slug generation (mirrors room.service).
// ---------------------------------------------------------------------------
function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base.length > 0 ? base : "org";
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) {
      return slug;
    }
    const suffix = Math.random().toString(36).slice(2, 6);
    slug = `${base}-${suffix}`;
  }

  return `${base}-${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Authorization helpers.
// ---------------------------------------------------------------------------
const MANAGER_ROLES: OrgRole[] = [OrgRole.OWNER, OrgRole.ADMIN];

async function getOrgBySlugOrThrow(slug: string): Promise<Organization> {
  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) {
    throw new NotFoundError("Organization");
  }
  return org;
}

async function getMembershipOrThrow(
  organizationId: string,
  userId: string,
): Promise<OrganizationMember> {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (!membership) {
    throw new ForbiddenError("You are not a member of this organization");
  }
  return membership;
}

async function requireManager(
  organizationId: string,
  userId: string,
): Promise<OrganizationMember> {
  const membership = await getMembershipOrThrow(organizationId, userId);
  if (!MANAGER_ROLES.includes(membership.role)) {
    throw new ForbiddenError("Only owners and admins can perform this action");
  }
  return membership;
}

// ---------------------------------------------------------------------------
// Types returned to callers.
// ---------------------------------------------------------------------------
export type OrganizationWithMembers = Organization & {
  owner: User;
  members: (OrganizationMember & { user: User })[];
};

export interface OrgAnalytics {
  totalMembers: number;
  activeRooms: number;
  totalRooms: number;
  totalExecutions: number;
  codingHours: number;
}

export interface InviteResult {
  email: string;
  role: OrgRole;
  token: string;
  inviteLink: string;
  emailStatus: EmailStatus;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
export async function createOrganization(
  userId: string,
  name: string,
): Promise<Organization> {
  try {
    const slug = await generateUniqueSlug(name);

    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: { name, slug, ownerId: userId },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: created.id,
          userId,
          role: OrgRole.OWNER,
          invitedBy: userId,
          joinedAt: new Date(),
        },
      });

      return created;
    });

    logger.info({ orgId: org.id, slug: org.slug, userId }, "Organization created");
    return org;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ error, userId }, "Failed to create organization");
    throw new DatabaseError("Failed to create organization");
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------
export async function getOrganizationBySlug(
  slug: string,
): Promise<OrganizationWithMembers> {
  try {
    const org = await prisma.organization.findUnique({
      where: { slug },
      include: {
        owner: true,
        members: {
          include: { user: true },
          orderBy: { invitedAt: "asc" },
        },
      },
    });

    if (!org) {
      throw new NotFoundError("Organization");
    }

    return org;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ error, slug }, "Failed to get organization by slug");
    throw new DatabaseError("Failed to retrieve organization");
  }
}

// Lists organizations the user belongs to (for the org switcher).
export async function getUserOrganizations(userId: string): Promise<Organization[]> {
  try {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { invitedAt: "asc" },
    });
    return memberships.map((m) => m.organization);
  } catch (error) {
    logger.error({ error, userId }, "Failed to list user organizations");
    throw new DatabaseError("Failed to list organizations");
  }
}

// ---------------------------------------------------------------------------
// Invite
// ---------------------------------------------------------------------------
export async function inviteMember(
  slug: string,
  invitedByUserId: string,
  email: string,
  role: OrgRole,
): Promise<InviteResult> {
  try {
    const org = await getOrgBySlugOrThrow(slug);
    await requireManager(org.id, invitedByUserId);

    // If the email already maps to a user who is already a member, don't
    // re-invite them.
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      const alreadyMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId: org.id, userId: existingUser.id },
        },
        select: { id: true },
      });
      if (alreadyMember) {
        throw new ConflictError("This user is already a member of the organization");
      }
    }

    const payload: InvitePayload = {
      purpose: INVITE_TOKEN_PURPOSE,
      orgId: org.id,
      email,
      role,
      invitedBy: invitedByUserId,
    };
    const token = jwt.sign(payload, env.NEXTAUTH_SECRET, {
      expiresIn: INVITE_TOKEN_EXPIRES_IN,
    });

    const inviteLink = `${webBaseUrl()}/orgs/invite?token=${encodeURIComponent(token)}`;

    const emailResult = await sendInviteEmail(email, org.name, inviteLink);

    logger.info(
      { orgId: org.id, email, role, invitedByUserId, emailStatus: emailResult.status },
      "Organization invite created",
    );

    return { email, role, token, inviteLink, emailStatus: emailResult.status };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ error, slug, email }, "Failed to invite member");
    throw new DatabaseError("Failed to invite member");
  }
}

// ---------------------------------------------------------------------------
// Accept invite
// ---------------------------------------------------------------------------
export async function acceptInvite(
  token: string,
  user: User,
): Promise<OrganizationMember> {
  let payload: InvitePayload;
  try {
    const decoded = jwt.verify(token, env.NEXTAUTH_SECRET);
    if (typeof decoded === "string" || decoded.purpose !== INVITE_TOKEN_PURPOSE) {
      throw new UnauthorizedError("Invalid invite token");
    }
    payload = decoded as unknown as InvitePayload;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new UnauthorizedError("Invite link is invalid or has expired");
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: payload.orgId },
    });
    if (!org) {
      throw new NotFoundError("Organization");
    }

    const existing = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: org.id, userId: user.id },
      },
    });
    if (existing) {
      // Idempotent: accepting again just returns the current membership.
      logger.info({ orgId: org.id, userId: user.id }, "Invite accept: already a member");
      return existing;
    }

    const membership = await prisma.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        role: payload.role,
        invitedBy: payload.invitedBy,
        joinedAt: new Date(),
      },
    });

    // Best-effort welcome email; never blocks acceptance.
    void sendWelcomeEmail(user.email, org.name);

    logger.info(
      { orgId: org.id, userId: user.id, role: payload.role },
      "Invite accepted",
    );
    return membership;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Concurrent accept — fetch and return the existing membership.
      const existing = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId: payload.orgId, userId: user.id },
        },
      });
      if (existing) {
        return existing;
      }
    }
    logger.error({ error, orgId: payload.orgId, userId: user.id }, "Failed to accept invite");
    throw new DatabaseError("Failed to accept invite");
  }
}

// ---------------------------------------------------------------------------
// Update member role
// ---------------------------------------------------------------------------
export async function updateMemberRole(
  slug: string,
  actingUserId: string,
  targetUserId: string,
  role: OrgRole,
): Promise<OrganizationMember> {
  try {
    if (role === OrgRole.OWNER) {
      throw new ValidationError("Ownership must be transferred, not assigned");
    }

    const org = await getOrgBySlugOrThrow(slug);
    await requireManager(org.id, actingUserId);

    if (targetUserId === org.ownerId) {
      throw new ForbiddenError("The owner's role cannot be changed");
    }

    const target = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: org.id, userId: targetUserId },
      },
      include: { user: true },
    });
    if (!target) {
      throw new NotFoundError("Member");
    }

    const updated = await prisma.organizationMember.update({
      where: {
        organizationId_userId: { organizationId: org.id, userId: targetUserId },
      },
      data: { role },
    });

    void sendRoleChangeEmail(target.user.email, org.name, role);

    logger.info(
      { orgId: org.id, actingUserId, targetUserId, role },
      "Organization member role updated",
    );
    return updated;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ error, slug, targetUserId }, "Failed to update member role");
    throw new DatabaseError("Failed to update member role");
  }
}

// ---------------------------------------------------------------------------
// Remove member
// ---------------------------------------------------------------------------
export async function removeMember(
  slug: string,
  actingUserId: string,
  targetUserId: string,
): Promise<void> {
  try {
    const org = await getOrgBySlugOrThrow(slug);
    await requireManager(org.id, actingUserId);

    if (targetUserId === org.ownerId) {
      throw new ForbiddenError(
        "The owner cannot be removed; transfer ownership first",
      );
    }

    await prisma.organizationMember.delete({
      where: {
        organizationId_userId: { organizationId: org.id, userId: targetUserId },
      },
    });

    logger.info({ orgId: org.id, actingUserId, targetUserId }, "Organization member removed");
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Member");
    }
    logger.error({ error, slug, targetUserId }, "Failed to remove member");
    throw new DatabaseError("Failed to remove member");
  }
}

// ---------------------------------------------------------------------------
// Update organization (name / slug)
// ---------------------------------------------------------------------------
export async function updateOrganization(
  slug: string,
  actingUserId: string,
  data: { name?: string; slug?: string },
): Promise<Organization> {
  try {
    const org = await getOrgBySlugOrThrow(slug);
    await requireManager(org.id, actingUserId);

    if (data.slug && data.slug !== org.slug) {
      const clash = await prisma.organization.findUnique({
        where: { slug: data.slug },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictError("That slug is already taken");
      }
    }

    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: {
        name: data.name ?? undefined,
        slug: data.slug ?? undefined,
      },
    });

    logger.info({ orgId: org.id, actingUserId }, "Organization updated");
    return updated;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("That slug is already taken");
    }
    logger.error({ error, slug }, "Failed to update organization");
    throw new DatabaseError("Failed to update organization");
  }
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
export async function getOrgAnalytics(
  slug: string,
  actingUserId: string,
): Promise<OrgAnalytics> {
  try {
    const org = await getOrgBySlugOrThrow(slug);
    // Any member can view analytics.
    await getMembershipOrThrow(org.id, actingUserId);

    const [totalMembers, totalRooms, execAggregate, totalExecutions] =
      await prisma.$transaction([
        prisma.organizationMember.count({ where: { organizationId: org.id } }),
        prisma.room.count({ where: { organizationId: org.id } }),
        prisma.execution.aggregate({
          where: { room: { organizationId: org.id } },
          _sum: { executionTime: true },
        }),
        prisma.execution.count({ where: { room: { organizationId: org.id } } }),
      ]);

    // "Active rooms" = rooms updated within the last 7 days.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeRooms = await prisma.room.count({
      where: { organizationId: org.id, updatedAt: { gte: sevenDaysAgo } },
    });

    const executionMs = execAggregate._sum.executionTime ?? 0;
    const codingHours = Math.round((executionMs / (1000 * 60 * 60)) * 100) / 100;

    return {
      totalMembers,
      activeRooms,
      totalRooms,
      totalExecutions,
      codingHours,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ error, slug }, "Failed to get organization analytics");
    throw new DatabaseError("Failed to retrieve analytics");
  }
}
