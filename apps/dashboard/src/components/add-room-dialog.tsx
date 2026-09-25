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
import { Plus, Upload, Image as ImageIcon, X } from 'lucide-react';
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

const ROOM_PRESET_IMAGES = [
  { label: 'King Suite', url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80' },
  { label: 'Deluxe Room', url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80' },
  { label: 'Executive Suite', url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80' },
  { label: 'Standard Room', url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80' },
];

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
  const [imageUrl, setImageUrl] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Update type if defaultCategory changes or dialog opens
  React.useEffect(() => {
    if (defaultCategory) {
      setType(defaultCategory);
    } else if (categories.length > 0 && !categories.some((c) => c.name === type)) {
      setType(categories[0].name);
    } else if (categories.length === 0) {
      setType('Deluxe Room');
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

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          setImageUrl(data.url);
        }
      } else {
        // Fallback: use FileReader for immediate local data URL
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setImageUrl(reader.result);
          }
        };
        reader.readAsDataURL(file);
      }
    } catch {
      // Fallback to local data URL preview
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImageUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
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

    const resolvedType = type || (categories[0]?.name || 'Deluxe Room');

    const newRoom: RoomItem = {
      id: `rm-${trimmedNumber.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString().slice(-4)}`,
      number: trimmedNumber,
      type: resolvedType,
      floor,
      operational,
      housekeeping,
      imageUrl: imageUrl.trim() || undefined,
    };

    onAddRoom(newRoom);
    onOpenChange(false);

    // Reset form
    setNumber('');
    setImageUrl('');
    setError('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl sm:text-2xl text-[#191816]">
            Add New Room
          </DialogTitle>
          <DialogDescription className="text-xs text-[#7A7267]">
            Register a physical room in your hotel inventory with photo and details.
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
                placeholder="e.g. 101, 204, PH-01"
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
              {categories.length > 0 ? (
                categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.bedType} · ₦{(c.baseRateMinorUnits / 100).toLocaleString()}/night)
                  </option>
                ))
              ) : (
                <>
                  <option value="Deluxe Room">Deluxe Room (1 King Bed · ₦75,000/night)</option>
                  <option value="Executive Suite">Executive Suite (1 King Bed · ₦120,000/night)</option>
                  <option value="Standard Room">Standard Room (1 Queen Bed · ₦50,000/night)</option>
                </>
              )}
            </select>
          </div>

          {/* Room Image Upload & Selection */}
          <div className="space-y-1.5 pt-1">
            <label className="font-medium text-[#191816] flex items-center justify-between">
              <span>Room Image / Photo</span>
              {uploading && <span className="text-[10px] text-[#B85C3E] animate-pulse">Uploading photo...</span>}
            </label>

            {imageUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-[#E8E2DA] h-32 w-full group">
                <img
                  src={imageUrl}
                  alt="Room preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black transition-colors"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#E8E2DA] hover:border-[#B85C3E] rounded-lg p-3 text-center cursor-pointer bg-[#FAF8F5] transition-colors"
                >
                  <ImageIcon className="w-6 h-6 text-[#7A7267] mx-auto mb-1" />
                  <p className="text-xs font-medium text-[#191816]">Upload Room Photo</p>
                  <p className="text-[10px] text-[#7A7267]">Click to select PNG, JPG or WEBP</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Quick Presets */}
                <div>
                  <span className="text-[10px] text-[#7A7267] block mb-1">Or choose a preset room photo:</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ROOM_PRESET_IMAGES.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setImageUrl(p.url)}
                        className="rounded border border-[#E8E2DA] overflow-hidden hover:border-[#B85C3E] transition-all text-left"
                      >
                        <img src={p.url} alt={p.label} className="w-full h-10 object-cover" />
                        <span className="block text-[9px] text-[#7A7267] p-0.5 truncate text-center">
                          {p.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
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
            <Button type="submit" className="text-xs" disabled={uploading}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Room
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
