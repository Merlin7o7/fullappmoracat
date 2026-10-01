# Moracat voice — the glossary (AD 2.1, 2026-10-01)

Words are interface. This page is the short list every surface follows; the
Design Authority's "Voice" section (R081–R087) is the why.

## Who is speaking

A warm, competent person from Riyadh who loves cats and keeps careful records.
Najdi-warm Arabic, never slang-heavy, never stiff MSA. Calm. Precise about
facts, generous about feelings. The cat is always the subject of the sentence.

## Say / don't say

| Say (ar) | Say (en) | Never |
|---|---|---|
| هوية مرقط | Moracat ID | هوية رسمية · official ID |
| سجل مرقط · سجل قطك | the Moracat register · your cat's record | التعداد الوطني · national census · government |
| منصة خاصة تديرها شركة سعودية | a private platform run by a Saudi company | anything implying a ministry, licence or state backing |
| الرقم التسلسلي | serial | "number N of Saudi cats" |
| قطة مسجّلة في مرقط | cats registered on Moracat | cats in Saudi Arabia (as a count) |
| مقترح — راجع طبيبك | Suggested — check with your vet | any medical schedule stated as advice |
| تنتهي المدة في وقتها؛ التجديد التلقائي اختياري | the term simply ends; auto-renew is optional | "never renews" / "renews automatically" (see core renewal-policy.ts) |
| التوصيل حالياً في الرياض وجدة | delivering in Riyadh and Jeddah for now | "all of Saudi Arabia" for delivery |
| رمز من 6 أرقام | a 6-digit code | password at sign-up |
| أرسل للطبيب | send to the vet | share your data |

## Rules

1. **No claims we can't show.** Every promise on a page must be something the
   product does today (R040). Plans are "later", not "soon" with a date.
2. **Digits are Western (0–9)** in both languages, dates Gregorian unless the
   member chose Hijri, money «199 ر.س» / "SAR 199" — always through
   `packages/core/src/format.ts`.
3. **Counts use real Arabic grammar** — dual and 3–10 / 11+ forms
   (`formatMonths`, `formatAge`, `countLabel`).
4. **No exclamation marks in distress** (lost cat, overdue care, errors).
   No emoji in headings.
5. **One action per screen is named by what it does**: «أصدر الهوية»,
   «أرسل للطبيب», «سجّل الوزن» — never «إرسال» / "Submit".
6. **Startup clichés are banned**: revolutionise, disrupt, ecosystem-as-boast,
   "smart"/«ذكي» labels, "AI-powered".
7. **Legal and medical decisions belong to professionals.** Copy never says a
   step is "compliant", "approved" or "recommended by vets" unless the
   readiness panel (`/admin/readiness`) shows that sign-off as done.
