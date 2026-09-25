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
import { Check, Plus, Upload, Image as ImageIcon, X } from 'lucide-react';
import type { RoomCategory } from './mock-data';

interface AddCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCategory: (category: RoomCategory) => void;
}

const COMMON_AMENITIES = [
  'High-speed Wi-Fi',
  'Air Conditioning',
  'Breakfast Included',
  'Smart TV',
  'Work Desk',
  'Espresso Machine',
  'Bathtub',
  'Balcony',
  'Mini Bar',
  'City View',
  'Ocean View',
  'Butler Service',
];

const CATEGORY_PRESET_IMAGES = [
  { label: 'King Suite', url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80' },
  { label: 'Deluxe Room', url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80' },
  { label: 'Executive Suite', url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80' },
  { label: 'Standard Room', url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80' },
];

export function AddCategoryDialog({
  open,
  onOpenChange,
  onAddCategory,
}: AddCategoryDialogProps) {
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [rateNaira, setRateNaira] = React.useState('');
  const [maxGuests, setMaxGuests] = React.useState('2');
  const [bedType, setBedType] = React.useState('1 King Bed');
  const [description, setDescription] = React.useState('');
  const [imageUrl, setImageUrl] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [selectedAmenities, setSelectedAmenities] = React.useState<string[]>([
    'High-speed Wi-Fi',
    'Air Conditioning',
    'Smart TV',
  ]);
  const [error, setError] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Auto-generate a 3-character code when name changes if code is untouched
  function handleNameChange(val: string) {
    setName(val);
    const words = val.trim().split(/\s+/);
    if (words.length >= 2) {
      setCode(words.map((w) => w[0]?.toUpperCase()).join('').slice(0, 4));
    } else if (val.length >= 3) {
      setCode(val.slice(0, 3).toUpperCase());
    }
  }

  function toggleAmenity(amenity: string) {
    setSelectedAmenities((prev) =>
      prev.includes(amenity)
        ? prev.filter((a) => a !== amenity)
        : [...prev, amenity]
    );
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
    if (!name.trim()) {
      setError('Please provide a category name.');
      return;
    }

    const parsedRate = parseFloat(rateNaira.replace(/,/g, ''));
    if (isNaN(parsedRate) || parsedRate <= 0) {
      setError('Please enter a valid nightly rate in Naira.');
      return;
    }

    const newCategory: RoomCategory = {
      id: `cat-${Date.now()}`,
      name: name.trim(),
      code: code.trim().toUpperCase() || name.slice(0, 3).toUpperCase(),
      baseRateMinorUnits: Math.round(parsedRate * 100), // convert to kobo
      maxGuests: parseInt(maxGuests, 10) || 2,
      bedType: bedType.trim() || '1 King Bed',
      description: description.trim() || 'Comfortable and elegantly appointed room.',
      amenities: selectedAmenities,
      imageUrl: imageUrl.trim() || undefined,
      images: imageUrl.trim() ? [imageUrl.trim()] : [],
    };

    onAddCategory(newCategory);
    onOpenChange(false);

    // Reset form
    setName('');
    setCode('');
    setRateNaira('');
    setDescription('');
    setImageUrl('');
    setError('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl sm:text-2xl text-[#191816]">
            Add Room Category
          </DialogTitle>
          <DialogDescription className="text-xs text-[#7A7267]">
            Define a tier or room class with photo, nightly rate, bedding setup, and amenities.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {error && (
            <div className="p-2.5 rounded bg-[#FBEBE8] border border-[#F0BCB0] text-[#71382D] text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-medium text-[#191816]">
                Category Name <span className="text-[#B85C3E]">*</span>
              </label>
              <Input
                placeholder="e.g. Deluxe Suite, Executive King"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#191816]">Short Code</label>
              <Input
                placeholder="e.g. DLX, EXE"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={5}
                className="h-9 text-xs font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-medium text-[#191816]">
                Nightly Rate (NGN) <span className="text-[#B85C3E]">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#7A7267] font-semibold">
                  ₦
                </span>
                <Input
                  type="text"
                  placeholder="75,000"
                  value={rateNaira}
                  onChange={(e) => setRateNaira(e.target.value)}
                  required
                  className="pl-6 h-9 text-xs font-semibold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#191816]">Max Guests</label>
              <select
                value={maxGuests}
                onChange={(e) => setMaxGuests(e.target.value)}
                className="w-full h-9 rounded border border-[#E8E2DA] bg-white px-2.5 text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
              >
                <option value="1">1 Guest</option>
                <option value="2">2 Guests</option>
                <option value="3">3 Guests</option>
                <option value="4">4 Guests</option>
                <option value="6">6 Guests</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#191816]">Bed Setup</label>
              <Input
                placeholder="e.g. 1 King Bed"
                value={bedType}
                onChange={(e) => setBedType(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-medium text-[#191816]">Short Description</label>
            <textarea
              rows={2}
              placeholder="Describe this room category for your team and online booking guests..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded border border-[#E8E2DA] bg-white p-2.5 text-xs text-[#191816] focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
            />
          </div>

          {/* Category Image Upload & Selection */}
          <div className="space-y-1.5 pt-1">
            <label className="font-medium text-[#191816] flex items-center justify-between">
              <span>Category Photo</span>
              {uploading && <span className="text-[10px] text-[#B85C3E] animate-pulse">Uploading photo...</span>}
            </label>

            {imageUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-[#E8E2DA] h-28 w-full group">
                <img
                  src={imageUrl}
                  alt="Category preview"
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
                  <p className="text-xs font-medium text-[#191816]">Upload Category Photo</p>
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
                  <span className="text-[10px] text-[#7A7267] block mb-1">Or choose a preset category photo:</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {CATEGORY_PRESET_IMAGES.map((p, idx) => (
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

          {/* Amenities Selection */}
          <div className="space-y-2 pt-1">
            <label className="font-medium text-[#191816] block">
              Amenities & Inclusions
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_AMENITIES.map((amenity) => {
                const isSelected = selectedAmenities.includes(amenity);
                return (
                  <button
                    key={amenity}
                    type="button"
                    onClick={() => toggleAmenity(amenity)}
                    className={`px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1 border ${
                      isSelected
                        ? 'bg-[#71382D] text-white border-[#71382D]'
                        : 'bg-white text-[#7A7267] border-[#E8E2DA] hover:border-[#7A7267]'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 flex-shrink-0" />}
                    <span>{amenity}</span>
                  </button>
                );
              })}
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
              Save Category
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
