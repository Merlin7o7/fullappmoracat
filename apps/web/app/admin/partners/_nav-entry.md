Add to the `NAV` array in `apps/web/app/admin/layout.tsx` (after Customers, before Orders):

```ts
{ href: "/admin/partners", icon: Stethoscope, en: "Partners", ar: "الشركاء", perm: "partners.read" },
```

Import `Stethoscope` from `lucide-react` alongside the other nav icons; the page's write actions (approve/reject/verify/suspend) additionally require `partners.write`.
