import { Prisma } from '@prisma/client';
import { isSalonWeekend } from '../../common/utils/date.util';
import { toMoney } from '../../common/utils/money.util';
import { WEEKEND_BONUS_RATE } from './constants/payroll.constants';
import { PayrollTotals } from './interfaces/payroll.interface';

export interface PayrollRegisterInput {
  id: string;
  createdAt: Date;
  totalPaid: Prisma.Decimal | number;
  details: Array<{
    lineSubtotal: Prisma.Decimal | number;
    lineCommission: Prisma.Decimal | number;
  }>;
}

export interface PayrollAdvanceInput {
  id: string;
  amount: Prisma.Decimal | number;
}

function toAmount(value: Prisma.Decimal | number): number {
  return toMoney(typeof value === 'number' ? value : value.toNumber());
}

export function calculatePayrollTotals(
  registers: PayrollRegisterInput[],
  advances: PayrollAdvanceInput[],
  timeZone: string,
): PayrollTotals & { registerIds: string[]; advanceIds: string[] } {
  let grossSales = 0;
  let baseCommissionTotal = 0;
  let weekendBonusTotal = 0;

  for (const register of registers) {
    grossSales = toMoney(grossSales + toAmount(register.totalPaid));
    const isWeekend = isSalonWeekend(register.createdAt, timeZone);

    for (const detail of register.details) {
      const lineSubtotal = toAmount(detail.lineSubtotal);
      const lineCommission = toAmount(detail.lineCommission);
      baseCommissionTotal = toMoney(baseCommissionTotal + lineCommission);

      if (isWeekend) {
        weekendBonusTotal = toMoney(
          weekendBonusTotal + toMoney(lineSubtotal * WEEKEND_BONUS_RATE),
        );
      }
    }
  }

  const advancesDeductionTotal = toMoney(
    advances.reduce((sum, advance) => sum + toAmount(advance.amount), 0),
  );

  return {
    grossSales,
    baseCommissionTotal,
    weekendBonusTotal,
    advancesDeductionTotal,
    netPayable: toMoney(
      baseCommissionTotal + weekendBonusTotal - advancesDeductionTotal,
    ),
    registerIds: registers.map((register) => register.id),
    advanceIds: advances.map((advance) => advance.id),
  };
}
