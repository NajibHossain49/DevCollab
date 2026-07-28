"use client";

import { Code2, LogOut, Menu, Settings, User as UserIcon } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Avatar, initialsFromName } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/useAuth";

interface NavbarProps {
  /** Optional handler for the mobile hamburger button (opens the sidebar). */
  onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { user, loading, isAuthenticated, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
      {onMenuClick ? (
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open menu"
          onClick={onMenuClick}
        >
          <Menu />
        </Button>
      ) : null}

      <Link href="/" className="flex items-center gap-2 font-semibold">
        <Code2 className="size-5 text-primary" />
        <span className="text-base tracking-tight">DevCollab</span>
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />

        {loading ? (
          <Spinner className="mx-2" />
        ) : isAuthenticated && user ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account menu"
              className="rounded-full focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar
                src={user.avatar}
                alt={user.name ?? "User"}
                fallback={initialsFromName(user.name)}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="truncate text-sm font-medium">
                    {user.name ?? "Signed in"}
                  </span>
                  {user.email ? (
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      {user.email}
                    </span>
                  ) : null}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard">
                  <UserIcon />
                  Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={signOut}
                className="text-destructive hover:text-destructive"
              >
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild size="sm">
            <Link href="/login">Log in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
