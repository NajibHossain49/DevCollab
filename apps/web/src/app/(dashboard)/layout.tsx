"use client";

import { useState, type ReactNode } from "react";

import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { WarmupManager } from "@/components/providers/WarmupManager";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { loading, isAuthenticated } = useAuth({ required: true });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Show a loading state while the session is resolving. Once resolved,
  // unauthenticated users are redirected to /login by useAuth; render nothing
  // in that brief window to avoid flashing protected content.
  if (loading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner />
          <span className="text-sm">Checking your session…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <WarmupManager />
      <Navbar onMenuClick={() => setMobileSidebarOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          mobileOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />
        <main className="min-h-0 min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
