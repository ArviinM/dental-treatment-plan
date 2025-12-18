import { useMemo } from 'react';
import type { TreatmentItem } from '@/types';

export function useFeeCalculator(items: TreatmentItem[]) {
  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const itemTotal = (item.fees || []).reduce(
        (feeSum, fee) => feeSum + (fee.quantity || 0) * (fee.unitFee || 0),
        0
      );
      return sum + itemTotal;
    }, 0);
  }, [items]);

  const itemCount = useMemo(() => {
    return items.filter(item => item.itemCode).length;
  }, [items]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return {
    totalAmount,
    itemCount,
    formattedTotal: formatCurrency(totalAmount),
    formatCurrency,
  };
}

