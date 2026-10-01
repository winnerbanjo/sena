/** Full-screen sheet used at phone widths. Not a desktop-only popover. */
export const APARTMENT_ACTION_SHEET_CLASS =
  'fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center';

export const APARTMENT_ACTION_PANEL_CLASS =
  'max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 text-start';

export function namesMatchForDeletion(typed: string, apartmentName: string) {
  return typed.trim() === apartmentName.trim();
}
