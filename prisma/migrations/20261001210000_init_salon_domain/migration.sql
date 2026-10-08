-- Baseline for POS, advances and payroll.
-- These tables were missing from init_rbac_sessions / init_inventory, so
-- later ALTERs on "advances" failed on a fresh Railway database.

CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD');
CREATE TYPE "AdvanceStatus" AS ENUM ('PENDING', 'APPLIED', 'CANCELLED');
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'CLOSED', 'PAID');

CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "commissionPercentage" DECIMAL(5,2) NOT NULL DEFAULT 50.00,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedById" TEXT,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payrolls" (
    "id" TEXT NOT NULL,
    "mesaUserId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "grossSales" DECIMAL(10,2) NOT NULL,
    "baseCommissionTotal" DECIMAL(10,2) NOT NULL,
    "weekendBonusTotal" DECIMAL(10,2) NOT NULL,
    "advancesDeductionTotal" DECIMAL(10,2) NOT NULL,
    "netPayable" DECIMAL(10,2) NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "daily_registers" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "subtotalBase" DECIMAL(10,2) NOT NULL,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "cardFeeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "totalPaid" DECIMAL(10,2) NOT NULL,
    "totalCommission" DECIMAL(10,2) NOT NULL,
    "mesaUserId" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "payrollId" TEXT,

    CONSTRAINT "daily_registers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "daily_register_details" (
    "id" TEXT NOT NULL,
    "dailyRegisterId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "commissionRate" DECIMAL(5,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "lineSubtotal" DECIMAL(10,2) NOT NULL,
    "lineCommission" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "daily_register_details_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "advances" (
    "id" TEXT NOT NULL,
    "mesaUserId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AdvanceStatus" NOT NULL DEFAULT 'PENDING',
    "payrollId" TEXT,
    "createdById" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advances_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "services_category_idx" ON "services"("category");
CREATE INDEX "services_isDeleted_idx" ON "services"("isDeleted");
CREATE INDEX "services_isActive_idx" ON "services"("isActive");

CREATE INDEX "payrolls_mesaUserId_idx" ON "payrolls"("mesaUserId");
CREATE INDEX "payrolls_status_idx" ON "payrolls"("status");
CREATE INDEX "payrolls_periodStart_periodEnd_idx" ON "payrolls"("periodStart", "periodEnd");
CREATE INDEX "payrolls_mesaUserId_periodStart_periodEnd_idx" ON "payrolls"("mesaUserId", "periodStart", "periodEnd");
CREATE INDEX "payrolls_isDeleted_idx" ON "payrolls"("isDeleted");
CREATE INDEX "payrolls_closedById_idx" ON "payrolls"("closedById");

CREATE INDEX "daily_registers_mesaUserId_idx" ON "daily_registers"("mesaUserId");
CREATE INDEX "daily_registers_isDeleted_idx" ON "daily_registers"("isDeleted");
CREATE INDEX "daily_registers_createdAt_idx" ON "daily_registers"("createdAt");
CREATE INDEX "daily_registers_paymentMethod_idx" ON "daily_registers"("paymentMethod");
CREATE INDEX "daily_registers_payrollId_idx" ON "daily_registers"("payrollId");

CREATE INDEX "daily_register_details_dailyRegisterId_idx" ON "daily_register_details"("dailyRegisterId");
CREATE INDEX "daily_register_details_serviceId_idx" ON "daily_register_details"("serviceId");

CREATE INDEX "advances_mesaUserId_idx" ON "advances"("mesaUserId");
CREATE INDEX "advances_status_idx" ON "advances"("status");
CREATE INDEX "advances_date_idx" ON "advances"("date");
CREATE INDEX "advances_payrollId_idx" ON "advances"("payrollId");
CREATE INDEX "advances_isDeleted_idx" ON "advances"("isDeleted");
CREATE INDEX "advances_mesaUserId_status_isDeleted_idx" ON "advances"("mesaUserId", "status", "isDeleted");

ALTER TABLE "services" ADD CONSTRAINT "services_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "services" ADD CONSTRAINT "services_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "services" ADD CONSTRAINT "services_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_mesaUserId_fkey" FOREIGN KEY ("mesaUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "daily_registers" ADD CONSTRAINT "daily_registers_mesaUserId_fkey" FOREIGN KEY ("mesaUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_registers" ADD CONSTRAINT "daily_registers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_registers" ADD CONSTRAINT "daily_registers_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_registers" ADD CONSTRAINT "daily_registers_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "payrolls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "daily_register_details" ADD CONSTRAINT "daily_register_details_dailyRegisterId_fkey" FOREIGN KEY ("dailyRegisterId") REFERENCES "daily_registers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_register_details" ADD CONSTRAINT "daily_register_details_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "advances" ADD CONSTRAINT "advances_mesaUserId_fkey" FOREIGN KEY ("mesaUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "advances" ADD CONSTRAINT "advances_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "advances" ADD CONSTRAINT "advances_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "payrolls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
