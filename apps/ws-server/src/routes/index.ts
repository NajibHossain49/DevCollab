import { Router } from "express";

import aiRoutes from "./ai.routes.js";
import authRoutes from "./auth.routes.js";
import executeRoutes from "./execute.routes.js";
import roomRoutes from "./room.routes.js";

// Aggregates all API sub-routers. Mounted under /api in app.ts.
const router = Router();

router.use("/auth", authRoutes);
router.use("/rooms", roomRoutes);
router.use("/execute", executeRoutes);
router.use("/ai", aiRoutes);

export default router;
