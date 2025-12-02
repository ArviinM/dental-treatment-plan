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
      {/* Treatment Items Cards */}
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Item #{index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => removeRow(item.id)}
                disabled={items.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Item Code</label>
                <Input
                  value={item.itemCode}
                  onChange={(e) =>
                    updateItem(item.id, 'itemCode', e.target.value)
                  }
                  placeholder="e.g. 011"
                  list="item-codes"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tooth</label>
                <Input
                  value={item.tooth}
                  onChange={(e) =>
                    updateItem(item.id, 'tooth', e.target.value)
                  }
                  placeholder="e.g. 23"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Fee ($)</label>
                <Input
                  type="number"
                  value={item.fee || ''}
                  onChange={(e) =>
                    updateItem(item.id, 'fee', parseFloat(e.target.value) || 0)
                  }
                  placeholder="0"
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Description</label>
              <textarea
                value={item.description}
                onChange={(e) =>
                  updateItem(item.id, 'description', e.target.value)
                }
                placeholder="Enter treatment description (supports multiple lines)..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                rows={3}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold">TOTAL AMOUNT:</span>
          <span className="text-2xl font-bold text-sia-purple">{formattedTotal}</span>
        </div>
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

