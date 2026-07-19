"use client";

/**
 * The scanner (MRC-VET-001 §11).
 *
 * It should feel like an airport e-gate: you barely aim, it has already
 * answered. Continuous decode, no shutter button, and a failure ladder that
 * never dead-ends — three seconds without a read brings tips, an unreadable
 * code offers the printed number instead, a foreign QR says so plainly.
 *
 * Three device realities, one page:
 *   • Phone/tablet — rear camera, tap-to-torch for dim receptions.
 *   • Desktop — a webcam if there is one; otherwise the hardware wedge scanner
 *     (which works from any screen anyway) and the typed number.
 *   • No camera, or permission denied — say so honestly and hand over the path
 *     that always works. A denied permission is not an error state.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CameraOff,
  Flashlight,
  Keyboard,
  Loader2,
  ScanLine,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { Badge, Button, Card, cn } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { useOnline } from "@/lib/offline";
import {
  canonicalCatIdNumber,
  extractScanToken,
  pushRecentLookup,
  useVetActor,
  useVetApi,
  vetFriendlyError,
} from "@/lib/vet-api";
import { EmptyState } from "@/components/vet/vet-shell-bits";

/* The BarcodeDetector API isn't in TypeScript's DOM lib yet. */
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

type CameraState = "idle" | "starting" | "live" | "denied" | "unsupported" | "failed";

/** How long a blank viewfinder is allowed to stay silent before it helps. */
const TIP_DELAY_MS = 3000;
/** Past this, a lookup owes the operator a word rather than a frozen reticle. */
const SLOW_LOOKUP_MS = 800;

export default function VetScanPage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const router = useRouter();
  const api = useVetApi();
  const { can } = useVetActor();
  const online = useOnline();

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const busyRef = React.useRef(false);

  const [camera, setCamera] = React.useState<CameraState>("idle");
  const [torchOn, setTorchOn] = React.useState(false);
  const [torchAvailable, setTorchAvailable] = React.useState(false);
  const [showTips, setShowTips] = React.useState(false);
  const [manual, setManual] = React.useState("");
  const [looking, setLooking] = React.useState(false);
  const [slow, setSlow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [wedgeSeen, setWedgeSeen] = React.useState(false);

  const allowed = can("patient.search");

  /* ── The one pipeline every input funnels into ─────────────────────────── */
  const resolve = React.useCallback(
    async (raw: string, source: "camera" | "manual") => {
      const token = extractScanToken(raw);
      if (!token || busyRef.current) return;
      busyRef.current = true;
      setError(null);
      setLooking(true);
      const slowTimer = setTimeout(() => setSlow(true), SLOW_LOOKUP_MS);
      try {
        const res = await api.searchPatients(token);
        const hit = res.results?.[0];
        if (!hit) {
          setError(
            isAr
              ? "قرأنا البطاقة، لكن ما لقينا عضواً بهذا الرقم. تأكد من الرقم المطبوع تحت الرمز، أو جرّب جوال المالك."
              : "We read the card, but no member matches it. Check the number printed under the code, or try the owner's phone."
          );
          return;
        }
        pushRecentLookup({
          catId: hit.catId,
          name: hit.name,
          catIdNumber: hit.catIdNumber,
          photoUrl: hit.photoUrl ?? null,
        });
        if (source === "camera" && navigator.vibrate) navigator.vibrate(12);
        router.push(`/vet/patients/${encodeURIComponent(hit.catId)}`);
      } catch (err) {
        setError(vetFriendlyError(err, isAr).message);
      } finally {
        clearTimeout(slowTimer);
        setSlow(false);
        setLooking(false);
        // A short cool-down stops one card from firing the same lookup twice.
        setTimeout(() => {
          busyRef.current = false;
        }, 1200);
      }
    },
    [api, isAr, router],
  );

  /* ── Camera ─────────────────────────────────────────────────────────────── */
  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setTorchOn(false);
    setTorchAvailable(false);
  }, []);

  const startCamera = React.useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCamera("unsupported");
      return;
    }
    setCamera("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      const track = stream.getVideoTracks()[0];
      const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
      setTorchAvailable(!!caps.torch);
      setCamera("live");
    } catch (err) {
      const name = (err as DOMException)?.name;
      setCamera(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "failed");
    }
  }, []);

  React.useEffect(() => {
    if (!allowed) return;
    void startCamera();
    return () => stopCamera();
  }, [allowed, startCamera, stopCamera]);

  // Continuous decode. Runs only while the camera is live and the tab is visible.
  React.useEffect(() => {
    if (camera !== "live") return;
    const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Ctor) {
      // Camera works, decoding doesn't: honest about which half is missing.
      setCamera("unsupported");
      stopCamera();
      return;
    }
    const detector = new Ctor({ formats: ["qr_code"] });
    let cancelled = false;
    const tick = async () => {
      if (cancelled || !videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const codes = await detector.detect(videoRef.current);
        const value = codes?.[0]?.rawValue;
        if (value && !cancelled) void resolve(value, "camera");
      } catch {
        /* a dropped frame is not an error worth showing anyone */
      }
    };
    const id = setInterval(() => void tick(), 220);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [camera, resolve, stopCamera]);

  // Silence gets help, not a shrug.
  React.useEffect(() => {
    if (camera !== "live") return;
    setShowTips(false);
    const t = setTimeout(() => setShowTips(true), TIP_DELAY_MS);
    return () => clearTimeout(t);
  }, [camera]);

  const toggleTorch = React.useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }, [torchOn]);

  // A hardware scanner needs no mode — the global wedge listener in the omnibox
  // already works from here. This only *acknowledges* one so staff know.
  React.useEffect(() => {
    let last = 0;
    let run = 0;
    const onKey = (e: KeyboardEvent) => {
      const now = Date.now();
      if (e.key.length === 1) {
        run = now - last < 35 ? run + 1 : 1;
        if (run >= 6) setWedgeSeen(true);
      }
      last = now;
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (!allowed) {
    return (
      <div className="mx-auto w-full max-w-md py-10">
        <EmptyState
          tone="boundary"
          icon={ShieldCheck}
          title={isAr ? "المسح خارج نطاق دورك" : "Scanning isn't part of your role"}
          body={
            isAr
              ? "مدير العيادة يقدر يمنحك صلاحية البحث عن المرضى إذا كان عملك على الكاونتر."
              : "A clinic manager can grant you patient lookup if you work the counter."
          }
        />
      </div>
    );
  }

  const manualCanonical = canonicalCatIdNumber(manual);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold leading-tight sm:text-2xl">
            {isAr ? "امسح بطاقة العضو" : "Scan a member's card"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {isAr
              ? "قرّب البطاقة من الكاميرا — تُقرأ وحدها، بدون زر."
              : "Hold the card up — it reads itself, no button to press."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {wedgeSeen && (
            <Badge variant="success" dot>
              {isAr ? "الماسح السلكي جاهز" : "Hardware scanner ready"}
            </Badge>
          )}
          {!online && (
            <Badge variant="secondary">
              <WifiOff className="size-3" aria-hidden />
              {isAr ? "دون اتصال" : "Offline"}
            </Badge>
          )}
        </div>
      </header>

      {!online && (
        <p
          role="status"
          className="rounded-xl border border-border bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground"
        >
          {/*
            Honest copy. This previously promised that "signed cards still
            verify" offline — they do not: OfflinePassKey is referenced by no
            application code, there is no Ed25519 verification anywhere, and the
            QR carries an opaque token with nothing to check locally. Staff who
            believed it would tell a waiting member their card was bad.
          */}
          {isAr
            ? "لا يوجد اتصال — التحقق من الهوية يحتاج الشبكة، فما نقدر نتأكد من العضوية الآن. نعيد المحاولة تلقائياً أول ما يرجع الاتصال. قلنا لك قبل ما تمسح، لا بعد."
            : "You're offline — verifying a Cat ID needs the network, so we can't confirm membership right now. We'll retry automatically the moment you're back. We're telling you before you scan, not after."}
        </p>
      )}

      {/* ── Viewfinder ── */}
      <Card className="overflow-hidden p-0">
        <div className="relative aspect-[4/3] w-full bg-[hsl(var(--foreground)/0.92)] sm:aspect-[16/10]">
          <video
            ref={videoRef}
            playsInline
            muted
            aria-label={isAr ? "عدسة المسح" : "Scanner viewfinder"}
            className={cn(
              "size-full object-cover transition-opacity duration-300",
              camera === "live" ? "opacity-100" : "opacity-0",
            )}
          />

          {/* Reticle — a frame to aim at, dimmed so the camera isn't fighting the UI. */}
          {camera === "live" && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="relative size-[62%] max-h-64 max-w-64 rounded-3xl border-2 border-white/70 shadow-[0_0_0_100vmax_rgba(0,0,0,0.35)]" />
            </div>
          )}

          {camera === "starting" && (
            <div className="absolute inset-0 grid place-items-center text-white">
              <p className="flex items-center gap-2 text-sm" role="status">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {isAr ? "نفتح الكاميرا…" : "Opening the camera…"}
              </p>
            </div>
          )}

          {(camera === "denied" || camera === "unsupported" || camera === "failed" || camera === "idle") && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
              <div className="flex max-w-sm flex-col items-center gap-3">
                <span className="grid size-12 place-items-center rounded-2xl bg-white/10" aria-hidden>
                  <CameraOff className="size-5" />
                </span>
                <p className="text-sm font-medium">
                  {camera === "denied"
                    ? isAr
                      ? "الكاميرا غير مسموح بها في هذا المتصفح"
                      : "The camera isn't allowed in this browser"
                    : camera === "unsupported"
                      ? isAr
                        ? "هذا المتصفح لا يقرأ الرموز"
                        : "This browser can't decode codes"
                      : isAr
                        ? "ما قدرنا نشغّل الكاميرا"
                        : "We couldn't start the camera"}
                </p>
                <p className="text-xs leading-relaxed text-white/75">
                  {camera === "denied"
                    ? isAr
                      ? "افتح إعدادات الموقع في المتصفح واسمح بالكاميرا، ثم اضغط إعادة المحاولة. أو استخدم الماسح السلكي أو اكتب الرقم — الطريقتان تعملان الآن."
                      : "Allow camera access in this site's browser settings and try again. Or use the hardware scanner or type the number — both work right now."
                    : isAr
                      ? "استخدم الماسح السلكي أو اكتب الرقم المطبوع تحت الرمز — كلاهما يعطي نفس النتيجة."
                      : "Use the hardware scanner or type the number printed under the code — both reach the same answer."}
                </p>
                <Button size="sm" variant="glass" onClick={() => void startCamera()}>
                  {isAr ? "أعد المحاولة" : "Try the camera again"}
                </Button>
              </div>
            </div>
          )}

          {/* Loading honesty: two words rather than a frozen reticle (R119). */}
          {looking && (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/55 px-4 py-2.5 text-xs font-medium text-white">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              <span role="status">
                {slow
                  ? isAr
                    ? "نتحقق من العضوية…"
                    : "Checking membership…"
                  : isAr
                    ? "قرأناها…"
                    : "Got it…"}
              </span>
            </div>
          )}

          {camera === "live" && torchAvailable && (
            <button
              type="button"
              onClick={() => void toggleTorch()}
              aria-pressed={torchOn}
              aria-label={isAr ? "إضاءة الكاميرا" : "Camera light"}
              className="absolute end-3 top-3 grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Flashlight className={cn("size-5", torchOn && "text-butter")} aria-hidden />
            </button>
          )}
        </div>

        {camera === "live" && showTips && (
          <p className="border-t border-border px-4 py-2.5 text-center text-xs text-muted-foreground">
            {isAr
              ? "املأ الإطار بالبطاقة · جرّب الإضاءة إذا كان المكان معتماً · أو اكتب الرقم أدناه"
              : "Fill the frame with the card · try the light if the room is dim · or type the number below"}
          </p>
        )}
      </Card>

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5">
          <p className="text-xs leading-relaxed text-muted-foreground">{error}</p>
        </div>
      )}

      {/* ── The path that always works ── */}
      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) void resolve(manual, "manual");
          }}
          className="flex flex-col gap-2"
        >
          <label htmlFor="vet-scan-manual" className="flex items-center gap-2 text-sm font-medium">
            <Keyboard className="size-4 text-muted-foreground" aria-hidden />
            {isAr ? "أو اكتب الرقم المطبوع تحت الرمز" : "Or type the number printed under the code"}
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="vet-scan-manual"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="MRC-7H2K-94QF"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-4 font-mono text-sm uppercase tracking-wide shadow-e1 outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" loading={looking} disabled={!manual.trim()}>
              <ScanLine className="size-4" aria-hidden />
              {isAr ? "ابحث" : "Look up"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {manualCanonical
              ? isAr
                ? `سنبحث عن ${manualCanonical}`
                : `We'll look up ${manualCanonical}`
              : isAr
                ? "الشرطات وحالة الأحرف لا تهم. يقبل أيضاً رقم الشريحة أو جوال المالك."
                : "Hyphens and capitals don't matter. A microchip number or the owner's phone works too."}
          </p>
        </form>
      </Card>
    </div>
  );
}
