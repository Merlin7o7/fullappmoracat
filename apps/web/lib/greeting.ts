/**
 * The Saudi welcome — the product's warmest recognition moment (Principle 01,
 * R001). After login and on every return, we greet the owner *through their cat*
 * in Najdi voice: a father is "يبو {cat}", a mother is "أم {cat}".
 *
 * Example: حياك الله يبو مشمش · حياك الله أم لوزة
 *
 * The greeting must feel authentically Saudi and human — never robotic. When we
 * don't yet know gender we still center the cat ("يا أهل {cat}"), and when there's
 * no cat we fall back to a plain, warm welcome. English mirrors the warmth.
 */

export type Gender = "MALE" | "FEMALE" | "UNSPECIFIED";

export interface GreetingInput {
  locale: "ar" | "en";
  gender?: Gender | null;
  primaryCatName?: string | null;
  firstName?: string | null;
}

export interface Greeting {
  /** The headline greeting, e.g. "حياك الله يبو مشمش 🐈". */
  title: string;
  /** Whether the greeting is personalised through a cat (drives emphasis). */
  personalised: boolean;
}

const CAT = "🐈";

export function buildGreeting({ locale, gender, primaryCatName, firstName }: GreetingInput): Greeting {
  const cat = primaryCatName?.trim();
  const name = firstName?.trim();
  const g: Gender = gender ?? "UNSPECIFIED";

  if (locale === "ar") {
    if (cat) {
      if (g === "MALE") return { title: `حياك الله يبو ${cat} ${CAT}`, personalised: true };
      if (g === "FEMALE") return { title: `حياك الله أم ${cat} ${CAT}`, personalised: true };
      // Gender not set yet — stay warm + Saudi, still center the cat.
      return { title: `حياك الله يا أهل ${cat} ${CAT}`, personalised: true };
    }
    if (name) return { title: `حياك الله ${name}`, personalised: false };
    return { title: "حياك الله 🐾", personalised: false };
  }

  // English — mirror the warmth without the Najdi idiom.
  if (cat) {
    if (g === "MALE") return { title: `Welcome back, ${cat}'s dad ${CAT}`, personalised: true };
    if (g === "FEMALE") return { title: `Welcome back, ${cat}'s mom ${CAT}`, personalised: true };
    return { title: `Welcome back, ${cat}'s family ${CAT}`, personalised: true };
  }
  if (name) return { title: `Welcome back, ${name}`, personalised: false };
  return { title: "Welcome back 🐾", personalised: false };
}
