import { Router, type Request, type Response } from "express";

import { verifyAuth } from "../middleware/auth.js";
import {
  createCheckoutSession,
  createPortalSession,
  getBillingStatus,
  handleWebhook,
  verifyCheckoutSession,
  type BillingStatus,
} from "../services/billing.service.js";
import { asyncHandler, getUser } from "../utils/async-handler.js";
import { orgSlugSchema, verifyCheckoutSchema } from "../utils/validators.js";
import { validate, validateParams } from "../middleware/validate.js";
import type { ApiResponse } from "../types/index.js";

// ---------------------------------------------------------------------------
// Org-scoped billing routes. Mounted at /api/orgs (alongside org.routes),
// so paths resolve to /api/orgs/:slug/billing/*. All require authentication.
// ---------------------------------------------------------------------------
const orgBillingRouter = Router();
orgBillingRouter.use(verifyAuth);

// GET /api/orgs/:slug/billing — current plan & subscription status.
orgBillingRouter.get(
  "/:slug/billing",
  validateParams(orgSlugSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { slug } = orgSlugSchema.parse(req.params);
    const billing = await getBillingStatus(slug, user.id);

    const body: ApiResponse<{ billing: BillingStatus }> = {
      success: true,
      data: { billing },
    };
    res.status(200).json(body);
  }),
);

// POST /api/orgs/:slug/billing/checkout — start a Stripe Checkout for Pro.
orgBillingRouter.post(
  "/:slug/billing/checkout",
  validateParams(orgSlugSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { slug } = orgSlugSchema.parse(req.params);
    const { url } = await createCheckoutSession(slug, user.id);

    const body: ApiResponse<{ url: string }> = { success: true, data: { url } };
    res.status(200).json(body);
  }),
);

// POST /api/orgs/:slug/billing/portal — open the Stripe billing portal.
orgBillingRouter.post(
  "/:slug/billing/portal",
  validateParams(orgSlugSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { slug } = orgSlugSchema.parse(req.params);
    const { url } = await createPortalSession(slug, user.id);

    const body: ApiResponse<{ url: string }> = { success: true, data: { url } };
    res.status(200).json(body);
  }),
);

// POST /api/orgs/:slug/billing/verify — confirm a completed checkout (test-mode
// webhook-free path; safe/idempotent in production too).
orgBillingRouter.post(
  "/:slug/billing/verify",
  validateParams(orgSlugSchema),
  validate(verifyCheckoutSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { slug } = orgSlugSchema.parse(req.params);
    const { sessionId } = verifyCheckoutSchema.parse(req.body);
    const billing = await verifyCheckoutSession(slug, user.id, sessionId);

    const body: ApiResponse<{ billing: BillingStatus }> = {
      success: true,
      data: { billing },
    };
    res.status(200).json(body);
  }),
);

export default orgBillingRouter;

// ---------------------------------------------------------------------------
// Webhook router. Mounted at /api/billing and NOT behind auth. Requires the
// raw request body (configured in app.ts) for Stripe signature verification.
// ---------------------------------------------------------------------------
export const billingWebhookRouter: Router = Router();

// POST /api/billing/webhook — Stripe event receiver.
billingWebhookRouter.post(
  "/webhook",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const signature = req.headers["stripe-signature"];
    // req.body is a Buffer here thanks to the raw body parser in app.ts.
    await handleWebhook(
      req.body as Buffer,
      typeof signature === "string" ? signature : undefined,
    );
    res.status(200).json({ received: true });
  }),
);
