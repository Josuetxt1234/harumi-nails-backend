-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('VOUCHER_CREATED', 'VOUCHER_CANCELLED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MESA');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "targetRole" "NotificationRole" NOT NULL DEFAULT 'SUPER_ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_targetRole_idx" ON "notifications"("targetRole");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_targetRole_isRead_createdAt_idx" ON "notifications"("targetRole", "isRead", "createdAt");
