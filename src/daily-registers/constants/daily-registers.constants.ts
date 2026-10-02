export const CARD_FEE_RATE = 0.05;

export const DATE_RANGE_PRESETS = [
  'TODAY',
  'YESTERDAY',
  'THIS_WEEK',
  'THIS_MONTH',
  'CUSTOM',
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];
