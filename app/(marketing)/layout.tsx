"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";

export default function MarketingLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const hideChrome = pathname === "/signup";

  return (
    <div className="min-h-screen">
      {!hideChrome ? <MarketingHeader /> : null}
      <main>{children}</main>
      {!hideChrome ? <MarketingFooter /> : null}
    </div>
  );
}
