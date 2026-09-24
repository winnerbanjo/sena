'use client';

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
  DEFAULT_ROOM_CATEGORIES,
  INITIAL_ROOMS,
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
  const [loading, setLoading] = React.useState(true);

  const fetchRoomsData = React.useCallback(async () => {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        if (data.rooms && data.roomTypes) {
          const mappedRooms: RoomItem[] = data.rooms.map((r: any) => ({
            id: r.id,
            number: r.roomNumber,
            type: r.roomTypeName,
            floor: r.floor || 'Floor 1',
            operational: r.operationalStatus || 'available',
            housekeeping: r.housekeepingStatus || 'clean',
          }));
          const mappedCats: RoomCategory[] = data.roomTypes.map((rt: any) => ({
            id: rt.id,
            name: rt.name,
            code: rt.name.slice(0, 3).toUpperCase(),
            bedType: rt.bedType,
            baseRateMinorUnits: rt.basePriceMinorUnits,
            maxGuests: rt.capacity || 2,
            amenities: rt.amenities || [],
            description: rt.description || '',
          }));
          setRooms(mappedRooms);
          setCategories(mappedCats);
        }
      }
    } catch (err) {
      console.error('Failed to load rooms from DB:', err);
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
        }),
      });
      if (res.ok) {
        showToast(`Room ${newRoom.number} added to inventory successfully!`);
        fetchRoomsData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add room');
      }
    } catch (e: any) {
      alert(e.message || 'Error saving room');
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
        }),
      });
      if (res.ok) {
        showToast(`Category "${newCategory.name}" created! You can now add rooms to it.`);
        fetchRoomsData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add category');
      }
    } catch (e: any) {
      alert(e.message || 'Error saving category');
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
        alert(e.message || 'Failed to delete room');
      }
    }
  }

  // Handle Delete Category
  function handleDeleteCategory(id: string, name: string) {
    const assignedCount = rooms.filter((r) => r.type === name).length;
    if (assignedCount > 0) {
      alert(`Cannot delete category "${name}" because ${assignedCount} room(s) are currently assigned to it.`);
      return;
    }
    if (confirm(`Delete room category "${name}"?`)) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
      showToast(`Category "${name}" removed.`);
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
          <div className="space-y-4">
            {/* Filter Chips */}
            <div className="flex items-center gap-2 text-xs overflow-x-auto whitespace-nowrap pb-1">
              {[
                { id: 'all', label: `All Rooms (${rooms.length})` },
                { id: 'available', label: `Available (${rooms.filter((r) => r.operational === 'available').length})` },
                { id: 'occupied', label: `Occupied (${rooms.filter((r) => r.operational === 'occupied').length})` },
                { id: 'dirty', label: `Needs Cleaning (${rooms.filter((r) => r.housekeeping === 'dirty').length})` },
                { id: 'maintenance', label: `Maintenance (${rooms.filter((r) => r.operational === 'maintenance').length})` },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-3 py-1.5 rounded font-medium transition-colors flex-shrink-0 ${
                    filter === f.id
                      ? 'bg-[#71382D] text-white'
                      : 'text-[#7A7267] bg-[#FAFAFA] border border-[#E8E2DA] hover:bg-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Room Cards Grid */}
            {filteredRooms.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-[#E8E2DA] rounded-md bg-[#FAFAFA] space-y-3">
                <p className="text-sm font-serif text-[#191816]">No matching rooms found</p>
                <p className="text-xs text-[#7A7267]">
                  Try clearing your search or add a new room to this view.
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    setFilter('all');
                    setSearchQuery('');
                    setAddRoomOpen(true);
                  }}
                  className="text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add a room now
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredRooms.map((room) => (
                  <div
                    key={room.id}
                    className="bg-white border border-[#E8E2DA] p-4 rounded-md space-y-3 hover:border-[#7A7267] transition-all group relative flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <strong className="text-xl font-serif text-[#191816]">
                          Room {room.number}
                        </strong>
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant={
                              room.operational === 'occupied'
                                ? 'occupied'
                                : room.operational === 'maintenance'
                                ? 'danger'
                                : 'available'
                            }
                          >
                            {room.operational}
                          </Badge>
                          <button
                            type="button"
                            onClick={() => handleDeleteRoom(room.id, room.number)}
                            title="Delete room"
                            className="p-1 text-[#7A7267] hover:text-[#B85C3E] rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-xs font-medium text-[#191816] block">
                          {room.type}
                        </span>
                        <span className="text-[11px] text-[#7A7267] block">
                          {room.floor}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-[#E8E2DA]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#7A7267]">Housekeeping:</span>
                        <Badge
                          variant={
                            room.housekeeping === 'clean'
                              ? 'clean'
                              : room.housekeeping === 'cleaning'
                              ? 'cleaning'
                              : 'dirty'
                          }
                        >
                          {room.housekeeping}
                        </Badge>
                      </div>

                      {/* Cross-module contextual shortcuts */}
                      <div className="pt-1 flex items-center justify-between text-[11px] font-mono">
                        {room.housekeeping === 'dirty' ? (
                          <Link
                            href="/housekeeping"
                            className="text-[#B85C3E] hover:underline flex items-center gap-1 font-sans"
                          >
                            Open Housekeeping Board →
                          </Link>
                        ) : room.operational === 'occupied' ? (
                          <Link
                            href={`/reservations?search=${room.number}`}
                            className="text-[#71382D] hover:underline flex items-center gap-1 font-sans"
                          >
                            View Reservation →
                          </Link>
                        ) : (
                          <Link
                            href={`/front-desk`}
                            className="text-[#7A7267] hover:text-[#191816] hover:underline flex items-center gap-1 font-sans"
                          >
                            Assign in Front Desk →
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ROOM CATEGORIES */}
        {activeTab === 'categories' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {categories.map((category) => {
                const roomCount = rooms.filter((r) => r.type === category.name).length;
                return (
                  <div
                    key={category.id}
                    className="bg-white border border-[#E8E2DA] rounded-md p-5 flex flex-col justify-between space-y-4 hover:border-[#B85C3E]/50 transition-all shadow-none group"
                  >
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
