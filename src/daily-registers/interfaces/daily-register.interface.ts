import { PaymentMethod } from '@prisma/client';

export interface DailyRegisterDetailResponse {
  id: string;
  serviceId: string;
  serviceName: string;
  unitPrice: number;
  commissionRate: number;
  quantity: number;
  lineSubtotal: number;
  lineCommission: number;
}

export interface DailyRegisterResponse {
  id: string;
  clientName: string;
  paymentMethod: PaymentMethod;
  subtotalBase: number;
  discountAmount: number;
  cardFeeAmount: number;
  totalPaid: number;
  totalCommission: number;
  mesaUserId: string;
  mesaUserName?: string;
  createdById: string;
  createdByName?: string;
  createdAt: Date;
  updatedAt: Date;
  details: DailyRegisterDetailResponse[];
}

export interface PaginatedDailyRegisters {
  data: DailyRegisterResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    totalPaid: number;
    totalCommission: number;
    servicesCount: number;
  };
}

export interface ListDailyRegistersFilters {
  start: Date;
  end: Date;
  mesaUserId?: string;
  paymentMethod?: PaymentMethod;
  page: number;
  limit: number;
}

export interface TodayRegistersFilters {
  startOfDay: Date;
  endOfDay: Date;
  mesaUserId?: string;
}

export interface CreateDailyRegisterDetailData {
  serviceId: string;
  unitPrice: number;
  commissionRate: number;
  quantity: number;
  lineSubtotal: number;
  lineCommission: number;
}

export interface CreateDailyRegisterData {
  clientName: string;
  paymentMethod: PaymentMethod;
  subtotalBase: number;
  discountAmount: number;
  cardFeeAmount: number;
  totalPaid: number;
  totalCommission: number;
  mesaUserId: string;
  createdById: string;
  details: CreateDailyRegisterDetailData[];
}
