"use client";

import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { CreateOrgModal } from "@/components/org/CreateOrgModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useOrganizations } from "@/hooks/useOrganization";
import { cn } from "@/lib/utils";

// Compact organization switcher shown in the navbar. Lets the user jump
// between teams they belong to or spin up a new one.
export function OrgSwitcher() {
  const router = useRouter();
  const params = useParams();
  const activeSlug = typeof params?.slug === "string" ? params.slug : null;

  const { organizations, isLoading } = useOrganizations();
  const [createOpen, setCreateOpen] = useState(false);

  const active = organizations.find((org) => org.slug === activeSlug);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Switch organization"
          className="flex h-9 max-w-52 items-center gap-2 rounded-md border border-border px-2.5 text-sm transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Building2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {active ? active.name : "Personal"}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="min-w-56">
          <DropdownMenuLabel>Organizations</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {isLoading ? (
            <div className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Loading…
            </div>
          ) : organizations.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">
              No organizations yet.
            </p>
          ) : (
            organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => router.push(`/orgs/${org.slug}`)}
              >
                <Building2 className="text-muted-foreground" />
                <span className="flex-1 truncate">{org.name}</span>
                {org.slug === activeSlug ? (
                  <Check className={cn("text-primary")} />
                ) : null}
              </DropdownMenuItem>
            ))
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <Plus />
            New organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrgModal open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
