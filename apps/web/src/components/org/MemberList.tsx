"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

import { Avatar, initialsFromName } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useRemoveMember, useUpdateMemberRole } from "@/hooks/useOrganization";
import { ApiError } from "@/lib/api";
import type { OrganizationMember, OrgRole } from "@/types";

type AssignableRole = Exclude<OrgRole, "OWNER">;

interface MemberListProps {
  slug: string;
  members: OrganizationMember[];
  ownerId: string;
  /** The id of the currently signed-in user. */
  currentUserId?: string;
  /** The current user's role in this organization. */
  currentUserRole?: OrgRole;
}

const ROLE_BADGE_VARIANT: Record<
  OrgRole,
  "default" | "secondary" | "outline"
> = {
  OWNER: "default",
  ADMIN: "secondary",
  MEMBER: "outline",
};

export function MemberList({
  slug,
  members,
  ownerId,
  currentUserId,
  currentUserRole,
}: MemberListProps) {
  const updateRole = useUpdateMemberRole(slug);
  const removeMember = useRemoveMember(slug);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const canManage =
    currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  const handleRoleChange = async (userId: string, role: AssignableRole) => {
    setError(null);
    setPendingId(userId);
    try {
      await updateRole.mutateAsync({ userId, role });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update role");
    } finally {
      setPendingId(null);
    }
  };

  const handleRemove = async (userId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from this organization?`)) return;
    setError(null);
    setPendingId(userId);
    try {
      await removeMember.mutateAsync(userId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove member");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {members.map((member) => {
          const isOwner = member.userId === ownerId;
          const isSelf = member.userId === currentUserId;
          const name = member.user?.name ?? "Unknown user";
          const busy = pendingId === member.userId;
          // Managers can act on other members, but never on the owner.
          const showControls = canManage && !isOwner;

          return (
            <li
              key={member.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <Avatar
                src={member.user?.avatar}
                alt={name}
                fallback={initialsFromName(name)}
                className="size-9"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {name}
                  {isSelf ? (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      (you)
                    </span>
                  ) : null}
                </p>
                {member.user?.email ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {member.user.email}
                  </p>
                ) : null}
              </div>

              {member.joinedAt === null ? (
                <Badge variant="outline">Pending</Badge>
              ) : null}

              {showControls ? (
                <div className="flex items-center gap-2">
                  <Select
                    aria-label={`Change role for ${name}`}
                    value={member.role}
                    disabled={busy}
                    className="h-8 w-28 text-xs"
                    onChange={(event) =>
                      handleRoleChange(
                        member.userId,
                        event.target.value as AssignableRole,
                      )
                    }
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${name}`}
                    disabled={busy}
                    onClick={() => handleRemove(member.userId, name)}
                    className="text-destructive hover:text-destructive"
                  >
                    {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
                  </Button>
                </div>
              ) : (
                <Badge variant={ROLE_BADGE_VARIANT[member.role]}>
                  {member.role}
                </Badge>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
