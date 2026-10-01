'use client';
import { pageMain } from '../../components/design';
import { useTranslations } from 'next-intl';

import { PageLoadState, readJsonResponse } from '../../components/page-load-state';
import * as React from 'react';
import Link from 'next/link';
import { formatNaira } from '@sena/config';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  StatusBadge,
} from '@sena/ui';
import {
  Bed,
  CheckCircle2,
  FolderPlus,
  Images,
  Layers,
  Plus,
  Search,
  Tag,
  Trash2,
  Users,
} from 'lucide-react';
import {
  type ReservationItem,
  type RoomCategory,
  type RoomItem,
} from '../../components/mock-data';
import { mapReservationItem } from '../../components/reservation-room';
import { AddCategoryDialog } from '../../components/add-category-dialog';
import { AddRoomDialog } from '../../components/add-room-dialog';
import { EditRoomDialog } from '../../components/edit-room-dialog';
import { GalleryCloseWarning, RoomGalleryEditor, type RoomGalleryEditorHandle } from '../../components/room-gallery-editor';
import { closeNeedsUploadWarning } from '@/lib/gallery-upload-queue';
import { galleryDisplayUrls, type GalleryPhoto } from '@/lib/room-gallery';
import { roomDescriptionFromNotes } from '@/lib/room-edit';
import { Topbar } from '../../components/topbar';

export default function RoomsPage() {
  const t = useTranslations('rooms');
  const [activeTab, setActiveTab] = React.useState<'rooms' | 'categories'>('rooms');
  const [filter, setFilter] = React.useState('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Dialog states
  const [addRoomOpen, setAddRoomOpen] = React.useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<RoomCategory | null>(null);
  const [editingRoom, setEditingRoom] = React.useState<RoomItem | null>(null);
  const [photoRoom, setPhotoRoom] = React.useState<RoomItem | null>(null);
  const [photoUploadBusy, setPhotoUploadBusy] = React.useState(false);
  const [photoCloseWarn, setPhotoCloseWarn] = React.useState(false);
  const photoEditorRef = React.useRef<RoomGalleryEditorHandle>(null);
  const [preselectedCategory, setPreselectedCategory] = React.useState<string | undefined>(undefined);

  // Success alert message
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);
  const [assignRoom, setAssignRoom] = React.useState<RoomItem | null>(null);
  const [assignArrivals, setAssignArrivals] = React.useState<ReservationItem[]>([]);
  const [assignLoading, setAssignLoading] = React.useState(false);
  const [assigningId, setAssigningId] = React.useState<string | null>(null);
  const [assignError, setAssignError] = React.useState<string | null>(null);
  const [sendingHousekeepingId, setSendingHousekeepingId] = React.useState<string | null>(null);
  const [menuRoom, setMenuRoom] = React.useState<RoomItem | null>(null);
  const [viewingRoom, setViewingRoom] = React.useState<RoomItem | null>(null);

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
            let legacy = '';
            if (r.notes) {
              try {
                const parsed = JSON.parse(r.notes);
                if (parsed?.imageUrl) legacy = parsed.imageUrl;
              } catch {}
            }
            const gallery = Array.isArray(r.gallery) ? r.gallery : [];
            const ownCover = galleryDisplayUrls(gallery)[0];
            const categoryCover = r.categoryImages?.[0] || '';
            const img = ownCover || legacy || categoryCover;

            return {
              id: r.id,
              number: r.roomNumber,
              type: r.roomTypeName,
              roomTypeId: r.roomTypeId,
              floor: r.floor || 'Floor 1',
              operational: r.operationalStatus || 'available',
              housekeeping: r.housekeepingStatus || 'clean',
              housekeepingAssignee: r.housekeepingAssignee || null,
              description: roomDescriptionFromNotes(r.notes),
              imageUrl: img || undefined,
              gallery,
            };
          });

          const mappedCats: RoomCategory[] = data.roomTypes.map((rt: any) => ({
            id: rt.id,
            name: rt.name,
            code: rt.name.slice(0, 3).toUpperCase(),
            bedType: rt.bedType,
            baseRateMinorUnits: rt.basePriceMinorUnits,
            maxGuests: rt.capacity || 2,
            gallery: Array.isArray(rt.gallery) ? rt.gallery : [],
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

  React.useEffect(() => {
    if (!assignRoom) return;
    setAssignLoading(true);
    setAssignError(null);
    fetch('/api/reservations')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Could not load arrivals'))))
      .then((data) => {
        const mapped: ReservationItem[] = (data.reservations || []).map(mapReservationItem);
        setAssignArrivals(
          mapped.filter(
            (reservation) =>
              reservation.status === 'confirmed' &&
              !reservation.roomId &&
              (assignRoom.roomTypeId
                ? reservation.roomTypeId === assignRoom.roomTypeId
                : reservation.roomType === assignRoom.type)
          )
        );
      })
      .catch((error) => setAssignError(error.message || 'Could not load arrivals'))
      .finally(() => setAssignLoading(false));
  }, [assignRoom]);

  async function handleSendToHousekeeping(room: RoomItem) {
    setSendingHousekeepingId(room.id);
    try {
      const res = await fetch('/api/housekeeping', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ roomId: room.id, action: 'send_to_housekeeping' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send this room to housekeeping.');
      showToast(`Room ${room.number} sent to housekeeping.`);
      fetchRoomsData();
    } catch (error: any) {
      showToast(error.message || 'Could not send this room to housekeeping.');
    } finally {
      setSendingHousekeepingId(null);
    }
  }

  async function handleAssignArrival(reservationId: string) {
    if (!assignRoom) return;
    setAssigningId(reservationId);
    setAssignError(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/assign-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: assignRoom.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not assign this room.');
      showToast(`Room ${assignRoom.number} assigned.`);
      setAssignRoom(null);
      fetchRoomsData();
    } catch (error: any) {
      setAssignError(error.message || 'Could not assign this room.');
    } finally {
      setAssigningId(null);
    }
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
        const data = await res.json().catch(() => ({}));
        showToast(`Room ${newRoom.number} added to inventory successfully!`);
        fetchRoomsData();
        return { ok: true as const, id: data.data?.id as string | undefined };
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
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(`Category "${newCategory.name}" created! You can now add rooms to it.`);
        fetchRoomsData();
        return { ok: true as const, id: data.data?.id as string | undefined };
      } else {
        let errMsg = 'Failed to add category';
        try {
          const err = await res.json();
          if (err.error) errMsg = err.error;
        } catch {
          errMsg = `Server error (${res.status})`;
        }
        showToast(errMsg);
        return { ok: false as const, error: errMsg };
      }
    } catch (e: any) {
      const message = e.message || 'Error saving category';
      showToast(message);
      return { ok: false as const, error: message };
    }
    return { ok: false as const, error: 'Failed to add category' };
  }

  async function handleUpdateCategory(category: RoomCategory) {
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_category',
          id: category.id,
          name: category.name,
          bedType: category.bedType,
          basePriceMinorUnits: category.baseRateMinorUnits,
          description: category.description,
          capacity: category.maxGuests,
          amenities: category.amenities,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { ok: false as const, error: err.error || 'Could not save this category.' };
      }
      showToast(t('categoryUpdated'));
      fetchRoomsData();
      return { ok: true as const };
    } catch (e: any) {
      return { ok: false as const, error: e.message || 'Could not save this category.' };
    }
  }

  async function handleUpdateRoom(room: RoomItem) {
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_room',
          id: room.id,
          roomNumber: room.number,
          roomTypeId: room.roomTypeId,
          floor: room.floor,
          operationalStatus: room.operational,
          housekeepingStatus: room.housekeeping,
          description: room.description || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false as const, error: data.error || t('roomUpdateFailed') };
      showToast(t('roomUpdated'));
      fetchRoomsData();
      return { ok: true as const };
    } catch (e: any) {
      return { ok: false as const, error: e.message || t('roomUpdateFailed') };
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

  function categoryFor(room: RoomItem) {
    return categories.find((category) => category.id === room.roomTypeId) || categories.find((category) => category.name === room.type);
  }

  function roomCardStatus(room: RoomItem): { token: string; label: string; note?: string } {
    if (room.operational === 'maintenance') return { token: 'maintenance', label: t('statusMaintenance') };
    if (room.operational === 'blocked') return { token: 'blocked', label: t('statusBlocked') };
    if (room.operational === 'occupied') {
      const note =
        room.housekeeping === 'dirty'
          ? t('needsCleaning')
          : room.housekeeping === 'cleaning'
            ? t('statusCleaning')
            : room.housekeeping === 'inspection'
              ? t('statusInspection')
              : undefined;
      return { token: 'occupied', label: t('statusOccupied'), note };
    }
    if (room.housekeeping === 'dirty') return { token: 'needs_cleaning', label: t('needsCleaning') };
    if (room.housekeeping === 'cleaning') return { token: 'cleaning', label: t('statusCleaning') };
    if (room.housekeeping === 'inspection') return { token: 'inspected', label: t('statusInspection') };
    return { token: 'available', label: t('cleanReady') };
  }

  if (loading || loadError) return <PageLoadState title={t('title')} failed={loadError} />;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      <Topbar title={t('title')} />

      <main className={pageMain}>
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

        <div className="flex flex-col gap-3 border-b border-[#E8E2DA] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm text-[#7A7267]">
            Configure room inventory, room types, pricing tiers, and real-time readiness.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setAddCategoryOpen(true)}
              className="min-h-11"
            >
              <FolderPlus className="h-4 w-4" />
              <span>{t('addCategory')}</span>
            </Button>
            <Button
              onClick={() => {
                setPreselectedCategory(undefined);
                setAddRoomOpen(true);
              }}
              className="min-h-11"
            >
              <Plus className="h-4 w-4" />
              <span>{t('addRoom')}</span>
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 gap-1 overflow-x-auto border-b border-[#E8E2DA]">
            <button
              type="button"
              onClick={() => setActiveTab('rooms')}
              className={`shrink-0 border-b-2 px-3 py-2 text-[13px] ${
                activeTab === 'rooms'
                  ? 'border-[#71382D] font-medium text-[#191816]'
                  : 'border-transparent text-[#7A7267] hover:text-[#191816]'
              }`}
            >
              {t('allRooms')} ({rooms.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('categories')}
              className={`shrink-0 border-b-2 px-3 py-2 text-[13px] ${
                activeTab === 'categories'
                  ? 'border-[#71382D] font-medium text-[#191816]'
                  : 'border-transparent text-[#7A7267] hover:text-[#191816]'
              }`}
            >
              {t('roomCategories')} ({categories.length})
            </button>
          </div>
          {activeTab === 'rooms' ? (
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7A7267]" />
              <input
                type="text"
                placeholder={t('searchRooms')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded border border-[#E8E2DA] bg-white py-2 pe-3 ps-9 text-[13px] text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
              />
            </div>
          ) : null}
        </div>

        {activeTab === 'rooms' && (
          <div className="space-y-5">
            <div className="flex min-w-0 gap-1 overflow-x-auto border-b border-[#E8E2DA]">
              {[
                { id: 'all', label: t('pulseAll'), count: rooms.length },
                { id: 'available', label: t('pulseReady'), count: rooms.filter((room) => room.operational === 'available').length },
                { id: 'occupied', label: t('pulseOccupied'), count: rooms.filter((room) => room.operational === 'occupied').length },
                { id: 'dirty', label: t('pulseTurnover'), count: rooms.filter((room) => room.housekeeping === 'dirty' || room.housekeeping === 'cleaning').length },
                { id: 'maintenance', label: t('pulseService'), count: rooms.filter((room) => room.operational === 'maintenance').length },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`shrink-0 border-b-2 px-3 py-2 text-[13px] ${
                    filter === item.id
                      ? 'border-[#71382D] font-medium text-[#191816]'
                      : 'border-transparent text-[#7A7267] hover:text-[#191816]'
                  }`}
                >
                  {item.label} ({item.count})
                </button>
              ))}
            </div>

            {filteredRooms.length === 0 ? (
              rooms.length === 0 ? (
                <div className="mx-auto my-6 max-w-md space-y-3 rounded-md border border-dashed border-[#E8E2DA] p-10 text-center">
                  <Bed className="mx-auto h-8 w-8 text-[#B85C3E]" />
                  <p className="text-sm font-semibold text-[#191816]">No rooms added to inventory yet</p>
                  <p className="text-xs leading-relaxed text-[#7A7267]">
                    Add your physical room numbers (e.g. 101, 102) and assign them to categories to begin taking reservations and managing housekeeping.
                  </p>
                  <Button
                    onClick={() => {
                      setFilter('all');
                      setSearchQuery('');
                      setAddRoomOpen(true);
                    }}
                    className="mt-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add your first room
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 rounded-md border border-dashed border-[#E8E2DA] p-10 text-center">
                  <p className="text-sm font-semibold text-[#191816]">No matching rooms found</p>
                  <p className="text-xs text-[#7A7267]">
                    Try clearing your search or filter to view other rooms.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFilter('all');
                      setSearchQuery('');
                    }}
                  >
                    Reset filters
                  </Button>
                </div>
              )
            ) : (
              <div className="space-y-8">
                {Array.from(new Set(filteredRooms.map((room) => room.floor || 'Ground Floor'))).map((floorName) => {
                  const floorRooms = filteredRooms.filter((room) => (room.floor || 'Ground Floor') === floorName);
                  const availableOnFloor = floorRooms.filter((room) => room.operational === 'available').length;
                  return (
                    <div key={floorName} className="min-w-0 space-y-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="flex min-w-0 items-baseline gap-2">
                          <h3 className="truncate text-sm font-semibold text-[#191816]">{floorName}</h3>
                          <span className="shrink-0 text-xs text-[#7A7267]">{t('roomCount', { count: floorRooms.length })}</span>
                        </div>
                        <span className="shrink-0 text-xs text-[#7A7267]">{t('availableCount', { count: availableOnFloor })}</span>
                      </div>
                      <div className="grid min-w-0 grid-cols-1 items-stretch gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {floorRooms.map((room) => {
                          const category = categoryFor(room);
                          const status = roomCardStatus(room);
                          const photoCount = galleryDisplayUrls((room.gallery || []) as GalleryPhoto[]).length;
                          return (
                            <article
                              key={room.id}
                              className="flex h-full min-w-0 flex-col overflow-hidden rounded-md border border-[#E8E2DA] bg-white motion-safe:transition-colors hover:border-[#C4B8A5] focus-within:border-[#C4B8A5]"
                            >
                              <button
                                type="button"
                                onClick={() => setPhotoRoom(room)}
                                className="relative aspect-[3/2] w-full shrink-0 bg-[#F4EFE8] text-start"
                                aria-label={t('viewPhotos')}
                              >
                                {room.imageUrl ? (
                                  <img src={room.imageUrl} alt="" className="h-full w-full object-cover" />
                                ) : null}
                                {photoCount > 1 ? (
                                  <span className="absolute bottom-2 end-2 inline-flex items-center gap-1 rounded border border-[#E8E2DA] bg-white px-1.5 py-0.5 text-[11px] font-medium text-[#5C564D]">
                                    <Images className="h-3 w-3" aria-hidden />
                                    {photoCount}
                                  </span>
                                ) : null}
                              </button>
                              <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
                                <h3 className="truncate text-sm font-medium text-[#191816]">
                                  {t('roomLabel', { number: room.number })}
                                </h3>
                                <p className="truncate text-xs text-[#7A7267]">{room.type}</p>
                                {category ? (
                                  <p className="text-sm font-medium tabular-nums text-[#191816]">
                                    {formatNaira(category.baseRateMinorUnits)}
                                    <span className="block text-[11px] font-normal text-[#7A7267]">{t('perNight')}</span>
                                  </p>
                                ) : (
                                  <p className="text-sm text-transparent" aria-hidden="true">&nbsp;</p>
                                )}
                                <p className="truncate text-xs text-[#5C564D]">
                                  {room.floor}
                                  {category ? (
                                    <>
                                      <span className="px-1.5 text-[#C4B8A5]">·</span>
                                      {t('upToGuests', { count: category.maxGuests })}
                                    </>
                                  ) : null}
                                </p>
                                <div>
                                  <StatusBadge status={status.token}>{status.label}</StatusBadge>
                                </div>
                                <p className={`min-h-4 truncate text-xs ${status.note ? 'text-[#7A7267]' : 'text-transparent'}`}>
                                  {status.note || '\u00a0'}
                                </p>
                                <div className="mt-auto flex gap-1.5 pt-1">
                                  <Button type="button" variant="outline" className="min-h-11 min-w-0 flex-1 px-2" onClick={() => setViewingRoom(room)}>{t('view')}</Button>
                                  <Button type="button" variant="secondary" className="min-h-11 min-w-0 flex-1 px-2" onClick={() => setEditingRoom(room)}>{t('edit')}</Button>
                                  <Button type="button" variant="ghost" className="min-h-11 shrink-0 px-2" onClick={() => setMenuRoom(room)}>{t('more')}</Button>
                                </div>
                              </div>
                            </article>
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

        {activeTab === 'categories' && (
          <div className="space-y-4">
            {categories.length === 0 ? (
              <div className="mx-auto my-6 max-w-md space-y-3 rounded-md border border-dashed border-[#E8E2DA] p-10 text-center">
                <Layers className="mx-auto h-8 w-8 text-[#B85C3E]" />
                <p className="text-sm font-semibold text-[#191816]">No room categories defined yet</p>
                <p className="text-xs leading-relaxed text-[#7A7267]">
                  Create room categories (like Executive Suite or Deluxe Studio) to configure nightly rates, maximum guest capacity, bed types, and assign room numbers.
                </p>
                <Button onClick={() => setAddCategoryOpen(true)} className="mt-1">
                  <Plus className="h-4 w-4" />
                  Create room category
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categories.map((category) => {
                  const roomCount = rooms.filter((r) => r.type === category.name).length;
                  return (
                    <div
                      key={category.id}
                      className="flex h-full min-w-0 flex-col overflow-hidden rounded-md border border-[#E8E2DA] bg-white"
                    >
                      <div className="aspect-[3/2] bg-[#F4EFE8]">
                        {category.imageUrl ? (
                          <img src={category.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="flex flex-1 flex-col gap-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-medium text-[#191816]">{category.name}</h3>
                            <p className="truncate text-xs text-[#7A7267]">{category.code}</p>
                            <p className="mt-1 text-sm font-medium tabular-nums text-[#191816]">
                              {formatNaira(category.baseRateMinorUnits)}
                              <span className="text-xs font-normal text-[#7A7267]"> {t('perNight')}</span>
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategory(category);
                                setAddCategoryOpen(true);
                              }}
                              className="min-h-11 px-2 text-xs font-medium text-[#71382D]"
                            >
                              {t('editCategory')}
                            </button>
                            <span className="text-xs text-[#7A7267]">
                              {roomCount} {roomCount === 1 ? 'room' : 'rooms'}
                            </span>
                          </div>
                        </div>
                        <p className="line-clamp-2 min-h-10 text-xs leading-5 text-[#7A7267]">{category.description}</p>
                        <p className="truncate text-xs text-[#7A7267]">
                          {category.bedType}
                          <span className="px-1.5 text-[#C4B8A5]">·</span>
                          {t('upToGuests', { count: category.maxGuests })}
                        </p>
                        <p className="line-clamp-1 min-h-5 text-xs text-[#7A7267]">
                          {category.amenities.slice(0, 3).join(' · ')}
                          {category.amenities.length > 3 ? ` · +${category.amenities.length - 3}` : ''}
                        </p>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#E8E2DA] px-4 py-3">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setPreselectedCategory(category.name);
                            setAddRoomOpen(true);
                          }}
                          className="min-h-11 flex-1"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Add Room to Tier</span>
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(category.id, category.name)}
                          className="inline-flex h-11 w-11 items-center justify-center rounded border border-[#E8E2DA] text-[#7A7267] hover:text-[#9E382A]"
                          title="Delete category"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      <Dialog open={!!viewingRoom} onOpenChange={(open) => { if (!open) setViewingRoom(null); }}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>{viewingRoom ? t('roomLabel', { number: viewingRoom.number }) : t('view')}</DialogTitle>
            <DialogDescription>{viewingRoom?.type}</DialogDescription>
          </DialogHeader>
          {viewingRoom ? (
            <div className="space-y-2 text-sm text-[#191816]">
              <StatusBadge status={roomCardStatus(viewingRoom).token}>{roomCardStatus(viewingRoom).label}</StatusBadge>
              <p className="text-[#5C564D]">
                {viewingRoom.floor}
                {categoryFor(viewingRoom) ? (
                  <>
                    <span className="px-1.5 text-[#C4B8A5]">·</span>
                    {t('upToGuests', { count: categoryFor(viewingRoom)!.maxGuests })}
                  </>
                ) : null}
              </p>
              {categoryFor(viewingRoom) ? (
                <p className="font-medium tabular-nums">
                  {formatNaira(categoryFor(viewingRoom)!.baseRateMinorUnits)}
                  <span className="text-xs font-normal text-[#7A7267]"> {t('perNight')}</span>
                </p>
              ) : null}
              {viewingRoom.description ? <p className="text-[#5C564D]">{viewingRoom.description}</p> : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setViewingRoom(null)}>{t('close')}</Button>
            <Button
              type="button"
              onClick={() => {
                if (!viewingRoom) return;
                setEditingRoom(viewingRoom);
                setViewingRoom(null);
              }}
            >
              {t('edit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!menuRoom} onOpenChange={(open) => { if (!open) setMenuRoom(null); }}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>{menuRoom ? t('roomLabel', { number: menuRoom.number }) : t('more')}</DialogTitle>
            <DialogDescription>{menuRoom?.type}</DialogDescription>
          </DialogHeader>
          {menuRoom ? (
            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" onClick={() => { const room = menuRoom; setMenuRoom(null); setPhotoRoom(room); }}>{t('viewPhotos')}</Button>
              {menuRoom.housekeeping === 'dirty' || menuRoom.housekeeping === 'cleaning' ? (
                <Button variant="outline" asChild>
                  <Link href="/housekeeping">{t('openHousekeeping')}</Link>
                </Button>
              ) : menuRoom.operational === 'occupied' ? (
                <Button variant="outline" asChild>
                  <Link href={`/reservations?search=${encodeURIComponent(menuRoom.number)}`}>{t('openFolio')}</Link>
                </Button>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => { const room = menuRoom; setMenuRoom(null); setAssignRoom(room); }}>{t('assignGuest')}</Button>
                  {menuRoom.operational !== 'maintenance' ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={sendingHousekeepingId === menuRoom.id}
                      onClick={() => {
                        const room = menuRoom;
                        setMenuRoom(null);
                        handleSendToHousekeeping(room);
                      }}
                    >
                      {t('sendToHousekeeping')}
                    </Button>
                  ) : null}
                </>
              )}
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  const room = menuRoom;
                  setMenuRoom(null);
                  handleDeleteRoom(room.id, room.number);
                }}
              >
                {t('deleteRoom')}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

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
        category={editingCategory}
        onOpenChange={(open) => {
          setAddCategoryOpen(open);
          if (!open) setEditingCategory(null);
        }}
        onAddCategory={editingCategory ? handleUpdateCategory : handleAddCategory}
      />

      <EditRoomDialog
        open={!!editingRoom}
        room={editingRoom}
        categories={categories}
        onOpenChange={(open) => {
          if (!open) {
            setEditingRoom(null);
            fetchRoomsData();
          }
        }}
        onSave={handleUpdateRoom}
      />

      <Dialog open={!!photoRoom} onOpenChange={(open) => {
        if (!open && closeNeedsUploadWarning(photoUploadBusy)) {
          setPhotoCloseWarn(true);
          return;
        }
        if (!open) {
          setPhotoCloseWarn(false);
          setPhotoRoom(null);
          fetchRoomsData();
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#191816] font-semibold">{t('roomPhotos')}</DialogTitle>
            <DialogDescription className="text-xs text-[#7A7267]">{t('roomGalleryHelp')}</DialogDescription>
          </DialogHeader>
          {photoRoom && (
            <RoomGalleryEditor
              ref={photoEditorRef}
              photos={(photoRoom.gallery || []) as GalleryPhoto[]}
              onChange={(gallery) => setPhotoRoom({ ...photoRoom, gallery })}
              onActivityChange={(activity) => setPhotoUploadBusy(activity.busy)}
              roomId={photoRoom.id}
              label={t('roomPhotos')}
              help={t('roomGalleryHelp')}
            />
          )}
          <GalleryCloseWarning
            open={photoCloseWarn}
            onKeep={() => setPhotoCloseWarn(false)}
            onClose={() => {
              photoEditorRef.current?.cancelActiveUploads();
              setPhotoCloseWarn(false);
              setPhotoUploadBusy(false);
              setPhotoRoom(null);
              fetchRoomsData();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignRoom} onOpenChange={(open) => { if (!open) setAssignRoom(null); }}>
        <DialogContent className="max-w-md bg-white border border-[#E8E1D5]">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#71382D] font-semibold">
              Assign Room {assignRoom?.number}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#7A7267]">
              Choose an unassigned expected arrival in {assignRoom?.type}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {assignLoading ? (
              <p className="text-xs text-[#7A7267]">Loading expected arrivals…</p>
            ) : assignArrivals.length === 0 ? (
              <p className="text-xs text-[#7A7267]">
                No unassigned arrivals for this room type. Reservations can also be assigned from Front Desk or Reservations.
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto divide-y divide-[#E8E2DA] rounded border border-[#E8E2DA]">
                {assignArrivals.map((arrival) => (
                  <button
                    key={arrival.id}
                    type="button"
                    disabled={assigningId === arrival.id}
                    onClick={() => handleAssignArrival(arrival.id)}
                    className="w-full text-left px-3 py-2.5 text-xs hover:bg-[#FAF7F2]"
                  >
                    <strong className="block text-[#191816]">{arrival.guestName}</strong>
                    <span className="text-[11px] text-[#8C8275]">
                      {arrival.reference} · {arrival.checkInDate} → {arrival.checkOutDate}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {assignError && (
              <p className="rounded bg-red-50 text-red-700 px-2.5 py-2 text-xs font-medium" role="alert">
                {assignError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignRoom(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
