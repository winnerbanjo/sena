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
import { Check, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RoomCategory } from './mock-data';
import { coverFirstUrls, RoomGalleryEditor } from './room-gallery-editor';
import type { GalleryPhoto } from '@/lib/room-gallery';

interface AddCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCategory: (category: RoomCategory) => void | Promise<{ ok: boolean; error?: string } | void>;
  category?: RoomCategory | null;
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

export function AddCategoryDialog({
  open,
  onOpenChange,
  onAddCategory,
  category,
}: AddCategoryDialogProps) {
  const t = useTranslations('rooms');
  const editing = Boolean(category);
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [rateNaira, setRateNaira] = React.useState('');
  const [maxGuests, setMaxGuests] = React.useState('2');
  const [bedType, setBedType] = React.useState('1 King Bed');
  const [description, setDescription] = React.useState('');
  const [photos, setPhotos] = React.useState<GalleryPhoto[]>([]);
  const [selectedAmenities, setSelectedAmenities] = React.useState<string[]>([
    'High-speed Wi-Fi',
    'Air Conditioning',
    'Smart TV',
  ]);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (!category) {
      setName('');
      setCode('');
      setRateNaira('');
      setMaxGuests('2');
      setBedType('1 King Bed');
      setDescription('');
      setPhotos([]);
      setSelectedAmenities(['High-speed Wi-Fi', 'Air Conditioning', 'Smart TV']);
      setError('');
      return;
    }
    setName(category.name);
    setCode(category.name.slice(0, 3).toUpperCase());
    setRateNaira(String(Math.round(category.baseRateMinorUnits / 100)));
    setMaxGuests(String(category.maxGuests || 2));
    setBedType(category.bedType || '1 King Bed');
    setDescription(category.description || '');
    setSelectedAmenities(category.amenities || []);
    setPhotos(
      category.gallery?.length
        ? category.gallery
        : (category.images || []).filter(Boolean).map((url, sortOrder) => ({
            id: `legacy-${sortOrder}`,
            url,
            isCover: sortOrder === 0,
            sortOrder,
          }))
    );
    setError('');
  }, [open, category]);

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

  async function handleSubmit(e: React.FormEvent) {
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
    const guests = parseInt(maxGuests, 10);
    if (!Number.isInteger(guests) || guests < 1 || guests > 20) {
      setError('Maximum guests must be between 1 and 20.');
      return;
    }

    const images = photos;
    const newCategory: RoomCategory = {
      id: category?.id || `cat-${Date.now()}`,
      name: name.trim(),
      code: name.trim().slice(0, 3).toUpperCase(),
      baseRateMinorUnits: Math.round(parsedRate * 100), // convert to kobo
      maxGuests: guests,
      bedType: bedType.trim() || '1 King Bed',
      description: description.trim() || 'Comfortable and elegantly appointed room.',
      amenities: selectedAmenities,
      imageUrl: coverFirstUrls(photos)[0],
      images: coverFirstUrls(photos),
      gallery: photos,
    };

    setSaving(true);
    const result = await onAddCategory(newCategory);
    setSaving(false);
    if (result && result.ok === false) {
      setError(result.error || 'Could not save this category.');
      return;
    }
    onOpenChange(false);

    // Reset form
    setName('');
    setCode('');
    setRateNaira('');
    setDescription('');
    setPhotos([]);
    setError('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl sm:text-2xl text-[#191816]">
            {editing ? t('editCategory') : 'Add Room Category'}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#7A7267]">
            {editing ? t('editCategoryHelp') : 'Define a tier or room class with photos, nightly rate, bedding setup, and amenities.'}
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
                value={editing ? name.slice(0, 3).toUpperCase() : code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={5}
                readOnly={editing}
                className="h-9 text-xs font-mono uppercase"
              />
              {editing && <p className="text-[10px] text-[#7A7267]">{t('codeFromName')}</p>}
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

          <RoomGalleryEditor
            photos={photos}
            onChange={setPhotos}
            roomTypeId={category?.id && /^[0-9a-f-]{36}$/i.test(category.id) ? category.id : undefined}
            label={t('roomPhotos')}
            help={t('categoryGalleryHelp')}
          />

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
            <Button type="submit" disabled={saving} className="text-xs min-h-11">
              <Plus className="w-3.5 h-3.5 mr-1" />
              {editing ? t('saveChanges') : 'Save Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
