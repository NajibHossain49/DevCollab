"use client";

import {
  BarChart3,
  Building2,
  Clock,
  DoorOpen,
  Terminal,
  UserPlus,
  Users,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useState, type ComponentType } from "react";

import { InviteMemberModal } from "@/components/org/InviteMemberModal";
import { MemberList } from "@/components/org/MemberList";
import { OrgSettings } from "@/components/org/OrgSettings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization, useOrgAnalytics } from "@/hooks/useOrganization";
import type { OrganizationMember, OrgRole } from "@/types";

type Tab = "members" | "analytics" | "settings";

const TABS: { id: Tab; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "members", label: "Members", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Building2 },
];

export default function OrganizationPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const { user } = useAuth({ required: true });
  const { organization, members, isLoading, isError } = useOrganization(slug);

  const [tab, setTab] = useState<Tab>("members");
  const [inviteOpen, setInviteOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !organization) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="font-medium">Organization not found</p>
        <p className="text-sm text-muted-foreground">
          It may have been deleted or you don&apos;t have access.
        </p>
        <Button variant="outline" className="mt-2" asChild>
          <a href="/dashboard">Back to dashboard</a>
        </Button>
      </div>
    );
  }

  // Match the signed-in user against a membership. The web session id is the
  // GitHub id for OAuth users and the DB uuid for credentials users, so compare
  // on both id and githubId.
  const currentMember = members.find((m: OrganizationMember) => {
    if (!user) return false;
    const gid = user.githubId ?? user.id;
    return (
      m.user?.id === user.id ||
      m.user?.id === gid ||
      m.user?.githubId === gid ||
      m.user?.githubId === user.id
    );
  });

  const currentUserRole: OrgRole | undefined = currentMember?.role;
  const canManage = currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {organization.name}
            </h1>
            <p className="text-sm text-muted-foreground">/orgs/{organization.slug}</p>
          </div>
        </div>
        {canManage ? (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus />
            Invite member
          </Button>
        ) : null}
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors " +
              (tab === id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "members" ? (
        <MemberList
          slug={slug}
          members={members}
          ownerId={organization.ownerId}
          currentUserId={currentMember?.userId}
          currentUserRole={currentUserRole}
        />
      ) : null}

      {tab === "analytics" ? <AnalyticsTab slug={slug} /> : null}

      {tab === "settings" ? (
        <OrgSettings organization={organization} canEdit={canManage} />
      ) : null}

      <InviteMemberModal
        slug={slug}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
    </div>
  );
}

function AnalyticsTab({ slug }: { slug: string }) {
  const { analytics, isLoading } = useOrgAnalytics(slug);

  if (isLoading || !analytics) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const stats = [
    { label: "Members", value: analytics.totalMembers, icon: Users },
    { label: "Active rooms", value: analytics.activeRooms, icon: DoorOpen },
    { label: "Coding hours", value: analytics.codingHours, icon: Clock },
    { label: "Executions", value: analytics.totalExecutions, icon: Terminal },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map(({ label, value, icon: Icon }) => (
        <Card key={label} className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wide">
              {label}
            </span>
          </div>
          <span className="text-3xl font-semibold tracking-tight">{value}</span>
        </Card>
      ))}
    </div>
  );
}
