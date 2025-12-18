import { useCallback } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TreatmentItem, FeeItem, FeeEntry } from '@/types';

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
      { 
        id: generateId(), 
        itemCode: '', 
        description: '', 
        tooth: '', 
        fees: [{ id: generateId(), quantity: 1, unitFee: 0 }] 
      },
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
    (id: string, field: keyof TreatmentItem, value: any) => {
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
              // Reset fees with the single fee from schedule
              updated.fees = [{ id: generateId(), quantity: 1, unitFee: feeItem.fee }];
            }
          }

          return updated;
        })
      );
    },
    [items, feeSchedule, onItemsChange]
  );

  const updateFee = useCallback(
    (itemId: string, feeId: string, field: keyof FeeEntry, value: number) => {
      onItemsChange(
        items.map((item) => {
          if (item.id !== itemId) return item;
          return {
            ...item,
            fees: item.fees.map((f) => 
              f.id === feeId ? { ...f, [field]: value } : f
            ),
          };
        })
      );
    },
    [items, onItemsChange]
  );

  const addFeeEntry = useCallback(
    (itemId: string) => {
      onItemsChange(
        items.map((item) => {
          if (item.id !== itemId) return item;
          return {
            ...item,
            fees: [...item.fees, { id: generateId(), quantity: 1, unitFee: 0 }],
          };
        })
      );
    },
    [items, onItemsChange]
  );

  const removeFeeEntry = useCallback(
    (itemId: string, feeId: string) => {
      onItemsChange(
        items.map((item) => {
          if (item.id !== itemId) return item;
          if (item.fees.length <= 1) return item;
          return {
            ...item,
            fees: item.fees.filter((f) => f.id !== feeId),
          };
        })
      );
    },
    [items, onItemsChange]
  );

  return (
    <div className="space-y-4">
      {/* Treatment Items Cards */}
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="rounded-lg border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-sia-purple">
                TREATMENT ITEM #{index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => removeRow(item.id)}
                disabled={items.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Item Code</Label>
                <Input
                  value={item.itemCode}
                  onChange={(e) =>
                    updateItem(item.id, 'itemCode', e.target.value)
                  }
                  placeholder="e.g. 011"
                  className="font-mono"
                  list="item-codes"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tooth / Area</Label>
                <Input
                  value={item.tooth}
                  onChange={(e) =>
                    updateItem(item.id, 'tooth', e.target.value)
                  }
                  placeholder="e.g. 11-15"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</Label>
              <textarea
                value={item.description}
                onChange={(e) =>
                  updateItem(item.id, 'description', e.target.value)
                }
                placeholder="Enter treatment description..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                rows={3}
              />
            </div>

            <div className="space-y-3 pt-2 border-t border-dashed">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quantities & Fees</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-[10px] px-2"
                  onClick={() => addFeeEntry(item.id)}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Fee Row
                </Button>
              </div>

              <div className="space-y-2">
                {item.fees.map((fee, fIndex) => (
                  <div key={fee.id} className="flex items-end gap-3 bg-muted/30 p-2 rounded-md">
                    <div className="w-20 space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Qty</Label>
                      <Input
                        type="number"
                        min="1"
                        value={fee.quantity}
                        onChange={(e) => updateFee(item.id, fee.id, 'quantity', parseInt(e.target.value) || 1)}
                        className="h-8 text-sm px-2"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Unit Fee ($)</Label>
                      <Input
                        type="number"
                        value={fee.unitFee}
                        onChange={(e) => updateFee(item.id, fee.id, 'unitFee', parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm px-2"
                      />
                    </div>
                    <div className="w-24 space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Total</Label>
                      <div className="h-8 flex items-center px-2 text-sm font-semibold bg-background border rounded-md">
                        ${(fee.quantity * fee.unitFee).toLocaleString()}
                      </div>
                    </div>
                    {item.fees.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeFeeEntry(item.id, fee.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="rounded-lg border bg-sia-purple/5 p-4 mt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Grand Total</span>
            <p className="text-xs text-muted-foreground">Estimated treatment cost</p>
          </div>
          <span className="text-3xl font-black text-sia-purple tracking-tight">{formattedTotal}</span>
        </div>
      </div>

      <Button type="button" variant="outline" onClick={addRow} className="w-full h-12 border-dashed border-2 hover:bg-sia-purple/5 hover:text-sia-purple hover:border-sia-purple/50">
        <Plus className="h-5 w-5 mr-2" />
        Add New Treatment Section
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

