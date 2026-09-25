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
import { Plus, Upload, Image as ImageIcon, X, Layers, Hash } from 'lucide-react';
import type { RoomCategory, RoomItem } from './mock-data';

interface AddRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: RoomCategory[];
  existingRooms: RoomItem[];
  defaultCategory?: string;
  onAddRoom: (room: RoomItem) => void;
  onAddRooms?: (rooms: RoomItem[]) => void;
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
  onAddRooms,
  onOpenAddCategory,
}: AddRoomDialogProps) {
  const [creationMode, setCreationMode] = React.useState<'single' | 'multiple'>('single');
  const [number, setNumber] = React.useState('');
  
  // Batch generator state
  const [startNumber, setStartNumber] = React.useState('101');
  const [roomCount, setRoomCount] = React.useState('5');
  const [batchRawInput, setBatchRawInput] = React.useState('101, 102, 103, 104, 105');

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
    if (!open) return;
    // Reset mode to single on fresh open
    setCreationMode('single');
    setNumber('');
    setError('');

    if (defaultCategory) {
      setType(defaultCategory);
    } else if (categories.length > 0 && !categories.some((c) => c.name === type)) {
      setType(categories[0].name);
    } else if (categories.length === 0) {
      setType('Deluxe Room');
    }
  }, [defaultCategory, categories, open]);

  // When startNumber or roomCount changes in generator, update batchRawInput
  function handleGenerateSequence(start: string, count: string) {
    const s = parseInt(start, 10);
    const c = parseInt(count, 10);
    if (!isNaN(s) && !isNaN(c) && c > 0 && c <= 50) {
      const generated: string[] = [];
      for (let i = 0; i < c; i++) {
        generated.push(String(s + i));
      }
      setBatchRawInput(generated.join(', '));
    }
  }

  // Parse batch room numbers
  const parsedBatchRooms = React.useMemo(() => {
    if (creationMode === 'single') return [number.trim()].filter(Boolean);

    const raw = batchRawInput.trim();
    if (!raw) return [];

    let list: string[] = [];
    if (raw.includes(',')) {
      list = raw.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (/^\d+\s*-\s*\d+$/.test(raw)) {
      const [start, end] = raw.split('-').map((s) => parseInt(s.trim(), 10));
      if (!isNaN(start) && !isNaN(end) && end >= start && end - start <= 50) {
        for (let i = start; i <= end; i++) {
          list.push(String(i));
        }
      } else {
        list = [raw];
      }
    } else {
      list = [raw];
    }
    // Remove duplicates
    return Array.from(new Set(list));
  }, [creationMode, number, batchRawInput]);

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
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setImageUrl(reader.result);
          }
        };
        reader.readAsDataURL(file);
      }
    } catch {
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
    setError('');

    const roomsToAdd = parsedBatchRooms;
    if (roomsToAdd.length === 0) {
      setError(creationMode === 'single' ? 'Please provide a room number.' : 'Please provide at least one room number.');
      return;
    }

    // Check for collisions with existing rooms
    const existingCollisions = roomsToAdd.filter((num) =>
      existingRooms.some((r) => r.number.toLowerCase() === num.toLowerCase())
    );

    if (existingCollisions.length > 0) {
      setError(`Room(s) ${existingCollisions.join(', ')} already exist in your property.`);
      return;
    }

    const resolvedType = type || (categories[0]?.name || 'Deluxe Room');

    const createdItems: RoomItem[] = roomsToAdd.map((rmNum) => {
      let rmFloor = floor;
      if (rmFloor === 'Floor 1' && rmNum.length >= 3 && /^\d+$/.test(rmNum)) {
        rmFloor = `Floor ${rmNum[0]}`;
      }
      return {
        id: `rm-${rmNum.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString().slice(-4)}`,
        number: rmNum,
        type: resolvedType,
        floor: rmFloor,
        operational,
        housekeeping,
        imageUrl: imageUrl.trim() || undefined,
      };
    });

    if (onAddRooms && createdItems.length > 1) {
      onAddRooms(createdItems);
    } else {
      createdItems.forEach((r) => onAddRoom(r));
    }

    onOpenChange(false);

    // Reset form
    setNumber('');
    setBatchRawInput('');
    setImageUrl('');
    setError('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl sm:text-2xl text-[#191816]">
            {creationMode === 'single' ? 'Add New Room' : 'Add Multiple Rooms to Category'}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#7A7267]">
            Register rooms in your hotel inventory. Multiple rooms can share the same category & photo.
          </DialogDescription>
        </DialogHeader>

        {/* Mode Toggle: Single vs Batch */}
        <div className="flex bg-[#F5F2ED] p-1 rounded-lg border border-[#E8E2DA] my-1">
          <button
            type="button"
            onClick={() => setCreationMode('single')}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              creationMode === 'single'
                ? 'bg-white text-[#191816] shadow-2xs border border-[#E8E2DA]'
                : 'text-[#7A7267] hover:text-[#191816]'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>Single Room</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCreationMode('multiple');
              if (!batchRawInput) {
                setBatchRawInput('101, 102, 103, 104, 105');
              }
            }}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              creationMode === 'multiple'
                ? 'bg-white text-[#71382D] shadow-2xs border border-[#E8E2DA]'
                : 'text-[#7A7267] hover:text-[#191816]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Multiple Rooms (Batch)</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {error && (
            <div className="p-2.5 rounded bg-[#FBEBE8] border border-[#F0BCB0] text-[#71382D] text-xs">
              {error}
            </div>
          )}

          {/* Room Category Selection */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="font-medium text-[#191816]">
                Target Room Category <span className="text-[#B85C3E]">*</span>
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
              className="w-full h-9 rounded border border-[#E8E2DA] bg-white px-2.5 text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E] font-medium"
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

          {/* Single Mode Input */}
          {creationMode === 'single' ? (
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
          ) : (
            /* Multiple Rooms Mode Inputs */
            <div className="space-y-3 p-3.5 bg-[#FAF9F6] border border-[#E8E2DA] rounded-xl">
              <div className="space-y-1.5">
                <label className="font-medium text-[#191816]">
                  Enter Room Numbers <span className="text-[#B85C3E]">*</span>
                </label>
                <Input
                  placeholder="e.g. 101, 102, 103, 104, 105 or 201-210"
                  value={batchRawInput}
                  onChange={(e) => setBatchRawInput(e.target.value)}
                  required
                  className="h-9 text-xs font-mono font-bold"
                />
                <span className="text-[11px] text-[#7A7267]">
                  Separate with commas (e.g. 101, 102, 103) or enter a numeric range (e.g. 201-208).
                </span>
              </div>

              {/* Quick Sequence Helper */}
              <div className="pt-2 border-t border-[#E8E2DA]/80">
                <span className="text-[11px] font-semibold text-[#191816] block mb-1.5">
                  Or auto-generate sequence:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-[#7A7267] block mb-0.5">Start Number</span>
                    <Input
                      placeholder="e.g. 201"
                      value={startNumber}
                      onChange={(e) => {
                        setStartNumber(e.target.value);
                        handleGenerateSequence(e.target.value, roomCount);
                      }}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7A7267] block mb-0.5">Quantity to Add</span>
                    <Input
                      type="number"
                      min="1"
                      max="50"
                      placeholder="5"
                      value={roomCount}
                      onChange={(e) => {
                        setRoomCount(e.target.value);
                        handleGenerateSequence(startNumber, e.target.value);
                      }}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Preview Chips */}
              {parsedBatchRooms.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center justify-between text-[11px] text-[#7A7267] mb-1.5">
                    <span>Rooms to be created ({parsedBatchRooms.length}):</span>
                    <span className="text-[#059669] font-semibold">Ready to add</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-white rounded-lg border border-[#E8E2DA]">
                    {parsedBatchRooms.map((rm) => (
                      <span
                        key={rm}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FAF2EB] text-[#71382D] border border-[#F0D5C3] font-mono text-xs font-semibold"
                      >
                        {rm}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1 pt-1">
                <label className="font-medium text-[#191816]">Base Floor</label>
                <select
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="w-full h-9 rounded border border-[#E8E2DA] bg-white px-2.5 text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
                >
                  <option value="Floor 1">Auto-detect floor from number (e.g. 101→Floor 1, 201→Floor 2)</option>
                  {DEFAULT_FLOORS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Room Photo / Picture Upload & Presets */}
          <div className="space-y-2 pt-2 border-t border-[#E8E2DA]">
            <div className="flex items-center justify-between">
              <label className="font-medium text-[#191816] flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-[#B85C3E]" />
                <span>Room Photo / Image</span>
                {creationMode === 'multiple' && (
                  <span className="text-[10px] text-[#7A7267] font-normal">(Shared across all {parsedBatchRooms.length} rooms)</span>
                )}
              </label>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="text-[11px] text-[#B85C3E] hover:underline"
                >
                  Remove photo
                </button>
              )}
            </div>

            {imageUrl ? (
              <div className="relative w-full h-32 rounded-lg overflow-hidden border border-[#E8E2DA] group bg-black/5">
                <img
                  src={imageUrl}
                  alt="Room Preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-24 border-2 border-dashed border-[#E8E2DA] hover:border-[#B85C3E] rounded-lg flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-[#FAF8F5] transition-colors p-3 text-center"
              >
                <Upload className="w-5 h-5 text-[#B85C3E]" />
                <span className="text-xs font-medium text-[#191816]">
                  {uploading ? 'Uploading to Spaces...' : 'Upload Room Photo'}
                </span>
                <span className="text-[10px] text-[#7A7267]">
                  PNG, JPG or WebP up to 10MB
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}

            {/* Custom URL or Curated Presets */}
            <div className="space-y-1.5 pt-1">
              <Input
                placeholder="Or paste external photo URL..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="h-8 text-[11px]"
              />

              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                <span className="text-[10px] text-[#7A7267] whitespace-nowrap">Presets:</span>
                {ROOM_PRESET_IMAGES.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setImageUrl(preset.url)}
                    className="text-[10px] px-2 py-0.5 rounded border border-[#E8E2DA] bg-white hover:bg-[#F5F2ED] text-[#191816] whitespace-nowrap transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#B85C3E] hover:bg-[#A34E32] text-white text-xs font-semibold"
            >
              {creationMode === 'multiple'
                ? `Add ${parsedBatchRooms.length} Rooms to ${type}`
                : 'Add Room to Inventory'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
