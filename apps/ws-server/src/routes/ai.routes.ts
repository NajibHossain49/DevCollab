import { Router, type Request, type Response } from "express";

import { logger } from "../config/logger.js";
import { verifyAuth } from "../middleware/auth.js";
import { aiExplainLimiter, aiLimiter } from "../middleware/rate-limit.js";
import { validate } from "../middleware/validate.js";
import { explainCode, getCompletion } from "../services/ai.service.js";
import { asyncHandler, getUser } from "../utils/async-handler.js";
import { aiCompleteSchema, aiExplainSchema } from "../utils/validators.js";
import type { ApiResponse } from "../types/index.js";

const router = Router();

// Every AI route requires authentication.
router.use(verifyAuth);

// POST /api/ai/complete — streams completion tokens as Server-Sent Events.
router.post(
  "/complete",
  aiLimiter,
  validate(aiCompleteSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { code, language, cursorPosition } = aiCompleteSchema.parse(req.body);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      for await (const token of getCompletion(code, language, cursorPosition)) {
        res.write(`data: ${JSON.stringify({ completion: token })}\n\n`);
      }
      res.write("data: [DONE]\n\n");
    } catch (error) {
      logger.error({ error, userId: user.id }, "AI completion stream failed");
      res.write(`data: ${JSON.stringify({ error: "AI_STREAM_ERROR" })}\n\n`);
    } finally {
      res.end();
    }
  }),
);

// POST /api/ai/explain — returns a one-shot explanation.
router.post(
  "/explain",
  aiExplainLimiter,
  validate(aiExplainSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    getUser(req);
    const { code, language } = aiExplainSchema.parse(req.body);
    const explanation = await explainCode(code, language);

    const body: ApiResponse<{ explanation: string }> = {
      success: true,
      data: { explanation },
    };
    res.status(200).json(body);
  }),
);

export default router;
