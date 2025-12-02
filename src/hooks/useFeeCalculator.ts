import { useMemo } from 'react';
import type { TreatmentItem } from '@/types';

export function useFeeCalculator(items: TreatmentItem[]) {
  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.fee || 0), 0);
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

