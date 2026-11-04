'use client';

import * as React from 'react';
import Link from 'next/link';
import { Topbar } from '../../components/topbar';
import { pageMain, pageStack } from '../../components/design';
import { useToast } from '../../components/toast-notification';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Building,
  CheckCircle2,
  RefreshCw,
  Utensils,
  Layers,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@sena/ui';
import { PageLoadState } from '../../components/page-load-state';

interface CartItem {
  menuItemId: string;
  name: string;
  unitPriceMinorUnits: number;
  quantity: number;
  preparationStation: string;
  notes?: string;
}

export default function RestaurantPOSPage() {
  const toast = useToast();
  const [categories, setCategories] = React.useState<any[]>([]);
  const [items, setItems] = React.useState<any[]>([]);
  const [tables, setTables] = React.useState<any[]>([]);
  const [inHouseGuests, setInHouseGuests] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);

  // POS State
  const [activeCategory, setActiveCategory] = React.useState<string>('all');
  const [search, setSearch] = React.useState('');
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [orderType, setOrderType] = React.useState<'dine_in' | 'takeout' | 'room_service'>('dine_in');
  const [selectedTableId, setSelectedTableId] = React.useState('');
  const [selectedReservationId, setSelectedReservationId] = React.useState('');
  const [orderNotes, setOrderNotes] = React.useState('');

  // Payment modal state
  const [payModalOpen, setPayModalOpen] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<'cash' | 'card' | 'transfer' | 'room_charge'>('cash');
  const [submitting, setSubmitting] = React.useState(false);
  const [lastOrderSuccess, setLastOrderSuccess] = React.useState<any>(null);

  const fetchCatalog = React.useCallback(async () => {
    setLoadError(false);
    try {
      const [resMenu, resTables, resReservations] = await Promise.all([
        fetch('/api/restaurant/menu'),
        fetch('/api/restaurant/tables'),
        fetch('/api/reservations?status=checked_in'),
      ]);

      if (!resMenu.ok) throw new Error('Could not load menu catalog');
      const dataMenu = await resMenu.json();
      setCategories(dataMenu.categories || []);
      setItems(dataMenu.items || []);

      if (resTables.ok) {
        const dataTables = await resTables.json();
        setTables(dataTables.tables || []);
      }

      if (resReservations.ok) {
        const dataRes = await resReservations.json();
        const inHouse = (dataRes.reservations || []).filter((r: any) => r.status === 'checked_in');
        setInHouseGuests(inHouse);
      }
    } catch (err: any) {
      setLoadError(true);
      toast.error('POS Catalog', err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  function addToCart(item: any) {
    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          unitPriceMinorUnits: item.priceMinorUnits,
          quantity: 1,
          preparationStation: item.preparationStation,
        },
      ];
    });
  }

  function updateQuantity(menuItemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.menuItemId === menuItemId) {
            const nextQty = i.quantity + delta;
            return nextQty > 0 ? { ...i, quantity: nextQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  }

  function removeFromCart(menuItemId: string) {
    setCart((prev) => prev.filter((i) => i.menuItemId !== menuItemId));
  }

  // Cart financial calculations
  const subtotalMinorUnits = cart.reduce(
    (acc, item) => acc + item.unitPriceMinorUnits * item.quantity,
    0
  );
  const taxMinorUnits = Math.round(subtotalMinorUnits * 0.075); // 7.5% VAT
  const serviceChargeMinorUnits = Math.round(subtotalMinorUnits * 0.05); // 5% Service Charge
  const totalAmountMinorUnits = subtotalMinorUnits + taxMinorUnits + serviceChargeMinorUnits;

  async function handleCompleteOrder(payNow: boolean) {
    if (cart.length === 0) return;

    if (orderType === 'dine_in' && !selectedTableId) {
      toast.error('Table Required', 'Please assign a dining table for Dine-in orders');
      return;
    }

    if (paymentMethod === 'room_charge' && !selectedReservationId) {
      toast.error('Room Stay Required', 'Select an in-house guest to charge room folio');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/restaurant/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType,
          tableId: selectedTableId || null,
          reservationId: selectedReservationId || null,
          items: cart,
          notes: orderNotes.trim() || null,
          payNow,
          paymentMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit order');

      setLastOrderSuccess(data.order);
      setCart([]);
      setPayModalOpen(false);
      setOrderNotes('');
      toast.success(
        'Order Placed',
        payNow
          ? `Order ${data.order.orderNumber} settled successfully`
          : `Order ${data.order.orderNumber} sent to Kitchen KDS`
      );
      fetchCatalog();
    } catch (err: any) {
      toast.error('Order Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredItems = items.filter((it) => {
    if (activeCategory !== 'all' && it.categoryId !== activeCategory) return false;
    if (search && !it.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading && items.length === 0) {
    return <PageLoadState title="Restaurant POS" failed={loadError} failureKind="error" retry={fetchCatalog} />;
  }

  return (
    <div className={pageStack + ' min-h-screen bg-[#FAF9F7]'}>
      <Topbar title="Restaurant POS" />

      <main className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden">
        {/* Left Side: Catalog & Search (65% width) */}
        <div className="flex-1 flex flex-col border-e border-[#E8E1D5] overflow-hidden bg-[#FAF9F7]">
          {/* Category Bar and Search */}
          <div className="p-4 border-b border-[#E8E1D5] bg-white space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8C8275]" />
                <input
                  type="text"
                  placeholder="Search dishes, drinks, desserts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 text-xs bg-[#FAF9F7] border border-[#E8E1D5] rounded-lg focus:outline-none focus:border-[#71382D]"
                />
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/kds"
                  className="px-3 py-1.5 rounded-lg border border-[#E8E1D5] bg-white hover:bg-[#FAF7F2] text-xs font-medium text-[#71382D] flex items-center gap-1.5 transition-colors"
                >
                  <Utensils className="w-3.5 h-3.5" />
                  <span>KDS Screen</span>
                </Link>
                <Link
                  href="/restaurant/floor-plan"
                  className="px-3 py-1.5 rounded-lg border border-[#E8E1D5] bg-white hover:bg-[#FAF7F2] text-xs font-medium text-[#71382D] flex items-center gap-1.5 transition-colors"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Floor Plan</span>
                </Link>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-colors cursor-pointer ${
                  activeCategory === 'all'
                    ? 'bg-[#71382D] text-white shadow-xs'
                    : 'bg-[#FAF7F2] text-[#7A7267] hover:text-[#191816] border border-[#E8E1D5]'
                }`}
              >
                All Menu ({items.length})
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategory(c.id)}
                  className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-colors cursor-pointer ${
                    activeCategory === c.id
                      ? 'bg-[#71382D] text-white shadow-xs'
                      : 'bg-[#FAF7F2] text-[#7A7267] hover:text-[#191816] border border-[#E8E1D5]'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Dish Grid */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
            {filteredItems.length === 0 ? (
              <div className="col-span-full py-16 text-center text-xs text-[#7A7267]">
                No menu items found. Go to Menu Catalog to add your dishes.
              </div>
            ) : (
              filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addToCart(item)}
                  className="p-4 rounded-xl border border-[#E8E1D5] bg-white hover:border-[#71382D] hover:shadow-sm text-start flex flex-col justify-between transition-all group cursor-pointer active:scale-95"
                >
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#8C8275]">
                      {item.preparationStation}
                    </span>
                    <h3 className="text-sm font-serif font-semibold text-[#191816] group-hover:text-[#71382D] line-clamp-2 mt-1">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-[11px] text-[#7A7267] line-clamp-2 mt-1 leading-snug">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <div className="pt-3 flex items-center justify-between border-t border-[#E8E1D5]/60 mt-3">
                    <span className="text-sm font-semibold text-[#71382D] font-mono">
                      ₦{(item.priceMinorUnits / 100).toLocaleString()}
                    </span>
                    <span className="w-6 h-6 rounded-full bg-[#FAF4EF] text-[#71382D] flex items-center justify-center group-hover:bg-[#71382D] group-hover:text-white transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Order Cart & Checkout (35% width) */}
        <div className="w-full lg:w-[380px] xl:w-[420px] bg-white flex flex-col justify-between border-t lg:border-t-0 border-[#E8E1D5] shadow-xs">
          {/* Cart Header */}
          <div className="p-4 border-b border-[#E8E1D5] space-y-3 bg-[#FAF7F2]/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[#71382D]" />
                <h2 className="text-sm font-semibold text-[#191816]">Active Order Ticket</h2>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-[11px] text-red-600 hover:underline cursor-pointer"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Order Type Toggle */}
            <div className="grid grid-cols-3 gap-1 bg-[#FAF9F7] p-1 rounded-lg border border-[#E8E1D5] text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setOrderType('dine_in')}
                className={`py-1 rounded text-center transition-colors cursor-pointer ${
                  orderType === 'dine_in' ? 'bg-white shadow-xs text-[#71382D] font-semibold' : 'text-[#7A7267]'
                }`}
              >
                Dine In
              </button>
              <button
                type="button"
                onClick={() => setOrderType('takeout')}
                className={`py-1 rounded text-center transition-colors cursor-pointer ${
                  orderType === 'takeout' ? 'bg-white shadow-xs text-[#71382D] font-semibold' : 'text-[#7A7267]'
                }`}
              >
                Takeout
              </button>
              <button
                type="button"
                onClick={() => setOrderType('room_service')}
                className={`py-1 rounded text-center transition-colors cursor-pointer ${
                  orderType === 'room_service' ? 'bg-white shadow-xs text-[#71382D] font-semibold' : 'text-[#7A7267]'
                }`}
              >
                Room Service
              </button>
            </div>

            {/* Location / Guest selector */}
            {orderType === 'dine_in' && (
              <select
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
                className="w-full h-8 px-2 text-xs bg-white border border-[#E8E1D5] rounded-lg focus:outline-none focus:border-[#71382D]"
              >
                <option value="">Select Table...</option>
                {tables.map((tbl) => (
                  <option key={tbl.id} value={tbl.id}>
                    Table {tbl.tableNumber} ({tbl.capacity} seats, {tbl.section}) - {tbl.status}
                  </option>
                ))}
              </select>
            )}

            {orderType === 'room_service' && (
              <select
                value={selectedReservationId}
                onChange={(e) => setSelectedReservationId(e.target.value)}
                className="w-full h-8 px-2 text-xs bg-white border border-[#E8E1D5] rounded-lg focus:outline-none focus:border-[#71382D]"
              >
                <option value="">Select In-House Guest Room...</option>
                {inHouseGuests.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.roomNumber || r.apartmentName} - {r.guestName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#E8E1D5] p-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-xs text-[#7A7267]">
                <ShoppingCart className="w-8 h-8 text-[#D5CFC7] mb-2" />
                <span>Ticket is empty. Tap any dish on the left to add it to the ticket.</span>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.menuItemId} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex-1 min-w-0">
                    <strong className="block text-[#191816] truncate">{item.name}</strong>
                    <span className="text-[11px] font-mono text-[#8C8275]">
                      ₦{(item.unitPriceMinorUnits / 100).toLocaleString()} each
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.menuItemId, -1)}
                      className="w-6 h-6 rounded bg-[#FAF9F7] border border-[#E8E1D5] flex items-center justify-center hover:bg-[#FAF4EF]"
                    >
                      <Minus className="w-3 h-3 text-[#7A7267]" />
                    </button>
                    <span className="w-6 text-center font-mono font-semibold text-xs">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.menuItemId, 1)}
                      className="w-6 h-6 rounded bg-[#FAF9F7] border border-[#E8E1D5] flex items-center justify-center hover:bg-[#FAF4EF]"
                    >
                      <Plus className="w-3 h-3 text-[#7A7267]" />
                    </button>
                  </div>

                  <div className="text-end min-w-[70px]">
                    <span className="font-mono font-semibold text-[#191816]">
                      ₦{((item.unitPriceMinorUnits * item.quantity) / 100).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Financial Summary & Checkout Buttons */}
          <div className="p-4 border-t border-[#E8E1D5] bg-[#FAF7F2]/60 space-y-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-[#7A7267]">
                <span>Subtotal</span>
                <span className="font-mono">₦{(subtotalMinorUnits / 100).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[#7A7267]">
                <span>VAT (7.5%)</span>
                <span className="font-mono">₦{(taxMinorUnits / 100).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[#7A7267]">
                <span>Service Charge (5%)</span>
                <span className="font-mono">₦{(serviceChargeMinorUnits / 100).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-[#191816] pt-1 border-t border-[#E8E1D5]">
                <span>Total Due</span>
                <span className="font-mono text-[#71382D]">₦{(totalAmountMinorUnits / 100).toLocaleString()}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={cart.length === 0 || submitting}
                onClick={() => handleCompleteOrder(false)}
                className="py-2.5 px-3 rounded-lg border border-[#E8E1D5] bg-white hover:bg-[#FAF7F2] text-xs font-semibold text-[#191816] transition-colors disabled:opacity-40 cursor-pointer"
              >
                Send to Kitchen (KDS)
              </button>
              <button
                type="button"
                disabled={cart.length === 0 || submitting}
                onClick={() => setPayModalOpen(true)}
                className="py-2.5 px-3 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-40 cursor-pointer"
              >
                Settle & Pay Now →
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Payment Settlement Modal */}
      {payModalOpen && (
        <Dialog open={true} onOpenChange={() => setPayModalOpen(false)}>
          <DialogContent className="max-w-md bg-white border border-[#E8E1D5]">
            <DialogHeader>
              <DialogTitle className="text-lg font-serif text-[#71382D]">Settle Bill & Pay</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2 text-xs">
              <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E8E1D5] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-[#7A7267] block">Total Amount Due</span>
                  <span className="text-xl font-bold font-mono text-[#71382D]">
                    ₦{(totalAmountMinorUnits / 100).toLocaleString()}
                  </span>
                </div>
                <span className="text-xs font-mono text-[#8C8275]">{cart.length} items</span>
              </div>

              <div>
                <label className="block font-semibold text-[#191816] mb-2">Select Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-3 rounded-lg border text-start flex items-center gap-2.5 transition-colors cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'border-[#71382D] bg-[#FAF4EF] text-[#71382D] font-semibold'
                        : 'border-[#E8E1D5] hover:bg-[#FAF9F7]'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`p-3 rounded-lg border text-start flex items-center gap-2.5 transition-colors cursor-pointer ${
                      paymentMethod === 'card'
                        ? 'border-[#71382D] bg-[#FAF4EF] text-[#71382D] font-semibold'
                        : 'border-[#E8E1D5] hover:bg-[#FAF9F7]'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Card / POS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('transfer')}
                    className={`p-3 rounded-lg border text-start flex items-center gap-2.5 transition-colors cursor-pointer ${
                      paymentMethod === 'transfer'
                        ? 'border-[#71382D] bg-[#FAF4EF] text-[#71382D] font-semibold'
                        : 'border-[#E8E1D5] hover:bg-[#FAF9F7]'
                    }`}
                  >
                    <Building className="w-4 h-4" />
                    <span>Bank Transfer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('room_charge')}
                    className={`p-3 rounded-lg border text-start flex items-center gap-2.5 transition-colors cursor-pointer ${
                      paymentMethod === 'room_charge'
                        ? 'border-[#71382D] bg-[#FAF4EF] text-[#71382D] font-semibold'
                        : 'border-[#E8E1D5] hover:bg-[#FAF9F7]'
                    }`}
                  >
                    <Building className="w-4 h-4" />
                    <span>Hotel Room Folio</span>
                  </button>
                </div>
              </div>

              {paymentMethod === 'room_charge' && (
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Select In-House Room</label>
                  <select
                    value={selectedReservationId}
                    onChange={(e) => setSelectedReservationId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] bg-white focus:outline-none focus:border-[#71382D]"
                  >
                    <option value="">Select Room...</option>
                    {inHouseGuests.map((r) => (
                      <option key={r.id} value={r.id}>
                        Room {r.roomNumber || r.apartmentName} - {r.guestName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0 pt-4">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#E8E1D5] text-xs font-medium text-[#191816]"
                >
                  Back to Ticket
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleCompleteOrder(true)}
                  className="px-4 py-2 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs"
                >
                  {submitting ? 'Processing Payment…' : 'Confirm & Print Receipt'}
                </button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
