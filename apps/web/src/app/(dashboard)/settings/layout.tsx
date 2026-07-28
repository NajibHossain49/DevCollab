import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your DevCollab account and preferences.",
};

export default function SettingsSegmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
