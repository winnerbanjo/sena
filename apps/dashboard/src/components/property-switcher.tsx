'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronDown, Check, Settings, Users } from 'lucide-react';
import { useWorkspace } from './workspace-access';

interface PropertyItem {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  timezone: string;
  currency: string;
  role: string;
  isCurrent: boolean;
}

export function PropertySwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const workspace = useWorkspace();
  const [isOpen, setIsOpen] = React.useState(false);
  const [properties, setProperties] = React.useState<PropertyItem[]>([]);
  const [switchingId, setSwitchingId] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const currentProperty = workspace?.property;
  const propName = currentProperty?.name || 'Property';
  const propAddress = currentProperty?.address || '';
  const secondaryLocation = propAddress ? propAddress.split(',')[0].trim() : 'Hotel';

  // Load available properties on open
  const fetchProperties = React.useCallback(async () => {
    try {
      const res = await fetch('/api/me/properties');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.properties)) {
          setProperties(data.properties);
        }
      }
    } catch {
      // Graceful fallback
    }
  }, []);

  React.useEffect(() => {
    if (isOpen && properties.length === 0) {
      fetchProperties();
    }
  }, [isOpen, properties.length, fetchProperties]);

  // Click outside and escape handling
  React.useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  async function handleSwitch(propertyId: string) {
    if (propertyId === currentProperty?.id) {
      setIsOpen(false);
      return;
    }
    try {
      setSwitchingId(propertyId);
      const res = await fetch('/api/me/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      });
      if (res.ok) {
        setIsOpen(false);
        onNavigate?.();
        window.location.reload();
      }
    } catch (e) {
      console.error('Failed to switch property:', e);
    } finally {
      setSwitchingId(null);
    }
  }

  const hasMultiple = properties.length > 1;

  return (
    <div ref={rootRef} className="relative">
      {/* Restrained Property Switcher Trigger */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="group flex w-full items-center justify-between rounded-md border border-[#E8E2DA] bg-white px-2.5 py-1.5 text-start transition-colors hover:bg-[#FAF8F6] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B85C3E]"
      >
        <div className="min-w-0 pr-2">
          <span className="block text-xs font-semibold text-[#191816] truncate">
            {propName}
          </span>
          <span className="block text-[11px] text-[#7A7267] truncate">
            {secondaryLocation}
          </span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 flex-shrink-0 text-[#7A7267] transition-transform duration-150 group-hover:text-[#191816] ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Switcher Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Select property"
          className="absolute start-0 top-full mt-1 w-full min-w-[220px] rounded-lg border border-[#E8E2DA] bg-white p-1 shadow-md z-50 text-xs"
        >
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8C8275] border-b border-[#F0ECE6] mb-1">
            {hasMultiple ? 'Switch Property' : 'Property'}
          </div>

          <div className="space-y-0.5 max-h-52 overflow-y-auto">
            {properties.length > 0 ? (
              properties.map((prop) => {
                const isSelected = prop.id === currentProperty?.id;
                const isSwitchingThis = switchingId === prop.id;

                return (
                  <button
                    key={prop.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={isSwitchingThis}
                    onClick={() => handleSwitch(prop.id)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-start transition-colors ${
                      isSelected
                        ? 'bg-[#F6F1EA] text-[#191816] font-medium'
                        : 'text-[#4A453E] hover:bg-[#FAF8F6]'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <span className="block text-xs truncate">
                        {prop.name}
                      </span>
                      <span className="block text-[10px] text-[#7A7267] truncate">
                        {prop.address ? prop.address.split(',')[0] : 'Hotel'}
                      </span>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[#B85C3E] flex-shrink-0" aria-hidden="true" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-2 py-1.5 text-xs text-[#7A7267]">
                {propName}
              </div>
            )}
          </div>

          <div className="pt-1 mt-1 border-t border-[#F0ECE6]">
            <Link
              href="/settings"
              onClick={() => {
                setIsOpen(false);
                onNavigate?.();
              }}
              className="flex items-center gap-2 px-2 py-1 rounded text-[11px] text-[#5C564D] hover:bg-[#FAF8F6] hover:text-[#191816] transition-colors"
            >
              <Settings className="w-3.5 h-3.5 text-[#7A7267]" />
              <span>Property Settings</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
