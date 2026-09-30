export function toMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
