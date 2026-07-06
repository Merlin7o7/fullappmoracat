"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Images, PawPrint } from "lucide-react";
import { useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { PhotoUploader } from "@/components/photo-uploader";
import { ImgWithFallback } from "@/components/img-with-fallback";

interface GalleryPhoto {
  id: string;
  url: string;
}

/**
 * Cat photo management: profile portrait (square) + cover (16:9) + a gallery of
 * up to 12 shots. Uploads are cropped/compressed client-side then sent to R2
 * via the API. Used inside the manage drawer.
 */
export function CatPhotosPanel({
  catId,
  currentPhotoUrl,
  currentCoverUrl,
  isAr,
  onChanged,
}: {
  catId: string;
  currentPhotoUrl?: string | null;
  currentCoverUrl?: string | null;
  isAr: boolean;
  onChanged?: () => void;
}) {
  const { authedFetch } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const gallery = useQuery({
    queryKey: ["gallery", catId],
    queryFn: () => authedFetch<GalleryPhoto[]>(`/cats/${catId}/gallery`),
  });
  const photos = gallery.data ?? [];

  async function refreshCat() {
    await qc.invalidateQueries({ queryKey: ["cats"] });
    await qc.invalidateQueries({ queryKey: ["cat", catId] });
    await qc.invalidateQueries({ queryKey: ["overview"] });
    onChanged?.();
  }

  async function removePhoto(id: string) {
    try {
      await authedFetch(`/cats/${catId}/gallery/${id}`, { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["gallery", catId] });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed", variant: "error" });
    }
  }

  return (
    <div className="space-y-4">
      <PhotoUploader
        endpoint={`/cats/${catId}/photo`}
        aspect={1}
        rounded
        maxEdge={800}
        currentUrl={currentPhotoUrl}
        isAr={isAr}
        label={isAr ? "الصورة الشخصية" : "Profile photo"}
        onUploaded={refreshCat}
      />

      <PhotoUploader
        endpoint={`/cats/${catId}/cover`}
        aspect={16 / 9}
        maxEdge={1280}
        currentUrl={currentCoverUrl}
        isAr={isAr}
        label={isAr ? "صورة الغلاف" : "Cover image"}
        onUploaded={refreshCat}
      />

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
          <Images className="size-4 text-primary" />
          {isAr ? "المعرض" : "Gallery"}
          <span className="text-xs font-normal text-muted-foreground">{photos.length}/12</span>
        </p>

        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted ring-hairline">
              <ImgWithFallback
                src={p.url}
                alt=""
                loading="lazy"
                className="size-full object-cover"
                fallback={
                  <span className="grid size-full place-items-center">
                    <PawPrint className="size-6 text-muted-foreground/40" />
                  </span>
                }
              />
              <button
                onClick={() => removePhoto(p.id)}
                aria-label={isAr ? "حذف" : "Delete"}
                className="absolute end-1 top-1 grid size-6 place-items-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>

        {photos.length < 12 && (
          <div className="mt-2">
            <PhotoUploader
              endpoint={`/cats/${catId}/gallery`}
              aspect={1}
              maxEdge={1000}
              isAr={isAr}
              hint={isAr ? "أضف صورة للمعرض" : "Add a gallery photo"}
              onUploaded={() => qc.invalidateQueries({ queryKey: ["gallery", catId] })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
