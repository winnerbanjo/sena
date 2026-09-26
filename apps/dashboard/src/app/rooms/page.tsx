'use client';

import { PageLoadState, readJsonResponse } from '../../components/page-load-state';
import * as React from 'react';
import Link from 'next/link';
import { formatNaira } from '@sena/config';
import { Badge, Button } from '@sena/ui';
import {
  Bed,
  CheckCircle2,
  FolderPlus,
  Layers,
  Plus,
  Search,
  Tag,
  Trash2,
  Users,
} from 'lucide-react';
import {
  type RoomCategory,
  type RoomItem,
} from '../../components/mock-data';
import { AddCategoryDialog } from '../../components/add-category-dialog';
import { AddRoomDialog } from '../../components/add-room-dialog';
import { Topbar } from '../../components/topbar';

export default function RoomsPage() {
  const [activeTab, setActiveTab] = React.useState<'rooms' | 'categories'>('rooms');
  const [filter, setFilter] = React.useState('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Dialog states
  const [addRoomOpen, setAddRoomOpen] = React.useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = React.useState(false);
  const [preselectedCategory, setPreselectedCategory] = React.useState<string | undefined>(undefined);

  // Success alert message
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // Persistent Rooms & Categories state from PostgreSQL
  const [rooms, setRooms] = React.useState<RoomItem[]>([]);
  const [categories, setCategories] = React.useState<RoomCategory[]>([]);
  const [loadError, setLoadError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const fetchRoomsData = React.useCallback(async () => {
    try {
      const res = await fetch('/api/rooms', { cache: 'no-store' });
      if (!res.ok) throw new Error('Page unavailable');
      if (res.ok) {
        let data: any = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }

        if (data.rooms && data.roomTypes) {
          const mappedRooms: RoomItem[] = data.rooms.map((r: any) => {
            let img = '';
            if (r.notes) {
              try {
                const parsed = JSON.parse(r.notes);
                if (parsed?.imageUrl) img = parsed.imageUrl;
              } catch {}
            }
            if (!img && r.categoryImages && r.categoryImages.length > 0) {
              img = r.categoryImages[0];
            }

            return {
              id: r.id,
              number: r.roomNumber,
              type: r.roomTypeName,
              floor: r.floor || 'Floor 1',
              operational: r.operationalStatus || 'available',
              housekeeping: r.housekeepingStatus || 'clean',
              imageUrl: img || undefined,
            };
          });

          const mappedCats: RoomCategory[] = data.roomTypes.map((rt: any) => ({
            id: rt.id,
            name: rt.name,
            code: rt.name.slice(0, 3).toUpperCase(),
            bedType: rt.bedType,
            baseRateMinorUnits: rt.basePriceMinorUnits,
            maxGuests: rt.capacity || 2,
            amenities: rt.amenities || [],
            description: rt.description || '',
            imageUrl: rt.images?.[0] || undefined,
            images: rt.images || [],
          }));

          setRooms(mappedRooms);
          setCategories(mappedCats);
        }
      }
    } catch (err) {
      setLoadError(true);
      console.error('Failed to load rooms:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchRoomsData();
  }, [fetchRoomsData]);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  // Handle Add Room (persists to PostgreSQL)
  async function handleAddRoom(newRoom: RoomItem) {
    try {
      const matchedCategory = categories.find((c) => c.name === newRoom.type);
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_room',
          roomNumber: newRoom.number,
          roomTypeId: matchedCategory?.id,
          floor: newRoom.floor,
          imageUrl: newRoom.imageUrl,
        }),
      });

      if (res.ok) {
        showToast(`Room ${newRoom.number} added to inventory successfully!`);
        fetchRoomsData();
      } else {
        let errMsg = 'Failed to add room';
        try {
          const err = await res.json();
          if (err.error) errMsg = err.error;
        } catch {
          errMsg = `Server error (${res.status})`;
        }
        showToast(errMsg);
      }
    } catch (e: any) {
      showToast(e.message || 'Error saving room');
    }
  }

  // Handle Add Multiple Rooms (Batch)
  async function handleAddRooms(newRooms: RoomItem[]) {
    if (newRooms.length === 0) return;
    if (newRooms.length === 1) return handleAddRoom(newRooms[0]);

    try {
      let activeProp = '';
      try {
        const authUser = JSON.parse(localStorage.getItem('sena_auth_user') || '{}');
        activeProp = authUser?.property || localStorage.getItem('sena_property_name') || '';
      } catch {}

      const first = newRooms[0];
      const matchedCategory = categories.find((c) => c.name === first.type);
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-property-name': activeProp,
        },
        body: JSON.stringify({
          action: 'create_bulk_rooms',
          roomNumbers: newRooms.map((r) => r.number),
          roomTypeId: matchedCategory?.id,
          floor: first.floor,
          imageUrl: first.imageUrl,
        }),
      });

      if (res.ok) {
        showToast(`${newRooms.length} rooms added to "${first.type}" category successfully!`);
        fetchRoomsData();
      } else {
        let errMsg = 'Failed to add rooms';
        try {
          const err = await res.json();
          if (err.error) errMsg = err.error;
        } catch {
          errMsg = `Server error (${res.status})`;
        }
        showToast(errMsg);
      }
    } catch (e: any) {
      showToast(e.message || 'Error saving rooms');
    }
  }

  // Handle Add Category (persists to PostgreSQL)
  async function handleAddCategory(newCategory: RoomCategory) {
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_category',
          name: newCategory.name,
          bedType: newCategory.bedType,
          basePriceMinorUnits: newCategory.baseRateMinorUnits,
          description: newCategory.description,
          capacity: newCategory.maxGuests,
          amenities: newCategory.amenities,
          imageUrl: newCategory.imageUrl,
          images: newCategory.images,
        }),
      });

      if (res.ok) {
        showToast(`Category "${newCategory.name}" created! You can now add rooms to it.`);
        fetchRoomsData();
      } else {
        let errMsg = 'Failed to add category';
        try {
          const err = await res.json();
          if (err.error) errMsg = err.error;
        } catch {
          errMsg = `Server error (${res.status})`;
        }
        showToast(errMsg);
      }
    } catch (e: any) {
      showToast(e.message || 'Error saving category');
    }
  }

  // Handle Delete Room (deletes from PostgreSQL)
  async function handleDeleteRoom(id: string, num: string) {
    if (confirm(`Are you sure you want to remove Room ${num} from inventory?`)) {
      try {
        const res = await fetch(`/api/rooms?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
          showToast(`Room ${num} removed.`);
          fetchRoomsData();
        }
      } catch (e: any) {
        showToast(e.message || 'Failed to delete room');
      }
    }
  }

  // Handle Delete Category — permanently removes from DB
  async function handleDeleteCategory(id: string, name: string) {
    const assignedCount = rooms.filter((r) => r.type === name).length;
    const confirmMsg = assignedCount > 0
      ? `Delete "${name}" and its ${assignedCount} assigned room(s)? This cannot be undone.`
      : `Delete room category "${name}"? This cannot be undone.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/rooms?id=${id}&type=category`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Category "${name}" deleted.`);
        fetchRoomsData();
      } else {
        let errMsg = 'Failed to delete category';
        try {
          const err = await res.json();
          if (err.error) errMsg = err.error;
        } catch {}
        showToast(errMsg);
      }
    } catch (e: any) {
      showToast(e.message || 'Error deleting category');
    }
  }
  // Filtered rooms
  const filteredRooms = rooms.filter((r) => {
    if (filter === 'occupied' && r.operational !== 'occupied') return false;
    if (filter === 'available' && r.operational !== 'available') return false;
    if (filter === 'maintenance' && r.operational !== 'maintenance') return false;
    if (filter === 'dirty' && r.housekeeping !== 'dirty') return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.number.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        r.floor.toLowerCase().includes(q)
      );
    }

    return true;
  });

  if (loading || loadError) return <PageLoadState title="Rooms" failed={loadError} />;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      <Topbar title="Rooms" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="p-3 bg-[#EBF5ED] border border-[#C6E4CC] text-[#2E6B4F] rounded text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-xs font-semibold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Header with Title and Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E2DA] pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#191816]">
              Rooms & Categories
            </h2>
            <p className="text-xs text-[#7A7267] mt-1">
              Configure room inventory, room types, pricing tiers, and real-time readiness.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAddCategoryOpen(true)}
              className="flex items-center gap-1.5 text-xs"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Add category</span>
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setPreselectedCategory(undefined);
                setAddRoomOpen(true);
              }}
              className="flex items-center gap-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add room</span>
            </Button>
          </div>
        </div>

        {/* View Switcher: All Rooms vs Categories */}
        <div className="flex items-center justify-between gap-4 border-b border-[#E8E2DA] pb-3 flex-wrap">
          <div className="flex items-center gap-2 bg-[#FAFAFA] p-1 rounded-md border border-[#E8E2DA]">
            <button
              onClick={() => setActiveTab('rooms')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === 'rooms'
                  ? 'bg-white text-[#191816] shadow-sm font-semibold'
                  : 'text-[#7A7267] hover:text-[#191816]'
              }`}
            >
              <Bed className="w-3.5 h-3.5" />
              <span>All Rooms ({rooms.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('categories')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === 'categories'
                  ? 'bg-white text-[#191816] shadow-sm font-semibold'
                  : 'text-[#7A7267] hover:text-[#191816]'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Room Categories ({categories.length})</span>
            </button>
          </div>

          {activeTab === 'rooms' && (
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#7A7267]" />
              <input
                type="text"
                placeholder="Filter room #, type, floor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs text-[#191816] w-full focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
              />
            </div>
          )}
        </div>

        {/* TAB 1: ALL ROOMS */}
        {activeTab === 'rooms' && (
          <div className="space-y-6">
            {/* Editorial Inventory Status Bar */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-6 py-2.5 px-4 rounded-lg bg-[#FAF9F6] border border-[#E8E2DA] text-xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A7267] hidden sm:inline">
                Inventory Pulse:
              </span>
              <button
                onClick={() => setFilter('all')}
                className={`transition-colors ${filter === 'all' ? 'text-[#191816] font-semibold underline underline-offset-4 decoration-[#B85C3E]' : 'text-[#7A7267] hover:text-[#191816]'}`}
              >
                All ({rooms.length})
              </button>
              <span className="text-[#E8E2DA]">·</span>
              <button
                onClick={() => setFilter('available')}
                className={`inline-flex items-center gap-1.5 transition-colors ${filter === 'available' ? 'text-[#191816] font-semibold underline underline-offset-4 decoration-[#2E6B4F]' : 'text-[#7A7267] hover:text-[#191816]'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E6B4F]" />
                Ready ({rooms.filter((r) => r.operational === 'available').length})
              </button>
              <span className="text-[#E8E2DA]">·</span>
              <button
                onClick={() => setFilter('occupied')}
                className={`inline-flex items-center gap-1.5 transition-colors ${filter === 'occupied' ? 'text-[#191816] font-semibold underline underline-offset-4 decoration-[#71382D]' : 'text-[#7A7267] hover:text-[#191816]'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#71382D]" />
                Occupied ({rooms.filter((r) => r.operational === 'occupied').length})
              </button>
              <span className="text-[#E8E2DA]">·</span>
              <button
                onClick={() => setFilter('dirty')}
                className={`inline-flex items-center gap-1.5 transition-colors ${filter === 'dirty' ? 'text-[#191816] font-semibold underline underline-offset-4 decoration-[#B85C3E]' : 'text-[#7A7267] hover:text-[#191816]'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#B85C3E]" />
                Turnover ({rooms.filter((r) => r.housekeeping === 'dirty' || r.housekeeping === 'cleaning').length})
              </button>
              <span className="text-[#E8E2DA]">·</span>
              <button
                onClick={() => setFilter('maintenance')}
                className={`inline-flex items-center gap-1.5 transition-colors ${filter === 'maintenance' ? 'text-[#191816] font-semibold underline underline-offset-4 decoration-[#7A7267]' : 'text-[#7A7267] hover:text-[#191816]'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#7A7267]" />
                Service ({rooms.filter((r) => r.operational === 'maintenance').length})
              </button>
            </div>

            {/* Room Matrix Grouped by Floor */}
            {filteredRooms.length === 0 ? (
              rooms.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-[#E8E2DA] rounded-lg bg-[#FAF9F6] space-y-3 max-w-md mx-auto my-6">
                  <Bed className="w-8 h-8 mx-auto text-[#B85C3E]" />
                  <p className="text-base font-serif text-[#191816]">No rooms added to inventory yet</p>
                  <p className="text-xs text-[#7A7267] leading-relaxed">
                    Add your physical room numbers (e.g. 101, 102) and assign them to categories to begin taking reservations and managing housekeeping.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setFilter('all');
                      setSearchQuery('');
                      setAddRoomOpen(true);
                    }}
                    className="text-xs mt-1"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add your first room
                  </Button>
                </div>
              ) : (
                <div className="p-12 text-center border border-dashed border-[#E8E2DA] rounded-lg bg-[#FAF9F6] space-y-3">
                  <p className="text-sm font-serif text-[#191816]">No matching rooms found</p>
                  <p className="text-xs text-[#7A7267]">
                    Try clearing your search or filter to view other rooms.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setFilter('all');
                      setSearchQuery('');
                    }}
                    className="text-xs"
                  >
                    Reset filters
                  </Button>
                </div>
              )
            ) : (
              <div className="space-y-8">
                {Array.from(new Set(filteredRooms.map((r) => r.floor || 'Ground Floor'))).map((floorName) => {
                  const floorRooms = filteredRooms.filter((r) => (r.floor || 'Ground Floor') === floorName);
                  return (
                    <div key={floorName} className="space-y-3">
                      <div className="flex items-baseline justify-between border-b border-[#E8E2DA] pb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-serif text-base text-[#191816] font-normal">
                            {floorName}
                          </h3>
                          <span className="text-[11px] font-mono text-[#7A7267]">
                            · {floorRooms.length} {floorRooms.length === 1 ? 'room' : 'rooms'}
                          </span>
                        </div>
                        <span className="text-[10px] uppercase font-mono text-[#7A7267]">
                          {floorRooms.filter(r => r.operational === 'available').length} Available
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                        {floorRooms.map((room) => {
                          const isOccupied = room.operational === 'occupied';
                          const isDirty = room.housekeeping === 'dirty';
                          const isCleaning = room.housekeeping === 'cleaning';
                          const isMaintenance = room.operational === 'maintenance';

                          return (
                            <div
                              key={room.id}
                              className={`bg-white border rounded-lg p-4 transition-all hover:shadow-xs group relative flex flex-col justify-between space-y-3 overflow-hidden ${
                                isOccupied
                                  ? 'border-[#E8E2DA] bg-[#FAF9F6]/50'
                                  : isDirty
                                  ? 'border-[#E5D4BC]'
                                  : 'border-[#E8E2DA]'
                              }`}
                            >
                              {room.imageUrl && (
                                <div className="h-28 -mx-4 -mt-4 mb-1 overflow-hidden relative bg-[#FAF9F6]">
                                  <img
                                    src={room.imageUrl}
                                    alt={`Room ${room.number}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                </div>
                              )}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`w-2 h-2 rounded-full ${
                                        isOccupied
                                          ? 'bg-[#71382D]'
                                          : isMaintenance
                                          ? 'bg-[#7A7267]'
                                          : isDirty
                                          ? 'bg-[#B85C3E]'
                                          : 'bg-[#2E6B4F]'
                                      }`}
                                    />
                                    <strong className="text-base font-serif font-normal text-[#191816]">
                                      Room {room.number}
                                    </strong>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRoom(room.id, room.number)}
                                    title="Delete room"
                                    className="p-1 text-[#7A7267] hover:text-[#B85C3E] rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <span className="text-xs text-[#7A7267] block">
                                  {room.type}
                                </span>
                              </div>

                              <div className="pt-2 border-t border-[#E8E2DA] flex items-center justify-between text-[11px]">
                                <span className="font-mono text-[#7A7267]">
                                  {isDirty ? 'Turnover' : isCleaning ? 'Cleaning' : isOccupied ? 'In-house' : 'Clean & Ready'}
                                </span>
                                {isDirty ? (
                                  <Link
                                    href="/housekeeping"
                                    className="text-[#B85C3E] hover:underline font-medium"
                                  >
                                    Service →
                                  </Link>
                                ) : isOccupied ? (
                                  <Link
                                    href={`/reservations?search=${room.number}`}
                                    className="text-[#71382D] hover:underline font-medium"
                                  >
                                    Folio →
                                  </Link>
                                ) : (
                                  <Link
                                    href="/front-desk"
                                    className="text-[#7A7267] hover:text-[#191816] hover:underline"
                                  >
                                    Assign →
                                  </Link>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ROOM CATEGORIES */}
        {activeTab === 'categories' && (
          <div className="space-y-4">
            {categories.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-[#E8E2DA] rounded-lg bg-[#FAF9F6] space-y-3 max-w-md mx-auto my-6">
                <Layers className="w-8 h-8 mx-auto text-[#B85C3E]" />
                <p className="text-base font-serif text-[#191816]">No room categories defined yet</p>
                <p className="text-xs text-[#7A7267] leading-relaxed">
                  Create room categories (like Executive Suite or Deluxe Studio) to configure nightly rates, maximum guest capacity, bed types, and assign room numbers.
                </p>
                <Button
                  size="sm"
                  onClick={() => setAddCategoryOpen(true)}
                  className="text-xs mt-1"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Create room category
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {categories.map((category) => {
                  const roomCount = rooms.filter((r) => r.type === category.name).length;
                return (
                  <div
                    key={category.id}
                    className="bg-white border border-[#E8E2DA] rounded-md p-5 flex flex-col justify-between space-y-4 hover:border-[#B85C3E]/50 transition-all shadow-none group overflow-hidden"
                  >
                    {category.imageUrl && (
                      <div className="h-32 -mx-5 -mt-5 mb-2 overflow-hidden relative bg-[#FAF9F6]">
                        <img
                          src={category.imageUrl}
                          alt={category.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-serif text-lg font-normal text-[#191816]">
                              {category.name}
                            </h3>
                            <span className="px-1.5 py-0.5 rounded bg-[#FAF9F7] border border-[#E8E2DA] text-[10px] font-mono text-[#7A7267]">
                              {category.code}
                            </span>
                          </div>
                          <span className="text-sm font-serif font-bold text-[#B85C3E] block mt-1">
                            {formatNaira(category.baseRateMinorUnits)}
                            <span className="text-xs font-normal text-[#7A7267]"> / night</span>
                          </span>
                        </div>

                        <Badge variant="clean">
                          {roomCount} {roomCount === 1 ? 'room' : 'rooms'}
                        </Badge>
                      </div>

                      <p className="text-xs text-[#7A7267] leading-relaxed line-clamp-2">
                        {category.description}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-[#191816] pt-1">
                        <div className="flex items-center gap-1.5 text-[#7A7267]">
                          <Bed className="w-3.5 h-3.5 text-[#B85C3E]" />
                          <span>{category.bedType}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[#7A7267]">
                          <Users className="w-3.5 h-3.5 text-[#B85C3E]" />
                          <span>Up to {category.maxGuests} guests</span>
                        </div>
                      </div>

                      {/* Amenities chips */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {category.amenities.slice(0, 4).map((amenity, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-[#FAFAFA] border border-[#E8E2DA] text-[10px] text-[#7A7267]"
                          >
                            {amenity}
                          </span>
                        ))}
                        {category.amenities.length > 4 && (
                          <span className="px-1.5 py-0.5 rounded bg-[#FAFAFA] text-[10px] text-[#7A7267]">
                            +{category.amenities.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#E8E2DA] flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setPreselectedCategory(category.name);
                          setAddRoomOpen(true);
                        }}
                        className="text-xs flex items-center gap-1 flex-1 justify-center"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Room to Tier</span>
                      </Button>

                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(category.id, category.name)}
                        className="p-2 text-[#7A7267] hover:text-[#B85C3E] rounded border border-[#E8E2DA] hover:border-[#B85C3E]/50 transition-colors"
                        title="Delete category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                  </div>
                  </div>
                );
              })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Room Dialog */}
      <AddRoomDialog
        open={addRoomOpen}
        onOpenChange={setAddRoomOpen}
        categories={categories}
        existingRooms={rooms}
        defaultCategory={preselectedCategory}
        onAddRoom={handleAddRoom}
        onAddRooms={handleAddRooms}
        onOpenAddCategory={() => setAddCategoryOpen(true)}
      />

      {/* Add Room Category Dialog */}
      <AddCategoryDialog
        open={addCategoryOpen}
        onOpenChange={setAddCategoryOpen}
        onAddCategory={handleAddCategory}
      />
    </div>
  );
}
