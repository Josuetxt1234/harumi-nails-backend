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
