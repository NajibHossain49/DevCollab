import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your collaborative coding rooms.",
};

export default function DashboardSegmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
