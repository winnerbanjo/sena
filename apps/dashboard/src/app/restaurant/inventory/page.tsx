'use client';

import * as React from 'react';
import { Topbar } from '../../../components/topbar';
import { pageMain, pageStack } from '../../../components/design';
import { useToast } from '../../../components/toast-notification';
import { Plus, AlertTriangle, Package, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@sena/ui';
import { PageLoadState } from '../../../components/page-load-state';

export default function RestaurantInventoryPage() {
  const toast = useToast();
  const [ingredients, setIngredients] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Form inputs
  const [name, setName] = React.useState('');
  const [unit, setUnit] = React.useState('kg');
  const [currentStock, setCurrentStock] = React.useState('10');
  const [minAlert, setMinAlert] = React.useState('5');
  const [costNaira, setCostNaira] = React.useState('1500');
  const [supplier, setSupplier] = React.useState('');

  const fetchInventory = React.useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/restaurant/inventory');
      if (!res.ok) throw new Error('Could not load inventory');
      const data = await res.json();
      setIngredients(data.ingredients || []);
    } catch (err: any) {
      setLoadError(true);
      toast.error('Inventory', err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Validation', 'Ingredient name is required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/restaurant/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          unitOfMeasure: unit,
          currentStock: Number(currentStock) || 0,
          minimumStockAlert: Number(minAlert) || 0,
          costPerUnitMinorUnits: (Number(costNaira) || 0) * 100,
          supplierName: supplier.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add ingredient');

      toast.success('Stock Registered', `${data.ingredient.name} recorded in inventory`);
      setAddOpen(false);
      setName('');
      fetchInventory();
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && ingredients.length === 0) {
    return <PageLoadState title="Recipe Inventory" failed={loadError} failureKind="error" retry={fetchInventory} />;
  }

  const lowStockCount = ingredients.filter(
    (it) => Number(it.currentStock) <= Number(it.minimumStockAlert)
  ).length;

  return (
    <div className={pageStack + ' min-h-screen bg-[#FAF9F7]'}>
      <Topbar title="Recipe Inventory" />

      <main className={pageMain + ' max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6'}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-serif text-[#71382D]">Raw Ingredients & Recipe Inventory</h1>
            <p className="text-xs text-[#7A7267] mt-0.5">
              Track stock levels, reorder threshold alerts, and raw food cost metrics.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Raw Ingredient</span>
          </button>
        </div>

        {/* Low Stock Warning Alert if any */}
        {lowStockCount > 0 && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <span>
                <strong>{lowStockCount} items</strong> are below minimum threshold and require restocking from suppliers.
              </span>
            </div>
          </div>
        )}

        {/* Inventory Roster Table */}
        <div className="bg-white border border-[#E8E1D5] rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-[#E8E1D5] bg-[#FAF7F2]/60 text-[11px] font-mono uppercase tracking-wider text-[#8C8275]">
                  <th className="py-3 px-5 font-medium">Ingredient Name</th>
                  <th className="py-3 px-5 font-medium">Current Stock</th>
                  <th className="py-3 px-5 font-medium">Threshold Alert</th>
                  <th className="py-3 px-5 font-medium">Unit Cost</th>
                  <th className="py-3 px-5 font-medium text-end">Stock Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D5] text-xs">
                {ingredients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-xs text-[#7A7267]">
                      No ingredients tracked yet. Click &ldquo;Add Raw Ingredient&rdquo; to start logging kitchen stock.
                    </td>
                  </tr>
                ) : (
                  ingredients.map((it) => {
                    const stockNum = Number(it.currentStock);
                    const minNum = Number(it.minimumStockAlert);
                    const isLow = stockNum <= minNum;

                    return (
                      <tr key={it.id} className="hover:bg-[#FAF7F2]/40 transition-colors">
                        <td className="py-4 px-5">
                          <strong className="block text-sm text-[#191816] font-semibold">{it.name}</strong>
                          {it.supplierName && (
                            <span className="text-[11px] text-[#8C8275]">Supplier: {it.supplierName}</span>
                          )}
                        </td>
                        <td className="py-4 px-5 font-mono">
                          <span className="font-semibold text-[#191816] text-sm">
                            {Number(it.currentStock).toLocaleString()}
                          </span>
                          <span className="text-xs text-[#8C8275] ml-1">{it.unitOfMeasure}</span>
                        </td>
                        <td className="py-4 px-5 font-mono text-[#8C8275]">
                          <span>{Number(it.minimumStockAlert).toLocaleString()}</span>
                          <span className="text-xs ml-1">{it.unitOfMeasure}</span>
                        </td>
                        <td className="py-4 px-5 font-mono text-[#71382D] font-medium">
                          ₦{(it.costPerUnitMinorUnits / 100).toLocaleString()} / {it.unitOfMeasure}
                        </td>
                        <td className="py-4 px-5 text-end">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-red-50 text-red-700 border border-red-200">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Reorder Needed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>In Stock</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add Ingredient Dialog */}
      {addOpen && (
        <Dialog open={true} onOpenChange={() => setAddOpen(false)}>
          <DialogContent className="max-w-md bg-white border border-[#E8E1D5]">
            <DialogHeader>
              <DialogTitle className="text-lg font-serif text-[#71382D]">Add Raw Ingredient</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleAdd} className="space-y-4 pt-2 text-xs">
              <div>
                <label className="block font-semibold text-[#191816] mb-1">
                  Ingredient Name <span className="text-[#B85C3E]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Basmati Rice, Chicken Breast, Olive Oil"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Unit of Measure</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] bg-white focus:outline-none focus:border-[#71382D]"
                  >
                    <option value="kg">Kilogram (kg)</option>
                    <option value="g">Gram (g)</option>
                    <option value="liter">Liter (L)</option>
                    <option value="ml">Milliliter (ml)</option>
                    <option value="unit">Single Unit / Piece</option>
                    <option value="pack">Pack / Carton</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Unit Cost (₦)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="1500"
                    value={costNaira}
                    onChange={(e) => setCostNaira(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Initial Stock</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={currentStock}
                    onChange={(e) => setCurrentStock(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Low Stock Alert Level</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={minAlert}
                    onChange={(e) => setMinAlert(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#191816] mb-1">Supplier Name</label>
                <input
                  type="text"
                  placeholder="e.g. Prime Farm Distributors LTD"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-4">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#E8E1D5] text-xs font-medium text-[#191816]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs"
                >
                  {submitting ? 'Saving…' : 'Record Ingredient'}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
