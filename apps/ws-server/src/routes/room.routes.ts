import { MemberRole, type Room, type RoomMember } from "@prisma/client";
import { Router, type Request, type Response } from "express";

import { requireRole, verifyAuth } from "../middleware/auth.js";
import { roomCreateLimiter } from "../middleware/rate-limit.js";
import { validate, validateParams, validateQuery } from "../middleware/validate.js";
import {
  createRoom,
  deleteRoom,
  getRoomBySlug,
  getUserRooms,
  joinRoom,
  leaveRoom,
  removeMember,
  updateMemberRole,
  updateRoom,
} from "../services/room.service.js";
import { asyncHandler, getUser } from "../utils/async-handler.js";
import { ValidationError } from "../utils/errors.js";
import {
  createRoomSchema,
  memberRoleSchema,
  paginationQuerySchema,
  roomSlugSchema,
  updateRoomSchema,
} from "../utils/validators.js";
import type { ApiResponse, PaginationMeta } from "../types/index.js";

const router = Router();

// Every room route requires authentication.
router.use(verifyAuth);

function getTargetUserId(req: Request): string {
  const userId = req.params["userId"];
  if (!userId) {
    throw new ValidationError("Missing userId parameter");
  }
  return userId;
}

// POST /api/rooms
router.post(
  "/",
  roomCreateLimiter,
  validate(createRoomSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const data = createRoomSchema.parse(req.body);
    const room = await createRoom(user.id, data);

    const body: ApiResponse<{ room: Room }> = { success: true, data: { room } };
    res.status(201).json(body);
  }),
);

// GET /api/rooms
router.get(
  "/",
  validateQuery(paginationQuerySchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { page, limit } = paginationQuerySchema.parse(req.query);
    const { rooms, total } = await getUserRooms(user.id, page, limit);

    const meta: PaginationMeta = { page, limit, total };
    const body: ApiResponse<{ rooms: Room[]; meta: PaginationMeta }> = {
      success: true,
      data: { rooms, meta },
    };
    res.status(200).json(body);
  }),
);

// GET /api/rooms/:slug
router.get(
  "/:slug",
  validateParams(roomSlugSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { slug } = roomSlugSchema.parse(req.params);
    const room = await getRoomBySlug(slug);

    const body: ApiResponse<{ room: Room }> = { success: true, data: { room } };
    res.status(200).json(body);
  }),
);

// PUT /api/rooms/:slug
router.put(
  "/:slug",
  validateParams(roomSlugSchema),
  validate(updateRoomSchema),
  requireRole([MemberRole.OWNER]),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { slug } = roomSlugSchema.parse(req.params);
    const data = updateRoomSchema.parse(req.body);
    const room = await updateRoom(slug, user.id, data);

    const body: ApiResponse<{ room: Room }> = { success: true, data: { room } };
    res.status(200).json(body);
  }),
);

// DELETE /api/rooms/:slug
router.delete(
  "/:slug",
  validateParams(roomSlugSchema),
  requireRole([MemberRole.OWNER]),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { slug } = roomSlugSchema.parse(req.params);
    await deleteRoom(slug, user.id);

    const body: ApiResponse<never> = { success: true };
    res.status(200).json(body);
  }),
);

// POST /api/rooms/:slug/join
router.post(
  "/:slug/join",
  validateParams(roomSlugSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { slug } = roomSlugSchema.parse(req.params);
    const room = await getRoomBySlug(slug);
    const membership = await joinRoom(room.id, user.id);

    const body: ApiResponse<{ membership: RoomMember }> = {
      success: true,
      data: { membership },
    };
    res.status(201).json(body);
  }),
);

// POST /api/rooms/:slug/leave
router.post(
  "/:slug/leave",
  validateParams(roomSlugSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { slug } = roomSlugSchema.parse(req.params);
    const room = await getRoomBySlug(slug);
    await leaveRoom(room.id, user.id);

    const body: ApiResponse<never> = { success: true };
    res.status(200).json(body);
  }),
);

// POST /api/rooms/:slug/members/:userId/role
router.post(
  "/:slug/members/:userId/role",
  validateParams(roomSlugSchema),
  validate(memberRoleSchema),
  requireRole([MemberRole.OWNER]),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const membership = req.membership;
    if (!membership) {
      throw new ValidationError("Room context missing");
    }
    const targetUserId = getTargetUserId(req);
    const { role } = memberRoleSchema.parse(req.body);
    const updated = await updateMemberRole(membership.roomId, user.id, targetUserId, role);

    const body: ApiResponse<{ membership: RoomMember }> = {
      success: true,
      data: { membership: updated },
    };
    res.status(200).json(body);
  }),
);

// DELETE /api/rooms/:slug/members/:userId
router.delete(
  "/:slug/members/:userId",
  validateParams(roomSlugSchema),
  requireRole([MemberRole.OWNER]),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const membership = req.membership;
    if (!membership) {
      throw new ValidationError("Room context missing");
    }
    const targetUserId = getTargetUserId(req);
    await removeMember(membership.roomId, user.id, targetUserId);

    const body: ApiResponse<never> = { success: true };
    res.status(200).json(body);
  }),
);

export default router;
