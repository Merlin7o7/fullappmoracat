-- Branch city backfill (data only, idempotent).
--
-- A branch knows its city two ways: city_code (census list — what directory
-- search reads) and city_id (delivery-city table). Branches created outside the
-- registration wizard (legacy apply path, demo seed, portal edits) set only
-- city_id, so they vanished from every city search. Stamp the census code from
-- the delivery city wherever it is missing; a branch with neither stays NULL
-- and is fixed from /admin/partners (PATCH …/branches/:id/city).
UPDATE "partner_branches" AS b
SET "cityCode" = c."slug"
FROM "cities" AS c
WHERE b."cityId" = c."id"
  AND b."cityCode" IS NULL
  AND c."slug" IN (
    'riyadh','jeddah','makkah','madinah','dammam','khobar','dhahran','ahsa','qatif','jubail',
    'taif','buraidah','unaizah','hail','tabuk','abha','khamis-mushait','najran','jazan','yanbu',
    'baha','arar','sakaka','qurayyat'
  );
