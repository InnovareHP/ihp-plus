-- Rate card sections become a curated lookup list, so a row stores the section's name, not a code.

-- Existing rows move from the old fixed codes to the names they were shown under.
UPDATE "contracts"."catalogItem" SET "category" = CASE "category"
  WHEN 'creative' THEN 'Creative services'
  WHEN 'social' THEN 'Social media services'
  WHEN 'bundle' THEN 'Bundles'
  WHEN 'addon' THEN 'Add-ons'
  ELSE "category"
END;

-- Every organization starts with the old four plus the two it asked for.
INSERT INTO "lookups"."lookupOption" ("id", "organizationId", "kind", "value", "sortOrder")
SELECT gen_random_uuid()::text, o."id", 'catalogSection', s."value", s."sortOrder"
FROM "auth"."organization" o
CROSS JOIN (VALUES
  ('Creative services', 0),
  ('Social media services', 1),
  ('Bundles', 2),
  ('Add-ons', 3),
  ('Website', 4),
  ('IT department', 5)
) AS s("value", "sortOrder")
ON CONFLICT ("organizationId", "kind", "value") DO NOTHING;
