import type { Organization, OrganizationMember } from "@prisma/client";
import { Router, type Request, type Response } from "express";

import { verifyAuth } from "../middleware/auth.js";
import { validate, validateParams } from "../middleware/validate.js";
import {
  acceptInvite,
  createOrganization,
  getOrganizationBySlug,
  getOrgAnalytics,
  getUserOrganizations,
  inviteMember,
  removeMember,
  updateMemberRole,
  updateOrganization,
  type InviteResult,
  type OrganizationWithMembers,
  type OrgAnalytics,
} from "../services/org.service.js";
import { asyncHandler, getUser } from "../utils/async-handler.js";
import {
  acceptInviteSchema,
  createOrgSchema,
  inviteMemberSchema,
  orgMemberRoleSchema,
  orgSlugSchema,
  orgUserIdParamSchema,
  updateOrgSchema,
} from "../utils/validators.js";
import type { ApiResponse } from "../types/index.js";

const router = Router();

// Every organization route requires authentication.
router.use(verifyAuth);

// POST /api/orgs — create an organization.
router.post(
  "/",
  validate(createOrgSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { name } = createOrgSchema.parse(req.body);
    const organization = await createOrganization(user.id, name);

    const body: ApiResponse<{ organization: Organization }> = {
      success: true,
      data: { organization },
    };
    res.status(201).json(body);
  }),
);

// GET /api/orgs — list organizations the current user belongs to.
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const organizations = await getUserOrganizations(user.id);

    const body: ApiResponse<{ organizations: Organization[] }> = {
      success: true,
      data: { organizations },
    };
    res.status(200).json(body);
  }),
);

// POST /api/orgs/invite/accept — accept an invite token.
// Declared before "/:slug" routes so the literal path isn't shadowed.
router.post(
  "/invite/accept",
  validate(acceptInviteSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { token } = acceptInviteSchema.parse(req.body);
    const membership = await acceptInvite(token, user);

    const body: ApiResponse<{ membership: OrganizationMember }> = {
      success: true,
      data: { membership },
    };
    res.status(200).json(body);
  }),
);

// GET /api/orgs/:slug — get an organization with its members.
router.get(
  "/:slug",
  validateParams(orgSlugSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { slug } = orgSlugSchema.parse(req.params);
    const organization = await getOrganizationBySlug(slug);

    const body: ApiResponse<{ organization: OrganizationWithMembers }> = {
      success: true,
      data: { organization },
    };
    res.status(200).json(body);
  }),
);

// PUT /api/orgs/:slug — update organization name / slug.
router.put(
  "/:slug",
  validateParams(orgSlugSchema),
  validate(updateOrgSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { slug } = orgSlugSchema.parse(req.params);
    const data = updateOrgSchema.parse(req.body);
    const organization = await updateOrganization(slug, user.id, data);

    const body: ApiResponse<{ organization: Organization }> = {
      success: true,
      data: { organization },
    };
    res.status(200).json(body);
  }),
);

// GET /api/orgs/:slug/analytics — organization analytics.
router.get(
  "/:slug/analytics",
  validateParams(orgSlugSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { slug } = orgSlugSchema.parse(req.params);
    const analytics = await getOrgAnalytics(slug, user.id);

    const body: ApiResponse<{ analytics: OrgAnalytics }> = {
      success: true,
      data: { analytics },
    };
    res.status(200).json(body);
  }),
);

// POST /api/orgs/:slug/invite — invite a member by email.
router.post(
  "/:slug/invite",
  validateParams(orgSlugSchema),
  validate(inviteMemberSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { slug } = orgSlugSchema.parse(req.params);
    const { email, role } = inviteMemberSchema.parse(req.body);
    const invite = await inviteMember(slug, user.id, email, role);

    const body: ApiResponse<{ invite: InviteResult }> = {
      success: true,
      data: { invite },
    };
    res.status(201).json(body);
  }),
);

// PUT /api/orgs/:slug/members/:userId/role — change a member's role.
router.put(
  "/:slug/members/:userId/role",
  validateParams(orgUserIdParamSchema),
  validate(orgMemberRoleSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { slug, userId } = orgUserIdParamSchema.parse(req.params);
    const { role } = orgMemberRoleSchema.parse(req.body);
    const membership = await updateMemberRole(slug, user.id, userId, role);

    const body: ApiResponse<{ membership: OrganizationMember }> = {
      success: true,
      data: { membership },
    };
    res.status(200).json(body);
  }),
);

// DELETE /api/orgs/:slug/members/:userId — remove a member.
router.delete(
  "/:slug/members/:userId",
  validateParams(orgUserIdParamSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { slug, userId } = orgUserIdParamSchema.parse(req.params);
    await removeMember(slug, user.id, userId);

    const body: ApiResponse<never> = { success: true };
    res.status(200).json(body);
  }),
);

export default router;
