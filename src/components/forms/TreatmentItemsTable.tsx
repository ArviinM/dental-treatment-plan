import { useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TreatmentItem, FeeItem } from '@/types';

interface TreatmentItemsTableProps {
  items: TreatmentItem[];
  feeSchedule: FeeItem[];
  onItemsChange: (items: TreatmentItem[]) => void;
  formattedTotal: string;
}

export function TreatmentItemsTable({
  items,
  feeSchedule,
  onItemsChange,
  formattedTotal,
}: TreatmentItemsTableProps) {
  const generateId = () => Math.random().toString(36).substring(2, 9);

  const addRow = useCallback(() => {
    onItemsChange([
      ...items,
      { id: generateId(), itemCode: '', description: '', tooth: '', fee: 0 },
    ]);
  }, [items, onItemsChange]);

  const removeRow = useCallback(
    (id: string) => {
      if (items.length > 1) {
        onItemsChange(items.filter((item) => item.id !== id));
      }
    },
    [items, onItemsChange]
  );

  const updateItem = useCallback(
    (id: string, field: keyof TreatmentItem, value: string | number) => {
      onItemsChange(
        items.map((item) => {
          if (item.id !== id) return item;

          const updated = { ...item, [field]: value };

          // Auto-fill description and fee when item code changes
          if (field === 'itemCode') {
            const feeItem = feeSchedule.find(
              (f) => f.code.toLowerCase() === String(value).toLowerCase()
            );
            if (feeItem) {
              updated.description = feeItem.description;
              updated.fee = feeItem.fee;
            }
          }

          return updated;
        })
      );
    },
    [items, feeSchedule, onItemsChange]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium w-24">
                Item Code
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                Description
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium w-24">
                Tooth
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium w-28">
                Fee
              </th>
              <th className="px-4 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id} className="group">
                <td className="px-4 py-2">
                  <Input
                    value={item.itemCode}
                    onChange={(e) =>
                      updateItem(item.id, 'itemCode', e.target.value)
                    }
                    placeholder="e.g. 613"
                    className="h-8"
                    list="item-codes"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    value={item.description}
                    onChange={(e) =>
                      updateItem(item.id, 'description', e.target.value)
                    }
                    placeholder="Description auto-fills from code"
                    className="h-8"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    value={item.tooth}
                    onChange={(e) =>
                      updateItem(item.id, 'tooth', e.target.value)
                    }
                    placeholder="e.g. 37"
                    className="h-8"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    value={item.fee || ''}
                    onChange={(e) =>
                      updateItem(item.id, 'fee', parseFloat(e.target.value) || 0)
                    }
                    placeholder="0"
                    className="h-8 text-right"
                  />
                </td>
                <td className="px-4 py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeRow(item.id)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/30">
            <tr>
              <td colSpan={3} className="px-4 py-3 text-right font-semibold">
                TOTAL AMOUNT:
              </td>
              <td className="px-4 py-3 text-right font-bold text-lg">
                {formattedTotal}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Button type="button" variant="outline" onClick={addRow} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Add Treatment Item
      </Button>

      {/* Datalist for autocomplete */}
      <datalist id="item-codes">
        {feeSchedule.map((item) => (
          <option key={item.code} value={item.code}>
            {item.code} - {item.description.substring(0, 50)}...
          </option>
        ))}
      </datalist>
    </div>
  );
}

