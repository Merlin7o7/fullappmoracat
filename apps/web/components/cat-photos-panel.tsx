"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Images } from "lucide-react";
import { cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { PhotoUploader } from "@/components/photo-uploader";

interface GalleryPhoto {
  id: string;
  url: string;
}

/**
 * Cat photo management: profile portrait (square, cropped) + a gallery of up to
 * 12 shots. Uploads are cropped/compressed client-side then sent to R2 via the
 * API. Used inside the manage drawer and the registration flow.
 */
export function CatPhotosPanel({
  catId,
  currentPhotoUrl,
  isAr,
  onChanged,
}: {
  catId: string;
  currentPhotoUrl?: string | null;
  isAr: boolean;
  onChanged?: () => void;
}) {
  const { authedUpload, authedFetch } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const gallery = useQuery({
    queryKey: ["gallery", catId],
    queryFn: () => authedFetch<GalleryPhoto[]>(`/cats/${catId}/gallery`),
  });
  const photos = gallery.data ?? [];

  async function uploadTo(path: string, blob: Blob) {
    const fd = new FormData();
    fd.append("file", blob, "photo.webp");
    await authedUpload(path, fd);
  }

  async function onProfile(blob: Blob) {
    await uploadTo(`/cats/${catId}/photo`, blob);
    await qc.invalidateQueries({ queryKey: ["cats"] });
    await qc.invalidateQueries({ queryKey: ["cat", catId] });
    await qc.invalidateQueries({ queryKey: ["overview"] });
    onChanged?.();
  }

  async function onGalleryAdd(blob: Blob) {
    await uploadTo(`/cats/${catId}/gallery`, blob);
    await qc.invalidateQueries({ queryKey: ["gallery", catId] });
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
        aspect={1}
        rounded
        maxEdge={800}
        currentUrl={currentPhotoUrl}
        isAr={isAr}
        label={isAr ? "الصورة الشخصية" : "Profile photo"}
        onUpload={onProfile}
      />

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
          <Images className="size-4 text-primary" />
          {isAr ? "المعرض" : "Gallery"}
          <span className="text-xs font-normal text-muted-foreground">
            {photos.length}/12
          </span>
        </p>

        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted ring-hairline">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="size-full object-cover" loading="lazy" />
              <button
                onClick={() => removePhoto(p.id)}
                aria-label={isAr ? "حذف" : "Delete"}
                className="absolute end-1 top-1 grid size-6 place-items-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}

          {photos.length < 12 && (
            <div className={cn("aspect-square", photos.length === 0 && "col-span-3 aspect-auto")}>
              <PhotoUploader
                aspect={1}
                maxEdge={1000}
                isAr={isAr}
                hint={isAr ? "أضف صورة للمعرض" : "Add a gallery photo"}
                onUpload={onGalleryAdd}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
