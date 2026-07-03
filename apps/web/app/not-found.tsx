import Link from "next/link";
import { Home } from "lucide-react";
import { Button } from "@moraqat/ui";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="mesh-bg grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <Logo className="mb-8 h-10 animate-float" />
        <p className="font-display text-6xl font-bold tracking-tight text-gradient">404</p>
        <h1 className="mt-3 font-display text-xl font-semibold">This page wandered off</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Like a curious cat, this page slipped away. Let&apos;s get you back home.
        </p>
        <Link href="/" className="mt-7">
          <Button size="lg"><Home className="size-4" /> Back to home</Button>
        </Link>
      </div>
    </div>
  );
}
