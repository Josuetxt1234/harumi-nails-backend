import { toMoney } from '../../../common/utils/money.util';

export const VOUCHER_NOTIFICATION_COPY = {
  createdTitle: 'Nuevo Vale Registrado',
  cancelledTitle: 'Vale Anulado',
} as const;

export function formatVoucherAmount(amount: number): string {
  return toMoney(amount).toFixed(2);
}

export function buildVoucherCreatedMessage(
  actorName: string,
  amount: number,
  mesaName: string,
): string {
  return `El usuario ${actorName} registró un vale de $${formatVoucherAmount(amount)} para ${mesaName}.`;
}

export function buildVoucherCancelledMessage(
  actorName: string,
  amount: number,
  mesaName: string,
  reason: string,
): string {
  return `El usuario ${actorName} anuló el vale de $${formatVoucherAmount(amount)} de ${mesaName}. Motivo: ${reason}.`;
}

export function formatUserDisplayName(
  firstName?: string | null,
  lastName?: string | null,
): string {
  const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();
  return fullName || 'Usuario';
}

export const PAYROLL_NOTIFICATION_COPY = {
  generatedTitle: 'Nómina generada',
  generatedMesaTitle: 'Borrador de tu nómina',
  generatedMesaMessage:
    'Se ha generado el borrador de tu nómina semanal. Por favor revisa los detalles de tus trabajos y vales antes del cierre.',
  updatedMesaTitle: 'Borrador actualizado',
  updatedMesaMessage:
    'Se ha actualizado el borrador de tu nómina semanal. Revisa los nuevos detalles de tus trabajos y vales.',
  closedTitle: 'Nómina cerrada',
  closedMesaTitle: 'Liquidación confirmada',
} as const;

export function buildPayrollGeneratedAdminMessage(
  actorName: string,
  mesaName: string,
  periodLabel: string,
  netPayable: number,
): string {
  return `El usuario ${actorName} generó la nómina de ${mesaName} (${periodLabel}). Neto a pagar: $${formatVoucherAmount(netPayable)}.`;
}

export function buildPayrollClosedAdminMessage(
  actorName: string,
  mesaName: string,
  periodLabel: string,
  netPayable: number,
): string {
  return `El usuario ${actorName} cerró la nómina de ${mesaName} (${periodLabel}). Neto congelado: $${formatVoucherAmount(netPayable)}.`;
}

export function buildPayrollClosedMesaMessage(
  mesaName: string,
  periodLabel: string,
  netPayable: number,
): string {
  return `${mesaName}, tu liquidación del periodo ${periodLabel} quedó cerrada. Neto: $${formatVoucherAmount(netPayable)}.`;
}
