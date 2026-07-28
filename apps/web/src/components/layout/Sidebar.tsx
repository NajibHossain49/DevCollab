"use client";

import {
  ChevronDown,
  Hash,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { CreateRoomModal } from "@/components/room/CreateRoomModal";
import { Avatar, initialsFromName } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/useAuth";
import { useRooms } from "@/hooks/useRooms";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  /** Controls the mobile drawer visibility. */
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { rooms, isLoading } = useRooms({ limit: 50 });

  const [roomsExpanded, setRoomsExpanded] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const content = (
    <div className="flex h-full flex-col">
      <nav className="flex flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="min-h-0 flex-1 px-3">
        <button
          type="button"
          onClick={() => setRoomsExpanded((prev) => !prev)}
          aria-expanded={roomsExpanded}
          className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          <span>Rooms</span>
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              roomsExpanded ? "" : "-rotate-90",
            )}
          />
        </button>

        {roomsExpanded ? (
          <div className="mt-1 flex flex-col gap-0.5 overflow-y-auto pb-2">
            {isLoading ? (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <Spinner /> Loading…
              </div>
            ) : rooms.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No rooms yet.
              </p>
            ) : (
              rooms.map((room) => {
                const href = `/room/${room.slug}`;
                const active = pathname === href;
                return (
                  <Link
                    key={room.id}
                    href={href}
                    onClick={onClose}
                    title={room.name}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <Hash className="size-3.5 shrink-0" />
                    <span className="truncate">{room.name}</span>
                  </Link>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      <div className="p-3">
        <Button
          className="w-full"
          size="sm"
          onClick={() => setCreateOpen(true)}
        >
          <Plus />
          Create room
        </Button>
      </div>

      {user ? (
        <div className="flex items-center gap-3 border-t border-border p-3">
          <Avatar
            src={user.avatar}
            alt={user.name ?? "User"}
            fallback={initialsFromName(user.name)}
            className="size-8"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {user.name ?? "Signed in"}
            </p>
            {user.email ? (
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={signOut}
          >
            <LogOut />
          </Button>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {/* Desktop: static column */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-background md:block">
        {content}
      </aside>

      {/* Mobile: slide-over drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={onClose}
            aria-hidden
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-background shadow-xl">
            {content}
          </aside>
        </div>
      ) : null}

      <CreateRoomModal open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
