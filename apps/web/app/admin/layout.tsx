"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, ShoppingBag, Boxes, FileText, LifeBuoy, LogOut, ShieldAlert, Loader2, Cat, BellRing,
} from "lucide-react";
import { Button, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { ThemeToggle } from "@/components/toggles";
import { Logo } from "@/components/logo";

const NAV = [
  { href: "/admin", icon: LayoutDashboard, en: "Dashboard", ar: "لوحة التحكم", exact: true },
  { href: "/admin/customers", icon: Users, en: "Customers", ar: "العملاء" },
  { href: "/admin/orders", icon: ShoppingBag, en: "Orders", ar: "الطلبات" },
  { href: "/admin/products", icon: Boxes, en: "Products", ar: "المنتجات" },
  { href: "/admin/content", icon: FileText, en: "Content", ar: "المحتوى" },
  { href: "/admin/community", icon: Cat, en: "Community", ar: "المجتمع" },
  { href: "/admin/waitlist", icon: BellRing, en: "Waitlist", ar: "قائمة الانتظار" },
  { href: "/admin/support", icon: LifeBuoy, en: "Support", ar: "الدعم" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  const signOut = React.useCallback(() => {
    void logout();
    router.push("/login");
  }, [logout, router]);

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  // Signed in but not staff → hard stop.
  if (!user.isStaff) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="max-w-sm text-center">
          <span className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-destructive/10 text-destructive"><ShieldAlert className="size-8" /></span>
          <h1 className="font-display text-xl font-bold tracking-tight">{isAr ? "للموظفين فقط" : "Staff access only"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{isAr ? "لا يملك حسابك صلاحيات الإدارة." : "Your account doesn’t have admin permissions."}</p>
          <Link href="/portal"><Button className="mt-5" variant="outline">{isAr ? "الذهاب إلى حسابي" : "Go to my account"}</Button></Link>
        </div>
      </div>
    );
  }

  const label = (item: (typeof NAV)[number]) => (isAr ? item.ar : item.en);

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-e border-border bg-card p-4 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <Logo className="h-8" priority />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{isAr ? "الإدارة" : "Admin"}</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <item.icon className="size-4" /> {label(item)}
              </Link>
            );
          })}
        </nav>
        <Button variant="ghost" size="sm" className="justify-start" onClick={signOut}>
          <LogOut className="size-4" /> {isAr ? "تسجيل الخروج" : "Log out"}
        </Button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
          <div className="flex gap-1 overflow-x-auto md:hidden">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return <Link key={item.href} href={item.href} aria-label={label(item)} className={cn("grid size-9 place-items-center rounded-lg", active ? "bg-foreground text-background" : "text-muted-foreground")}><item.icon className="size-4" /></Link>;
            })}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline" dir="ltr">{user.email}</span>
            <ThemeToggle />
            {/* Mobile logout (M7): desktop logout lives in the aside, hidden on mobile. */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={signOut}
              aria-label={isAr ? "تسجيل الخروج" : "Log out"}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 p-6 outline-none">{children}</main>
      </div>
    </div>
  );
}
