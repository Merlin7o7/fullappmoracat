"use client";

/**
 * Pixel loader — mounts each provider's init snippet ONLY when (a) its env id is
 * configured AND (b) the member has granted consent. No id → no script; no consent →
 * no script. This is the technical enforcement of the PDPL opt-in promise: the tags
 * physically do not exist in the DOM until "accept" is clicked (R106).
 *
 * Mounted once, near the root (see app/layout.tsx). It also drives App-Router SPA
 * pageviews off `usePathname`, and flushes any pre-consent buffered events the moment
 * the tags come online.
 */

import * as React from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { hasConsent, onConsentChange, trackPageview, flushPendingEvents } from "@/lib/analytics";

// All optional — the layer no-ops gracefully for any id left unset.
const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const TIKTOK_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
const SNAPCHAT_PIXEL_ID = process.env.NEXT_PUBLIC_SNAPCHAT_PIXEL_ID;
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;

export function AnalyticsPixels() {
  // Start false on both server and first client render so hydration matches; the real
  // consent value is read in an effect (localStorage is client-only).
  const [granted, setGranted] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setGranted(hasConsent());
    return onConsentChange(setGranted);
  }, []);

  // When the tags come online (consent just granted, or already granted on load),
  // drain anything that was buffered while the member was still deciding.
  React.useEffect(() => {
    if (granted) flushPendingEvents();
  }, [granted]);

  // SPA pageview on every route change, once consent is in place.
  React.useEffect(() => {
    if (granted && pathname) trackPageview(pathname);
  }, [granted, pathname]);

  if (!granted) return null;

  return (
    <>
      {GA4_ID && (
        <>
          <Script
            id="ga4-src"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              // send_page_view:false — we emit SPA pageviews via trackPageview so the
              // count isn't doubled; anonymize_ip keeps IPs out of the report.
              gtag('config', '${GA4_ID}', { anonymize_ip: true, send_page_view: false });
            `}
          </Script>
        </>
      )}

      {META_PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
            n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
            document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}

      {TIKTOK_PIXEL_ID && (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`
            !function (w, d, t) {
              w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
              ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
              ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
              for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
              ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
              ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
              ttq.load('${TIKTOK_PIXEL_ID}');
              ttq.page();
            }(window, document, 'ttq');
          `}
        </Script>
      )}

      {SNAPCHAT_PIXEL_ID && (
        <Script id="snap-pixel" strategy="afterInteractive">
          {`
            (function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){
            a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};
            a.queue=[];var s='script';var r=t.createElement(s);r.async=!0;r.src=n;
            var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u)})(window,
            document,'https://sc-static.net/scevent.min.js');
            snaptr('init', '${SNAPCHAT_PIXEL_ID}');
            snaptr('track', 'PAGE_VIEW');
          `}
        </Script>
      )}

      {CLARITY_ID && (
        <Script id="clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${CLARITY_ID}");
          `}
        </Script>
      )}
    </>
  );
}
