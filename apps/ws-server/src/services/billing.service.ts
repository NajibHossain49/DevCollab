import { OrgPlan, OrgRole, type Organization } from "@prisma/client";
import Stripe from "stripe";

import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import {
  AppError,
  ConflictError,
  DatabaseError,
  ForbiddenError,
  NotFoundError,
} from "../utils/errors.js";

// ---------------------------------------------------------------------------
// Billing service — Stripe (test mode now, production-ready by design).
//
// Subscription state lives in the database (see Organization billing fields),
// so switching from test keys to live keys requires NO code changes — the same
// Checkout + webhook + verify flow drives real charges. Everything is gated on
// configuration: with no STRIPE_SECRET_KEY the API reports billing as disabled
// instead of erroring the whole app (mirrors the email service pattern).
// ---------------------------------------------------------------------------

let stripeClient: Stripe | null = null;

// Returns true when the minimum config for checkout is present.
export function isBillingEnabled(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRO_PRICE_ID);
}

// Lazily constructs the Stripe client. Throws a clean 503 if unconfigured so
// callers surface "billing unavailable" rather than a stack trace.
function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError("BILLING_DISABLED", "Billing is not configured", 503);
  }
  if (!stripeClient) {
    // Omit apiVersion so the pinned SDK default is used; avoids drift when the
    // dashboard's default API version differs.
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

function webBaseUrl(): string {
  return env.WEB_APP_URL ?? env.NEXTAUTH_URL;
}

// ---------------------------------------------------------------------------
// Authorization: billing changes require OWNER or ADMIN.
// ---------------------------------------------------------------------------
async function getOrgAsManager(slug: string, userId: string): Promise<Organization> {
  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) {
    throw new NotFoundError("Organization");
  }
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId } },
  });
  if (!membership) {
    throw new ForbiddenError("You are not a member of this organization");
  }
  if (membership.role !== OrgRole.OWNER && membership.role !== OrgRole.ADMIN) {
    throw new ForbiddenError("Only owners and admins can manage billing");
  }
  return org;
}

async function getOrgAsMember(slug: string, userId: string): Promise<Organization> {
  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) {
    throw new NotFoundError("Organization");
  }
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId } },
  });
  if (!membership) {
    throw new ForbiddenError("You are not a member of this organization");
  }
  return org;
}

// Reuses the org's Stripe customer or creates one, persisting the id.
async function ensureCustomer(org: Organization): Promise<string> {
  if (org.stripeCustomerId) {
    return org.stripeCustomerId;
  }
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: org.name,
    metadata: { organizationId: org.id, slug: org.slug },
  });
  await prisma.organization.update({
    where: { id: org.id },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

// ---------------------------------------------------------------------------
// Subscription <-> DB sync (shared by webhook and the verify fallback).
// ---------------------------------------------------------------------------
function readPeriodEnd(subscription: Stripe.Subscription): Date | null {
  // `current_period_end` can live on the subscription or its items depending on
  // API version; read defensively so this survives version bumps.
  const top = (subscription as unknown as { current_period_end?: number })
    .current_period_end;
  if (typeof top === "number") {
    return new Date(top * 1000);
  }
  const item = subscription.items?.data?.[0] as unknown as {
    current_period_end?: number;
  };
  return typeof item?.current_period_end === "number"
    ? new Date(item.current_period_end * 1000)
    : null;
}

async function syncSubscriptionToOrg(
  organizationId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const status = subscription.status;
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const active = status === "active" || status === "trialing";

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscriptionStatus: status,
      currentPeriodEnd: readPeriodEnd(subscription),
      plan: active ? OrgPlan.PRO : OrgPlan.FREE,
    },
  });
  logger.info({ organizationId, status, plan: active ? "PRO" : "FREE" }, "Subscription synced");
}

// Resolves which org a subscription belongs to (metadata first, then customer).
async function resolveOrgId(subscription: Stripe.Subscription): Promise<string | null> {
  const fromMeta = subscription.metadata?.organizationId;
  if (fromMeta) {
    return fromMeta;
  }
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const org = await prisma.organization.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return org?.id ?? null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export interface BillingStatus {
  enabled: boolean;
  plan: OrgPlan;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  hasStripeCustomer: boolean;
}

export async function getBillingStatus(
  slug: string,
  userId: string,
): Promise<BillingStatus> {
  try {
    const org = await getOrgAsMember(slug, userId);
    return {
      enabled: isBillingEnabled(),
      plan: org.plan,
      subscriptionStatus: org.subscriptionStatus,
      currentPeriodEnd: org.currentPeriodEnd?.toISOString() ?? null,
      hasStripeCustomer: Boolean(org.stripeCustomerId),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error, slug }, "Failed to get billing status");
    throw new DatabaseError("Failed to get billing status");
  }
}

// Creates a Stripe Checkout Session for the Pro plan and returns its URL.
export async function createCheckoutSession(
  slug: string,
  userId: string,
): Promise<{ url: string }> {
  if (!isBillingEnabled()) {
    throw new AppError("BILLING_DISABLED", "Billing is not configured", 503);
  }

  try {
    const org = await getOrgAsManager(slug, userId);

    if (org.plan === OrgPlan.PRO && org.subscriptionStatus === "active") {
      throw new ConflictError("This organization is already on the Pro plan");
    }

    const stripe = getStripe();
    const customerId = await ensureCustomer(org);
    const base = webBaseUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: env.STRIPE_PRO_PRICE_ID as string, quantity: 1 }],
      client_reference_id: org.id,
      // Propagate the org id onto the subscription so webhooks can resolve it.
      subscription_data: { metadata: { organizationId: org.id } },
      metadata: { organizationId: org.id },
      success_url: `${base}/orgs/${org.slug}?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/orgs/${org.slug}?billing=cancelled`,
    });

    if (!session.url) {
      throw new AppError("BILLING_ERROR", "Stripe did not return a checkout URL", 502);
    }

    logger.info({ orgId: org.id, sessionId: session.id }, "Checkout session created");
    return { url: session.url };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error, slug }, "Failed to create checkout session");
    throw new DatabaseError("Failed to start checkout");
  }
}

// Creates a Stripe Billing Portal session so members can manage/cancel their
// subscription. Production-ready; works in test mode too.
export async function createPortalSession(
  slug: string,
  userId: string,
): Promise<{ url: string }> {
  if (!isBillingEnabled()) {
    throw new AppError("BILLING_DISABLED", "Billing is not configured", 503);
  }

  try {
    const org = await getOrgAsManager(slug, userId);
    if (!org.stripeCustomerId) {
      throw new ConflictError("No billing account exists for this organization yet");
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${webBaseUrl()}/orgs/${org.slug}`,
    });

    return { url: session.url };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error, slug }, "Failed to create billing portal session");
    throw new DatabaseError("Failed to open billing portal");
  }
}

// Confirms a completed checkout by session id and syncs the subscription to the
// DB. This is the webhook-free path used in test mode (called from the success
// redirect); the webhook remains the source of truth in production.
export async function verifyCheckoutSession(
  slug: string,
  userId: string,
  sessionId: string,
): Promise<BillingStatus> {
  if (!isBillingEnabled()) {
    throw new AppError("BILLING_DISABLED", "Billing is not configured", 503);
  }

  try {
    const org = await getOrgAsManager(slug, userId);
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    // Guard: the session must belong to this org.
    if (session.client_reference_id && session.client_reference_id !== org.id) {
      throw new ForbiddenError("This checkout session does not belong to this organization");
    }

    const subscription = session.subscription;
    if (subscription && typeof subscription !== "string") {
      await syncSubscriptionToOrg(org.id, subscription);
    } else if (typeof subscription === "string") {
      const full = await stripe.subscriptions.retrieve(subscription);
      await syncSubscriptionToOrg(org.id, full);
    }

    return getBillingStatus(slug, userId);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error, slug, sessionId }, "Failed to verify checkout session");
    throw new DatabaseError("Failed to verify checkout");
  }
}

// Verifies and processes a Stripe webhook event. Throws on signature failure so
// the route can return 400. Idempotent by design (Stripe may retry).
export async function handleWebhook(
  rawBody: Buffer,
  signature: string | undefined,
): Promise<void> {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new AppError("BILLING_DISABLED", "Webhook secret is not configured", 503);
  }
  if (!signature) {
    throw new AppError("BILLING_ERROR", "Missing Stripe signature", 400);
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    logger.warn({ error }, "Stripe webhook signature verification failed");
    throw new AppError("BILLING_ERROR", "Invalid webhook signature", 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const orgId = session.client_reference_id ?? session.metadata?.organizationId;
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : null;
        if (orgId && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscriptionToOrg(orgId, subscription);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const orgId = await resolveOrgId(subscription);
        if (orgId) {
          await syncSubscriptionToOrg(orgId, subscription);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const orgId = await resolveOrgId(subscription);
        if (orgId) {
          await prisma.organization.update({
            where: { id: orgId },
            data: {
              plan: OrgPlan.FREE,
              subscriptionStatus: subscription.status,
              currentPeriodEnd: null,
            },
          });
          logger.info({ orgId }, "Subscription canceled; reverted to FREE");
        }
        break;
      }
      default:
        logger.debug({ type: event.type }, "Unhandled Stripe webhook event");
    }
  } catch (error) {
    logger.error({ error, type: event.type }, "Failed to process webhook event");
    throw new DatabaseError("Failed to process webhook event");
  }
}
