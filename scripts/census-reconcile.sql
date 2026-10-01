-- Census reconciliation — READ ONLY. Run against production (psql / Neon SQL
-- editor) to see exactly why the homepage count and the latest serial differ.
-- Nothing here writes. Paste the output into the ops log.

-- 1. The homepage number (census.service.ts → registered).
SELECT count(*) AS registered
FROM cats
WHERE "deletedAt" IS NULL AND "isDemo" = false AND "claimStatus" = 'CLAIMED';

-- 2. The highest serial ever issued (issuedThrough), excluding demo cats.
SELECT max("catNumber") AS issued_through FROM cats WHERE "isDemo" = false;

-- 3. Every serial that is NOT in today's count, and why.
SELECT "catNumber",
       CASE
         WHEN "isDemo" THEN 'demo'
         WHEN "deletedAt" IS NOT NULL THEN 'removed'
         WHEN "claimStatus" <> 'CLAIMED' THEN 'clinic record, unclaimed (' || "claimStatus" || ')'
         ELSE 'counted'
       END AS reason
FROM cats
WHERE "isDemo" OR "deletedAt" IS NOT NULL OR "claimStatus" <> 'CLAIMED'
ORDER BY "catNumber";

-- 4. Gaps: serials the sequence consumed with no row at all (rolled-back inserts).
SELECT s AS missing_serial
FROM generate_series(1, (SELECT coalesce(max("catNumber"), 0) FROM cats)) AS s
WHERE NOT EXISTS (SELECT 1 FROM cats WHERE "catNumber" = s)
ORDER BY s;
