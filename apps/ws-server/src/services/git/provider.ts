import { GitProvider } from "@prisma/client";

import type { GitProviderSlug } from "../../utils/validators.js";
import { bitbucketAdapter } from "./bitbucket.service.js";
import { githubAdapter } from "./github.service.js";
import { gitlabAdapter } from "./gitlab.service.js";
import type { GitProviderAdapter } from "./types.js";

const ADAPTERS: Record<GitProvider, GitProviderAdapter> = {
  [GitProvider.GITHUB]: githubAdapter,
  [GitProvider.GITLAB]: gitlabAdapter,
  [GitProvider.BITBUCKET]: bitbucketAdapter,
};

const SLUG_TO_ENUM: Record<GitProviderSlug, GitProvider> = {
  github: GitProvider.GITHUB,
  gitlab: GitProvider.GITLAB,
  bitbucket: GitProvider.BITBUCKET,
};

const ENUM_TO_SLUG: Record<GitProvider, GitProviderSlug> = {
  [GitProvider.GITHUB]: "github",
  [GitProvider.GITLAB]: "gitlab",
  [GitProvider.BITBUCKET]: "bitbucket",
};

export function getAdapter(provider: GitProvider): GitProviderAdapter {
  return ADAPTERS[provider];
}

export function providerFromSlug(slug: GitProviderSlug): GitProvider {
  return SLUG_TO_ENUM[slug];
}

export function slugFromProvider(provider: GitProvider): GitProviderSlug {
  return ENUM_TO_SLUG[provider];
}
