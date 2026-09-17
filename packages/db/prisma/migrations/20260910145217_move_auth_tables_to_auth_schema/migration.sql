-- Hand-written, not generated: `prisma migrate diff` treats a schema change as brand-new
-- tables and emits CREATE TABLE in "auth" while leaving the populated "public" ones behind.
-- SET SCHEMA moves each table with its rows, indexes, constraints and sequences intact.

CREATE SCHEMA IF NOT EXISTS "auth";

ALTER TABLE "public"."user" SET SCHEMA "auth";
ALTER TABLE "public"."session" SET SCHEMA "auth";
ALTER TABLE "public"."account" SET SCHEMA "auth";
ALTER TABLE "public"."verification" SET SCHEMA "auth";
ALTER TABLE "public"."organization" SET SCHEMA "auth";
ALTER TABLE "public"."team" SET SCHEMA "auth";
ALTER TABLE "public"."teamMember" SET SCHEMA "auth";
ALTER TABLE "public"."member" SET SCHEMA "auth";
ALTER TABLE "public"."invitation" SET SCHEMA "auth";
