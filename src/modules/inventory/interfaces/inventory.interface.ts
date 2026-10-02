import { CatalogStatus, InventoryMovementType, MaterialUnit } from '@prisma/client';

export interface InventoryCategoryResponse {
  id: string;
  name: string;
  description: string | null;
  status: CatalogStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaterialResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  unit: MaterialUnit;
  currentStock: number;
  minimumStock: number;
  costPrice: number;
  status: CatalogStatus;
  isLowStock: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryMovementResponse {
  id: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  type: InventoryMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  createdById: string;
  createdByName: string;
  createdAt: Date;
}

export interface MaterialDetailResponse extends MaterialResponse {
  movements: InventoryMovementResponse[];
}

export interface PaginatedMaterials {
  data: MaterialResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PaginatedMovements {
  data: InventoryMovementResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ListMaterialsFilters {
  search?: string;
  categoryId?: string;
  lowStockOnly: boolean;
  status?: CatalogStatus;
  page: number;
  limit: number;
}

export interface ListMovementsFilters {
  materialId?: string;
  type?: InventoryMovementType;
  start?: Date;
  end?: Date;
  page: number;
  limit: number;
}
