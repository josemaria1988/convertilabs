import type { ReactNode } from "react";

export default function PrivateAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(217,119,6,0.1),transparent_24%)]">
      {children}
    </div>
  );
}
