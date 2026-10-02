export interface SalonServiceSummary {
  id: string;
  name: string;
  category: string;
  price: number;
  commissionPercentage: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedSalonServices {
  data: SalonServiceSummary[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ListServicesFilters {
  search?: string;
  category?: string;
  isActive?: boolean;
  page: number;
  limit: number;
}

export interface CreateServiceData {
  name: string;
  category: string;
  price: number;
  commissionPercentage: number;
  createdById: string;
}

export interface UpdateServiceData {
  name?: string;
  category?: string;
  price?: number;
  commissionPercentage?: number;
  isActive?: boolean;
  updatedById: string;
}
