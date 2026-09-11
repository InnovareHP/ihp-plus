-- The client dropdowns moved onto lookups.lookupOption, so this table is redundant.
-- Its values are reseeded there under the client* kinds by `pnpm db:seed`.
DROP TABLE IF EXISTS "clients"."clientOption";
