"use client";

import * as React from "react";
import { Check, Link2, MessageCircle, Share2 } from "lucide-react";
import { Button, cn, useToast } from "@moraqat/ui";
import { noticeShareMessage, noticeUrl, type ShareableNotice } from "@/lib/lost-found-share";

/**
 * Getting a notice in front of neighbours is the whole job of a lost-cat post,
 * and in Saudi Arabia that means WhatsApp groups. WhatsApp is therefore the
 * primary action (R005 — one clear action), with the system share sheet and a
 * plain copy-link beside it. The message carries no phone number: the link
 * leads to the relay form (trust/safety before reach).
 */
export function LostFoundShare({
  notice,
  isAr,
  compact,
  className,
}: {
  notice: ShareableNotice;
  isAr: boolean;
  /** Icon-forward row for list items; the full row is for the notice page. */
  compact?: boolean;
  className?: string;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const [canNativeShare, setCanNativeShare] = React.useState(false);
  const url = noticeUrl(notice.id);
  const message = noticeShareMessage(notice, isAr);

  React.useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: isAr ? "ما قدرنا ننسخ الرابط" : "Couldn't copy the link",
        description: url,
        variant: "error",
      });
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ text: message, url });
    } catch {
      /* The member closed the sheet — not an error. */
    }
  }

  const size = compact ? "sm" : "md";
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={compact ? undefined : "w-full sm:w-auto"}
      >
        <Button size={size} variant="brand" className="w-full">
          <MessageCircle className="size-4" aria-hidden />
          {isAr ? "شارك في واتساب" : "Share on WhatsApp"}
        </Button>
      </a>
      {canNativeShare && (
        <Button size={size} variant="outline" onClick={nativeShare}>
          <Share2 className="size-4" aria-hidden />
          {isAr ? "مشاركة" : "Share"}
        </Button>
      )}
      <Button size={size} variant="outline" onClick={copy} aria-live="polite">
        {copied ? <Check className="size-4 text-success" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
        {copied ? (isAr ? "انتسخ الرابط" : "Link copied") : isAr ? "انسخ الرابط" : "Copy link"}
      </Button>
    </div>
  );
}
