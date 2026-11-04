'use client';

import * as React from 'react';
import { Topbar } from '../../../components/topbar';
import { pageMain, pageStack } from '../../../components/design';
import { useToast } from '../../../components/toast-notification';
import { Plus, Utensils, Tag, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@sena/ui';
import { PageLoadState } from '../../../components/page-load-state';

export default function RestaurantMenuPage() {
  const toast = useToast();
  const [categories, setCategories] = React.useState<any[]>([]);
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [addItemOpen, setAddItemOpen] = React.useState(false);
  const [addCatOpen, setAddCatOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // New item inputs
  const [name, setName] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [priceNaira, setPriceNaira] = React.useState('');
  const [costNaira, setCostNaira] = React.useState('0');
  const [description, setDescription] = React.useState('');
  const [station, setStation] = React.useState('kitchen');
  const [prepTime, setPrepTime] = React.useState('15');

  // New category inputs
  const [catName, setCatName] = React.useState('');

  const fetchMenu = React.useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/restaurant/menu');
      if (!res.ok) throw new Error('Failed to load menu');
      const data = await res.json();
      setCategories(data.categories || []);
      setItems(data.items || []);
      if (data.categories?.length > 0 && !categoryId) {
        setCategoryId(data.categories[0].id);
      }
    } catch (err: any) {
      setLoadError(true);
      toast.error('Menu', err.message);
    } finally {
      setLoading(false);
    }
  }, [categoryId, toast]);

  React.useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  async function handleCreateItem(e: React.FormEvent) {
    e.preventDefault();
    const priceNum = Number(priceNaira);
    if (!name.trim() || isNaN(priceNum) || priceNum <= 0 || !categoryId) {
      toast.error('Validation', 'Name, valid price, and category are required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/restaurant/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'item',
          categoryId,
          name: name.trim(),
          description: description.trim() || null,
          priceMinorUnits: priceNum * 100,
          costMinorUnits: (Number(costNaira) || 0) * 100,
          preparationStation: station,
          preparationTimeMinutes: Number(prepTime) || 15,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create item');

      toast.success('Dish Added', `${data.item.name} added to menu`);
      setAddItemOpen(false);
      setName('');
      setDescription('');
      setPriceNaira('');
      setCostNaira('0');
      fetchMenu();
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/restaurant/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'category',
          name: catName.trim(),
          displayOrder: categories.length + 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create category');

      toast.success('Category Added', data.category.name);
      setAddCatOpen(false);
      setCatName('');
      fetchMenu();
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && items.length === 0) {
    return <PageLoadState title="Menu Catalog" failed={loadError} failureKind="error" retry={fetchMenu} />;
  }

  return (
    <div className={pageStack + ' min-h-screen bg-[#FAF9F7]'}>
      <Topbar title="Menu Catalog" />

      <main className={pageMain + ' max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-8'}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-serif text-[#71382D]">Food & Beverage Catalog</h1>
            <p className="text-xs text-[#7A7267] mt-0.5">
              Categories, menu pricing, kitchen prep stations, and recipe costs.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setAddCatOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#E8E1D5] bg-white hover:bg-[#FAF7F2] text-xs font-semibold text-[#191816] transition-colors cursor-pointer"
            >
              <Tag className="w-4 h-4 text-[#71382D]" />
              <span>Add Category</span>
            </button>
            <button
              type="button"
              onClick={() => setAddItemOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Menu Item</span>
            </button>
          </div>
        </div>

        {/* Categories Sections */}
        {categories.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-[#E8E1D5] text-xs text-[#7A7267] space-y-3">
            <Utensils className="w-10 h-10 text-[#D5CFC7] mx-auto" />
            <h3 className="text-base font-serif text-[#71382D]">No menu categories yet</h3>
            <p>Create a category like &ldquo;Main Dishes&rdquo; or &ldquo;Drinks&rdquo; to start organizing your menu.</p>
          </div>
        ) : (
          categories.map((cat) => {
            const catItems = items.filter((it) => it.categoryId === cat.id);

            return (
              <div key={cat.id} className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#E8E1D5] pb-2">
                  <h2 className="text-base font-serif text-[#191816] font-semibold">{cat.name}</h2>
                  <span className="text-xs font-mono text-[#8C8275]">{catItems.length} items</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl border border-[#E8E1D5] bg-white shadow-xs space-y-3 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <h3 className="text-sm font-serif font-semibold text-[#191816]">{item.name}</h3>
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#FAF7F2] text-[#71382D] border border-[#E8E1D5]">
                            {item.preparationStation}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-[#7A7267] line-clamp-2 mt-1 leading-snug">
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-[#E8E1D5] flex items-center justify-between text-xs">
                        <div>
                          <span className="font-mono font-bold text-sm text-[#71382D]">
                            ₦{(item.priceMinorUnits / 100).toLocaleString()}
                          </span>
                          {item.costMinorUnits > 0 && (
                            <span className="block text-[10px] text-[#8C8275] font-mono">
                              Cost: ₦{(item.costMinorUnits / 100).toLocaleString()}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-[#8C8275] font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{item.preparationTimeMinutes}m</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* Add Item Dialog */}
      {addItemOpen && (
        <Dialog open={true} onOpenChange={() => setAddItemOpen(false)}>
          <DialogContent className="max-w-md bg-white border border-[#E8E1D5]">
            <DialogHeader>
              <DialogTitle className="text-lg font-serif text-[#71382D]">Add Menu Item</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreateItem} className="space-y-4 pt-2 text-xs">
              <div>
                <label className="block font-semibold text-[#191816] mb-1">
                  Dish / Item Name <span className="text-[#B85C3E]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grilled Salmon with Asparagus"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#191816] mb-1">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] bg-white focus:outline-none focus:border-[#71382D]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">
                    Selling Price (₦) <span className="text-[#B85C3E]">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="7500"
                    value={priceNaira}
                    onChange={(e) => setPriceNaira(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Ingredient Cost (₦)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="2500"
                    value={costNaira}
                    onChange={(e) => setCostNaira(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Kitchen Station</label>
                  <select
                    value={station}
                    onChange={(e) => setStation(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] bg-white focus:outline-none focus:border-[#71382D]"
                  >
                    <option value="kitchen">Main Kitchen</option>
                    <option value="grill">Grill / BBQ</option>
                    <option value="bar">Bar Counter</option>
                    <option value="dessert">Pastry / Dessert</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Prep Time (Mins)</label>
                  <input
                    type="number"
                    min="1"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#191816] mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Ingredients, allergen notices, or preparation notes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-4">
                <button
                  type="button"
                  onClick={() => setAddItemOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#E8E1D5] text-xs font-medium text-[#191816]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs"
                >
                  {submitting ? 'Adding…' : 'Add to Menu'}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Category Dialog */}
      {addCatOpen && (
        <Dialog open={true} onOpenChange={() => setAddCatOpen(false)}>
          <DialogContent className="max-w-md bg-white border border-[#E8E1D5]">
            <DialogHeader>
              <DialogTitle className="text-lg font-serif text-[#71382D]">Add Menu Category</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreateCategory} className="space-y-4 pt-2 text-xs">
              <div>
                <label className="block font-semibold text-[#191816] mb-1">
                  Category Name <span className="text-[#B85C3E]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Appetizers, Cocktails, Desserts"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-4">
                <button
                  type="button"
                  onClick={() => setAddCatOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#E8E1D5] text-xs font-medium text-[#191816]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs"
                >
                  {submitting ? 'Saving…' : 'Add Category'}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
