import { Router } from "express";

import aiRoutes from "./ai.routes.js";
import authRoutes from "./auth.routes.js";
import billingRoutes, { billingWebhookRouter } from "./billing.routes.js";
import executeRoutes from "./execute.routes.js";
import orgRoutes from "./org.routes.js";
import roomRoutes from "./room.routes.js";

// Aggregates all API sub-routers. Mounted under /api in app.ts.
const router = Router();

router.use("/auth", authRoutes);
router.use("/rooms", roomRoutes);
router.use("/orgs", orgRoutes);
// Org-scoped billing endpoints share the /orgs/:slug prefix.
router.use("/orgs", billingRoutes);
// Stripe webhook receiver (no auth; raw body handled in app.ts).
router.use("/billing", billingWebhookRouter);
router.use("/execute", executeRoutes);
router.use("/ai", aiRoutes);

export default router;
