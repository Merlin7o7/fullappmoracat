"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Award, Download, ExternalLink, RefreshCcw } from "lucide-react";
import { Card, Button, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/datetime";
import { friendlyError } from "@/lib/errors";

export interface Certificate {
  id: string;
  number: string;
  issuedAt: string;
  verifyUrl: string;
  pdfUrl: string;
}

/**
 * The Cat ID certificate (MRC-PROD-001 T9): a printable, verifiable document
 * of the cat's identity and vaccination record. Clinic-written doses read as
 * verified; the owner's own entries read as self-reported — the certificate
 * never claims more than the record holds (R006). Re-issuing freezes a fresh
 * snapshot; the old number keeps verifying until revoked.
 */
export function CertificateCard({ catId, catName, hasCatId, isAr }: { catId: string; catName: string; hasCatId: boolean; isAr: boolean }) {
  const { authedFetch, user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const latest = useQuery({
    queryKey: ["certificate", catId],
    queryFn: () => authedFetch<Certificate | null>(`/cats/${catId}/certificate`),
    enabled: !!user && !!catId,
  });

  const issue = useMutation({
    mutationFn: () => authedFetch<Certificate>(`/cats/${catId}/certificate`, { method: "POST", body: "{}" }),
    onSuccess: (c) => {
      qc.setQueryData(["certificate", catId], c);
      window.open(c.pdfUrl, "_blank", "noopener,noreferrer");
      toast({ title: isAr ? `صدرت الشهادة ${c.number}` : `Certificate ${c.number} issued`, variant: "success" });
    },
    onError: (e) => {
      const fe = friendlyError(e, isAr);
      toast({ title: fe.title, description: fe.message, variant: "error" });
    },
  });

  const cert = latest.data ?? null;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Award className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold">{isAr ? "شهادة الهوية" : "Cat ID certificate"}</h2>
            <p className="text-sm text-muted-foreground">
              {isAr
                ? `مستند قابل للطباعة بهوية ${catName} وسجل تطعيماته، مع رمز يتحقق منه أي أحد. ما كتبته العيادة يظهر «موثّقاً»، وما أدخلته بنفسك يظهر «مُدخلاً ذاتياً».`
                : `A printable document of ${catName}'s ID and vaccination record, with a code anyone can verify. What a clinic wrote reads as verified; what you entered yourself reads as self-reported.`}
            </p>
            {cert && (
              <p className="mt-2 text-xs text-muted-foreground">
                <span dir="ltr" className="font-mono">{cert.number}</span> · {isAr ? "صدرت" : "issued"} {formatDate(cert.issuedAt, isAr ? "ar" : "en", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                <a href={cert.verifyUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                  {isAr ? "صفحة التحقق" : "verify page"} <ExternalLink className="inline size-3 align-[-2px]" aria-hidden />
                </a>
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {cert && (
            <a href={cert.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex">
              <Button variant="outline" size="sm">
                <Download className="size-4" aria-hidden /> PDF
              </Button>
            </a>
          )}
          <Button size="sm" variant={cert ? "ghost" : "primary"} loading={issue.isPending} disabled={!hasCatId} onClick={() => issue.mutate()}>
            {cert ? (
              <>
                <RefreshCcw className="size-4" aria-hidden /> {isAr ? "أصدر نسخة محدّثة" : "Issue an updated one"}
              </>
            ) : (
              <>
                <Award className="size-4" aria-hidden /> {isAr ? "أصدر الشهادة" : "Issue certificate"}
              </>
            )}
          </Button>
        </div>
      </div>
      {!hasCatId && (
        <p className="mt-3 text-xs text-muted-foreground">
          {isAr ? "تُصدر الشهادة بعد صدور هوية القط." : "The certificate becomes available once the Cat ID is issued."}
        </p>
      )}
    </Card>
  );
}
