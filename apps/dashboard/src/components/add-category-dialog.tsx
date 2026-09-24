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
  const [selectedAmenities, setSelectedAmenities] = React.useState<string[]>([
    'High-speed Wi-Fi',
    'Air Conditioning',
    'Smart TV',
  ]);
  const [error, setError] = React.useState('');

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
    };

    onAddCategory(newCategory);
    onOpenChange(false);

    // Reset form
    setName('');
    setCode('');
    setRateNaira('');
    setDescription('');
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
            Define a tier or room class with its nightly rate, bedding setup, and amenities.
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
                placeholder="e.g. Deluxe Room, Penthouse Suite"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-[#191816]">
                Code / Short ID
              </label>
              <Input
                placeholder="e.g. DLX, PHS"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={5}
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-medium text-[#191816]">
                Base Rate / Night (₦) <span className="text-[#B85C3E]">*</span>
              </label>
              <Input
                type="number"
                placeholder="e.g. 85000"
                value={rateNaira}
                onChange={(e) => setRateNaira(e.target.value)}
                required
                min="1000"
                className="h-9 text-xs"
              />
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
            <Button type="submit" className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Save Category
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
