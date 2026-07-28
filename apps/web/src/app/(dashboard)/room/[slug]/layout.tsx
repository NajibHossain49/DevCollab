import type { Metadata } from "next";
import type { ReactNode } from "react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pretty = slug.replace(/-/g, " ");
  return {
    title: `Room · ${pretty}`,
    description: `Collaborate in the "${pretty}" room on DevCollab.`,
    robots: { index: false, follow: false },
  };
}

export default function RoomSegmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
