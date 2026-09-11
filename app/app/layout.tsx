import type { ReactNode } from "react";

export default function PrivateAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="private-app min-h-screen bg-[color:var(--color-background)]">
      {children}
    </div>
  );
}
