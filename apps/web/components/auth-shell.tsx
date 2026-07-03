"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@moraqat/ui";
import { Logo } from "./logo";

/** Glass auth card used by both the login and register pages. */
export function AuthShell({
  children, title, subtitle,
}: { children: React.ReactNode; title: string; subtitle: string; isAr?: boolean }) {
  return (
    <div className="mesh-bg relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 start-1/3 size-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 end-10 size-80 rounded-full bg-accent/20 blur-3xl" />
      </div>
      <Card glass className="w-full max-w-md p-8">
        <Link href="/" aria-label="Moracat" className="mb-7 flex">
          <Logo className="h-10" priority />
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">{subtitle}</p>
        {children}
      </Card>
    </div>
  );
}
