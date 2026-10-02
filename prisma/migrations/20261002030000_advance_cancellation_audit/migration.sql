-- Audit trail for voucher (advance) cancellations
ALTER TABLE "advances" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "advances" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "advances" ADD COLUMN "cancelledByUserId" TEXT;

CREATE INDEX "advances_cancelledByUserId_idx" ON "advances"("cancelledByUserId");

ALTER TABLE "advances"
ADD CONSTRAINT "advances_cancelledByUserId_fkey"
FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
