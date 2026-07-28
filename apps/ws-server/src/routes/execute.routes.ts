import { MemberRole, type Execution } from "@prisma/client";
import { Router, type Request, type Response } from "express";

import { requireRole, verifyAuth } from "../middleware/auth.js";
import { executionLimiter } from "../middleware/rate-limit.js";
import { validate, validateParams, validateQuery } from "../middleware/validate.js";
import {
  clearExecutionHistory,
  executeCode,
  getExecutionHistory,
} from "../services/execution.service.js";
import { asyncHandler, getUser } from "../utils/async-handler.js";
import {
  executeCodeSchema,
  paginationQuerySchema,
  roomIdParamSchema,
} from "../utils/validators.js";
import type { ApiResponse, PaginationMeta } from "../types/index.js";

const router = Router();

// Every execution route requires authentication.
router.use(verifyAuth);

// POST /api/execute
router.post(
  "/",
  executionLimiter,
  validate(executeCodeSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { roomId, code, language } = executeCodeSchema.parse(req.body);
    const execution = await executeCode(roomId, user.id, code, language);

    const body: ApiResponse<{ execution: Execution }> = {
      success: true,
      data: { execution },
    };
    res.status(200).json(body);
  }),
);

// GET /api/execute/history/:roomId
router.get(
  "/history/:roomId",
  validateParams(roomIdParamSchema),
  validateQuery(paginationQuerySchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { roomId } = roomIdParamSchema.parse(req.params);
    const { page, limit } = paginationQuerySchema.parse(req.query);
    const { executions, total } = await getExecutionHistory(roomId, page, limit);

    const meta: PaginationMeta = { page, limit, total };
    const body: ApiResponse<{ executions: Execution[]; meta: PaginationMeta }> = {
      success: true,
      data: { executions, meta },
    };
    res.status(200).json(body);
  }),
);

// DELETE /api/execute/history/:roomId — clears all run history for a room.
// Restricted to the room OWNER (requireRole resolves the room from :roomId).
router.delete(
  "/history/:roomId",
  validateParams(roomIdParamSchema),
  requireRole([MemberRole.OWNER]),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { roomId } = roomIdParamSchema.parse(req.params);
    const cleared = await clearExecutionHistory(roomId);

    const body: ApiResponse<{ cleared: number }> = {
      success: true,
      data: { cleared },
    };
    res.status(200).json(body);
  }),
);

export default router;
