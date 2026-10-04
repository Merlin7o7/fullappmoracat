"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCw } from "lucide-react";
import { Button, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { friendlyMessage } from "@/lib/errors";
import { PhotoUploader } from "@/components/photo-uploader";
import { PhotoAttestation } from "@/components/signup/consents";
import { PHOTO_RETRY_KEY, dataUrlToFile, readJson, removeKey } from "@/components/signup/draft";

/**
 * Right after the ceremony (never inside it): a cat issued without a face is
 * told, in one line, what that means — it isn't shown in the community until
 * it has a photo (2026-08-14 guardrail: no empty frames in the feed) — with
 * the action right there. If the sign-up photo failed to upload at issue
 * time, the same card offers a one-tap retry of that exact photo.
 *
 * Renders nothing once the cat has a photo. Mounted on /portal/welcome.
 */
export function NoPhotoNudge({ catId, isAr }: { catId: string | null; isAr: boolean }) {
  const { authedFetch, uploadImage, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const t = (ar: string, en: string) => (isAr ? ar : en);

  const { data: cat, refetch } = useQuery({
    queryKey: ["no-photo-nudge", catId],
    queryFn: () => authedFetch<{ id: string; name: string; photoUrl: string | null; isPublic?: boolean }>(`/cats/${catId}`),
    enabled: !!user && !!catId,
  });

  const [retryPhoto, setRetryPhoto] = React.useState<string | null>(null);
  React.useEffect(() => {
    const r = readJson<{ catId: string; photo: string }>(PHOTO_RETRY_KEY);
    if (r && r.catId === catId && r.photo?.startsWith("data:image/")) setRetryPhoto(r.photo);
  }, [catId]);

  const [retrying, setRetrying] = React.useState(false);
  const done = async () => {
    removeKey(PHOTO_RETRY_KEY);
    setRetryPhoto(null);
    await refetch();
    void qc.invalidateQueries({ queryKey: ["cats"] });
  };

  async function retry() {
    if (!retryPhoto || !catId) return;
    setRetrying(true);
    try {
      const file = dataUrlToFile(retryPhoto, "cat.jpg");
      await uploadImage(`/cats/${catId}/photo`, file, { filename: file.name });
      toast({ title: t("وصلت الصورة", "Photo added"), variant: "success" });
      await done();
    } catch (e) {
      toast({ title: t("ما زالت الصورة ما وصلت", "The photo still didn't upload"), description: friendlyMessage(e, isAr), variant: "error" });
    } finally {
      setRetrying(false);
    }
  }

  if (!cat || cat.photoUrl) return null;
  const name = cat.name;

  return (
    <section className="mx-auto mb-6 max-w-5xl rounded-2xl border border-border bg-card p-5 shadow-e1 sm:p-6" aria-label={t(`صورة ${name}`, `${name}'s photo`)}>
      <p className="font-medium">
        {cat.isPublic === false
          ? t(`أضف صورة ${name} — تطلع على هويته.`, `Add a photo of ${name} — it goes on their ID.`)
          : t(`${name} ما بيظهر في المجتمع لين تضيف صورته.`, `${name} won't appear in the community until you add a photo.`)}
      </p>
      {retryPhoto ? (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={retryPhoto} alt="" className="size-16 rounded-xl object-cover" />
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("الصورة اللي اخترتها ما وصلت وقت الإصدار.", "The photo you chose didn't upload at issue time.")}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void retry()} disabled={retrying}>
                {retrying ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" aria-hidden />}
                {t("أعد رفعها", "Try the upload again")}
              </Button>
              <Button size="sm" variant="tertiary" onClick={() => { removeKey(PHOTO_RETRY_KEY); setRetryPhoto(null); }}>
                {t("اختر صورة ثانية", "Choose another photo")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 max-w-sm">
          <PhotoUploader
            endpoint={`/cats/${cat.id}/photo`}
            aspect={1}
            rounded
            maxEdge={800}
            currentUrl={null}
            isAr={isAr}
            label={t(`صورة ${name}`, `${name}'s photo`)}
            onUploaded={() => void done()}
          />
        </div>
      )}
      <PhotoAttestation isAr={isAr} className="mt-3" />
    </section>
  );
}
