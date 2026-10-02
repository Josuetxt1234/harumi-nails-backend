import { AdvanceStatus } from '@prisma/client';

export interface AdvanceResponse {
  id: string;
  mesaUserId: string;
  mesaUserName: string;
  amount: number;
  reason: string | null;
  date: Date;
  status: AdvanceStatus;
  payrollId: string | null;
  createdById: string;
  createdByName: string;
  cancellationReason: string | null;
  cancelledAt: Date | null;
  cancelledByUserId: string | null;
  cancelledByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedAdvances {
  data: AdvanceResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ListAdvancesFilters {
  mesaUserId?: string;
  status?: AdvanceStatus;
  start?: Date;
  end?: Date;
  page: number;
  limit: number;
}

export interface CreateAdvanceData {
  mesaUserId: string;
  amount: number;
  reason?: string | null;
  date: Date;
  createdById: string;
}

export interface CancelAdvanceData {
  cancellationReason: string;
  cancelledAt: Date;
  cancelledByUserId: string;
}
