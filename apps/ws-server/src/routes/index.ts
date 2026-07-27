import { Router, type NextFunction, type Request, type Response } from "express";

import { logger } from "../config/logger.js";
import { errorHandler } from "../middleware/error-handler.js";
import type { ApiResponse } from "../types/index.js";
import aiRoutes from "./ai.routes.js";
import authRoutes from "./auth.routes.js";
import executeRoutes from "./execute.routes.js";
import roomRoutes from "./room.routes.js";

const router = Router();

// Structured request logging: method, path, status, userId, duration.
router.use((req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info(
      {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        userId: req.user?.id,
        durationMs: Date.now() - start,
      },
      "request",
    );
  });
  next();
});

router.use("/api/auth", authRoutes);
router.use("/api/rooms", roomRoutes);
router.use("/api/execute", executeRoutes);
router.use("/api/ai", aiRoutes);

// Unknown route fallback.
router.use((_req: Request, res: Response): void => {
  const body: ApiResponse<never> = {
    success: false,
    error: { code: "NOT_FOUND", message: "Route not found" },
  };
  res.status(404).json(body);
});

// Centralized error handler (must be registered last).
router.use(errorHandler);

export default router;
