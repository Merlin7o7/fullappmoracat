# Moracat — 3D placement map & commission list (AD 2.1)

_2026-10-01 · companion to `DESIGN-AUTHORITY.md` (AD 2.1 amendment) and `photography.md`_

The founder's twelve renders in `apps/web/public/brand/3d/` are the **only** 3D
assets. Nothing generated or from stock replaces them. Every placement goes
through `Illo3D` (`apps/web/components/illo-3d.tsx`) or `IlloPanel`.

## The rules
- **One object per viewport or chapter.** Two objects are never in view together.
- **Size:** at least 64px. Below that, use the flat stickers (`illustrations.tsx`).
- **Never in distress contexts:** a lost cat, a medical alert, a found-cat
  report, the scan page while lost mode is on. Never stand a render in for a
  missing *cat photo* on a lost/found post. A plush cat there can be read as
  the cat itself (fixed 2026-10-01: four fallbacks now use a neutral glyph).
- **Never as an icon, never recoloured, never with text on it.**
- **Still by default.** A slow float is allowed on the hero only. Error pages
  and footers do not animate (fixed 2026-10-01).

## Inventory
| File | Object | Finish |
|---|---|---|
| cat-plush / cat-metal | cat | plush · metal |
| mouse-plush-pink / mouse-plush-green / mouse-metal | mouse | plush ×2 · metal |
| can-plush / can-metal | can | plush · metal |
| heart-plush / heart-metal | heart | plush · metal |
| fish-plush | fish | plush |
| paw-plush | paw | plush |
| leaf-metal | leaf | metal |

## Placement map (what each object *means*)
| Object | Meaning | Where it lives |
|---|---|---|
| **cat** | the member, identity | homepage "your cat" chapter, `/portal` with no cats, profile hero without a photo, yearly keepsake without a photo, `/community`, `/adopt`, `/transfer/[token]`, `/benefits`, `/about`, 404 |
| **heart** | care, health, help | homepage care chapter, `/portal/care` empty state, health record empty, `/vet-directory`, `/contact`, `/portal/support`, welcome |
| **can** | the box, commerce | `/products`, `/portal/subscriptions`, `/portal/orders`, admin vet-demo card |
| **paw** | discovery, community | `/portal/discover` |
| **mouse** | play, news, gentle errors | `/blog`, `/portal/notifications`, `error.tsx` (still) |
| **fish / leaf** | reserved | homepage chapters only (food, wellbeing). Not yet used elsewhere. |

**Not allowed:** the lost-mode banner, the lost poster, `/c/[token]` in lost
mode, lost/found post photos, vet clinical screens (the vet portal stays dense
and has no decoration), invoices, the health summary `/h/[token]`.

## Commission list (for the founder: same artist, same lighting, both finishes)
In priority order. Each one replaces a real gap where a flat sticker or an
icon is doing a 3D job today:
1. **Collar with tag:** the Cat ID's physical object. Needed for the homepage
   identity chapter, the Wallet pass preview and the scan-page explainer.
2. **QR tag (on its own):** the scan page and the "how finders reach you"
   explainer.
3. **Bowl:** the care chapter and feeding reminders (today the heart covers it).
4. **Carrier:** vet visits, clinic directory and the hand-over/adoption ceremony.
5. **Ribbon or rosette:** birthdays and the yearly keepsake cover.
6. **Kitten** (a small version of the cat): the kitten-year wedge and kitten
   onboarding (MRC-STRAT-001).
7. **Open archive book:** the timeline/album chapter and the keepsake.

Specification: 2000px transparent PNG, the same three-quarter camera as
`cat-plush`, soft contact shadow baked out (Illo3D adds its own). The web copy is
a 1024px squared WebP.
