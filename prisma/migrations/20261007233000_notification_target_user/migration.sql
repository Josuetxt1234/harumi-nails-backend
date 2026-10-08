-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "target_user_id" TEXT;

-- CreateIndex
CREATE INDEX "notifications_targetUserId_idx" ON "notifications"("target_user_id");

-- CreateIndex
CREATE INDEX "notifications_targetUserId_isRead_createdAt_idx" ON "notifications"("target_user_id", "isRead", "createdAt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_targetUserId_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
