export const INVENTORY_ERROR_MESSAGES = {
  CATEGORY_NOT_FOUND: 'Category not found.',
  CATEGORY_NAME_TAKEN: 'A category with this name already exists.',
  MATERIAL_NOT_FOUND: 'Material not found.',
  MATERIAL_CODE_TAKEN: 'Material code already exists.',
  INSUFFICIENT_STOCK: 'Insufficient stock to perform output movement',
  MATERIAL_INACTIVE: 'Cannot register movements on an inactive material.',
  INVALID_DATE_RANGE:
    'startDate and endDate must be valid dates, and startDate cannot be after endDate.',
  INVALID_ADJUSTMENT_STOCK: 'Adjustment stock cannot be negative.',
} as const;
