'use client';

import * as React from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@sena/ui';
import { Plus } from 'lucide-react';
import type { RoomCategory, RoomItem } from './mock-data';

interface AddRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: RoomCategory[];
  existingRooms: RoomItem[];
  defaultCategory?: string;
  onAddRoom: (room: RoomItem) => void;
  onOpenAddCategory: () => void;
}

const DEFAULT_FLOORS = ['Floor 1', 'Floor 2', 'Floor 3', 'Floor 4', 'Ground Floor', 'Penthouse'];

export function AddRoomDialog({
  open,
  onOpenChange,
  categories,
  existingRooms,
  defaultCategory,
  onAddRoom,
  onOpenAddCategory,
}: AddRoomDialogProps) {
  const [number, setNumber] = React.useState('');
  const [type, setType] = React.useState(defaultCategory || categories[0]?.name || 'Deluxe Room');
  const [floor, setFloor] = React.useState('Floor 1');
  const [operational, setOperational] = React.useState<'available' | 'occupied' | 'maintenance'>('available');
  const [housekeeping, setHousekeeping] = React.useState<'clean' | 'cleaning' | 'dirty' | 'inspection'>('clean');
  const [error, setError] = React.useState('');

  // Update type if defaultCategory changes or dialog opens
  React.useEffect(() => {
    if (defaultCategory) {
      setType(defaultCategory);
    } else if (categories.length > 0 && !categories.some((c) => c.name === type)) {
      setType(categories[0].name);
    }
  }, [defaultCategory, categories, open]);

  // Suggest floor automatically based on room number prefix (e.g. 101 -> Floor 1, 201 -> Floor 2)
  function handleNumberChange(val: string) {
    setNumber(val);
    const trimmed = val.trim();
    if (trimmed.length >= 3 && /^\d+$/.test(trimmed)) {
      const firstDigit = trimmed[0];
      if (firstDigit === '1') setFloor('Floor 1');
      else if (firstDigit === '2') setFloor('Floor 2');
      else if (firstDigit === '3') setFloor('Floor 3');
      else if (firstDigit === '4') setFloor('Floor 4');
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedNumber = number.trim();
    if (!trimmedNumber) {
      setError('Please provide a room number.');
      return;
    }

    if (existingRooms.some((r) => r.number.toLowerCase() === trimmedNumber.toLowerCase())) {
      setError(`Room ${trimmedNumber} already exists in your property.`);
      return;
    }

    if (!type) {
      setError('Please select a room category.');
      return;
    }

    const newRoom: RoomItem = {
      id: `rm-${trimmedNumber.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString().slice(-4)}`,
      number: trimmedNumber,
      type,
      floor,
      operational,
      housekeeping,
    };

    onAddRoom(newRoom);
    onOpenChange(false);

    // Reset form
    setNumber('');
    setError('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl sm:text-2xl text-[#191816]">
            Add New Room
          </DialogTitle>
          <DialogDescription className="text-xs text-[#7A7267]">
            Register a physical room in your hotel inventory.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {error && (
            <div className="p-2.5 rounded bg-[#FBEBE8] border border-[#F0BCB0] text-[#71382D] text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-medium text-[#191816]">
                Room Number <span className="text-[#B85C3E]">*</span>
              </label>
              <Input
                placeholder="e.g. 107, 206, PH-01"
                value={number}
                onChange={(e) => handleNumberChange(e.target.value)}
                required
                className="h-9 text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#191816]">Floor</label>
              <select
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="w-full h-9 rounded border border-[#E8E2DA] bg-white px-2.5 text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
              >
                {DEFAULT_FLOORS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="font-medium text-[#191816]">
                Room Category <span className="text-[#B85C3E]">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onOpenAddCategory();
                }}
                className="text-[11px] text-[#B85C3E] hover:underline font-medium"
              >
                + Create new category
              </button>
            </div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full h-9 rounded border border-[#E8E2DA] bg-white px-2.5 text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name} ({c.bedType} · ₦{(c.baseRateMinorUnits / 100).toLocaleString()}/night)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="font-medium text-[#191816]">Operational Status</label>
              <select
                value={operational}
                onChange={(e) => setOperational(e.target.value as any)}
                className="w-full h-9 rounded border border-[#E8E2DA] bg-white px-2.5 text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
              >
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#191816]">Housekeeping State</label>
              <select
                value={housekeeping}
                onChange={(e) => setHousekeeping(e.target.value as any)}
                className="w-full h-9 rounded border border-[#E8E2DA] bg-white px-2.5 text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
              >
                <option value="clean">Clean</option>
                <option value="dirty">Dirty (Needs cleaning)</option>
                <option value="cleaning">Cleaning in progress</option>
                <option value="inspection">Inspection required</option>
              </select>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-[#E8E2DA] flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Room
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
