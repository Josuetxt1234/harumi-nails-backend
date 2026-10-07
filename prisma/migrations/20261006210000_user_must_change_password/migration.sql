-- AlterTable
-- Existing rows are backfilled with `true` on purpose: every current password
-- was issued by the seed or by an admin reset, so all of them are temporary.
ALTER TABLE "users"
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;
