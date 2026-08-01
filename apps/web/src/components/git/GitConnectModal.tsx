"use client";

import { Check, GitBranch, GitFork, GitMerge, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGitConnect, useGitProviders } from "@/hooks/useGit";
import type { GitProviderSlug } from "@/types";

const PROVIDERS: {
  slug: GitProviderSlug;
  label: string;
  icon: typeof GitBranch;
}[] = [
  { slug: "github", label: "GitHub", icon: GitBranch },
  { slug: "gitlab", label: "GitLab", icon: GitMerge },
  { slug: "bitbucket", label: "Bitbucket", icon: GitFork },
];

interface GitConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GitConnectModal({ open, onOpenChange }: GitConnectModalProps) {
  const { configured, integrations, isLoading } = useGitProviders();
  const connect = useGitConnect();

  const connectedSlugs = new Set(integrations.map((i) => i.provider));

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Connect a Git provider">
      <DialogHeader>
        <DialogTitle>Connect a Git provider</DialogTitle>
        <DialogDescription>
          Link GitHub, GitLab, or Bitbucket to sync code, open pull requests, and
          track issues — all using their free APIs.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        {PROVIDERS.map(({ slug, label, icon: Icon }) => {
          const isConfigured = configured.includes(slug);
          const isConnected = connectedSlugs.has(slug);
          const account = integrations.find((i) => i.provider === slug)?.accountLogin;

          return (
            <div
              key={slug}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div className="flex items-center gap-3">
                <Icon className="size-5" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{label}</span>
                  {isConnected && account ? (
                    <span className="text-xs text-muted-foreground">@{account}</span>
                  ) : !isConfigured ? (
                    <span className="text-xs text-muted-foreground">
                      Not configured on the server
                    </span>
                  ) : null}
                </div>
              </div>

              {isConnected ? (
                <Badge variant="secondary" className="gap-1">
                  <Check className="size-3" /> Connected
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!isConfigured || connect.isPending || isLoading}
                  onClick={() => connect.mutate(slug)}
                >
                  {connect.isPending && connect.variables === slug ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Connect"
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
