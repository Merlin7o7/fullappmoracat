"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, ShoppingBag, Boxes, FileText, LifeBuoy, LogOut, ShieldAlert, Loader2, Cat, BellRing,
} from "lucide-react";
import { Button, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/toggles";
import { Logo } from "@/components/logo";

const NAV = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/admin/customers", icon: Users, label: "Customers" },
  { href: "/admin/orders", icon: ShoppingBag, label: "Orders" },
  { href: "/admin/products", icon: Boxes, label: "Products" },
  { href: "/admin/content", icon: FileText, label: "Content" },
  { href: "/admin/community", icon: Cat, label: "Community" },
  { href: "/admin/waitlist", icon: BellRing, label: "Waitlist" },
  { href: "/admin/support", icon: LifeBuoy, label: "Support" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  // Signed in but not staff → hard stop.
  if (!user.isStaff) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="max-w-sm text-center">
          <span className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-destructive/10 text-destructive"><ShieldAlert className="size-8" /></span>
          <h1 className="font-display text-xl font-bold tracking-tight">Staff access only</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your account doesn&apos;t have admin permissions.</p>
          <Link href="/portal"><Button className="mt-5" variant="outline">Go to my account</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-e border-border bg-card p-4 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <Logo className="h-8" priority />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Admin</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <item.icon className="size-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <Button variant="ghost" size="sm" className="justify-start" onClick={() => { void logout(); router.push("/login"); }}>
          <LogOut className="size-4" /> Log out
        </Button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
          <div className="flex gap-1 overflow-x-auto md:hidden">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return <Link key={item.href} href={item.href} className={cn("grid size-9 place-items-center rounded-lg", active ? "bg-foreground text-background" : "text-muted-foreground")}><item.icon className="size-4" /></Link>;
            })}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
