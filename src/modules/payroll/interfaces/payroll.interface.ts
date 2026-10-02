import { PayrollStatus } from '@prisma/client';

export interface PayrollTotals {
  grossSales: number;
  baseCommissionTotal: number;
  weekendBonusTotal: number;
  advancesDeductionTotal: number;
  netPayable: number;
}

export interface PayrollPreview extends PayrollTotals {
  mesaUserId: string;
  mesaUserName: string;
  periodStart: Date;
  periodEnd: Date;
  registerIds: string[];
  advanceIds: string[];
  registersCount: number;
  advancesCount: number;
}

export interface PayrollResponse extends PayrollTotals {
  id: string;
  mesaUserId: string;
  mesaUserName: string;
  periodStart: Date;
  periodEnd: Date;
  status: PayrollStatus;
  closedAt: Date | null;
  closedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedPayrolls {
  data: PayrollResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ListPayrollFilters {
  mesaUserId?: string;
  status?: PayrollStatus;
  page: number;
  limit: number;
}

export interface CreatePayrollData extends PayrollTotals {
  mesaUserId: string;
  periodStart: Date;
  periodEnd: Date;
}
