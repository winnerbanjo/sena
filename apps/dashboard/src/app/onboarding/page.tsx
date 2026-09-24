'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Bed,
  Building,
  Building2,
  Check,
  ChevronRight,
  CreditCard,
  Edit2,
  Globe,
  Home,
  Layers,
  Plus,
  ShieldCheck,
  Trash2,
  Palmtree,
  Loader2,
} from 'lucide-react';

interface CountryOption {
  code: string;
  name: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  phoneCode: string;
}

const COUNTRIES: CountryOption[] = [
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', currency: 'NGN', currencySymbol: '₦', phoneCode: '+234' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', currency: 'GHS', currencySymbol: 'GH₵', phoneCode: '+233' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', currency: 'KES', currencySymbol: 'KSh', phoneCode: '+254' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼', currency: 'RWF', currencySymbol: 'RWF', phoneCode: '+250' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', currency: 'ZAR', currencySymbol: 'R', phoneCode: '+27' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', currencySymbol: '£', phoneCode: '+44' },
  { code: 'US', name: 'United States', flag: '🇺🇸', currency: 'USD', currencySymbol: '$', phoneCode: '+1' },
];

const PROPERTY_TYPES = [
  { id: 'hotel', label: 'Hotel', icon: Building2 },
  { id: 'serviced_apartment', label: 'Serviced Apartment', icon: Home },
  { id: 'guest_house', label: 'Guest House', icon: Building },
  { id: 'resort', label: 'Resort / Villa', icon: Palmtree },
];

interface RoomCategoryDraft {
  id: string;
  name: string;
  price: string;
  quantity: string;
  bedType: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1);

  // Step 1: Property Info
  const [propName, setPropName] = React.useState('');
  const [propType, setPropType] = React.useState('hotel');
  const [country, setCountry] = React.useState<CountryOption>(COUNTRIES[0]);
  const [phone, setPhone] = React.useState('');
  const [instagram, setInstagram] = React.useState('');

  // Step 2: Room Categories List
  const [categories, setCategories] = React.useState<RoomCategoryDraft[]>([
    { id: '1', name: 'Standard Room', price: '40000', quantity: '4', bedType: '1 King Bed' },
  ]);
  const [editingCatId, setEditingCatId] = React.useState<string | null>(null);

  // Category form modal / inline drawer state
  const [catNameInput, setCatNameInput] = React.useState('');
  const [catPriceInput, setCatPriceInput] = React.useState('');
  const [catQtyInput, setCatQtyInput] = React.useState('');
  const [catBedInput, setCatBedInput] = React.useState('1 King Bed');
  const [showCatForm, setShowCatForm] = React.useState(false);

  // Step 3: Payment Bank Details
  const [bankName, setBankName] = React.useState('');
  const [accountName, setAccountName] = React.useState('');
  const [accountNumber, setAccountNumber] = React.useState('');
  const [paymentInstructions, setPaymentInstructions] = React.useState(
    'Please use your reservation reference as the transfer description.'
  );

  // UI state
  const [loading, setLoading] = React.useState(false);
  const [loadingTextIndex, setLoadingTextIndex] = React.useState(0);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [completed, setCompleted] = React.useState(false);

  // Draft recovery from localStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('sena_onboarding_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.propName) setPropName(parsed.propName);
        if (parsed.phone) setPhone(parsed.phone);
        if (parsed.instagram) setInstagram(parsed.instagram);
      }
    } catch {}
  }, []);

  // Save progress locally as user types
  React.useEffect(() => {
    try {
      localStorage.setItem(
        'sena_onboarding_draft',
        JSON.stringify({ propName, phone, instagram, propType })
      );
    } catch {}
  }, [propName, phone, instagram, propType]);

  // Loading text animation
  const loadingSubtexts = [
    'Setting up your property...',
    'Adding your rooms...',
    'Saving your payment details...',
    'Almost ready...',
  ];

  React.useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setLoadingTextIndex((prev) => (prev + 1) % loadingSubtexts.length);
      }, 1200);
      return () => clearInterval(interval);
    }
  }, [loading]);

  // Validation helpers
  function validateStep1() {
    const errs: Record<string, string> = {};
    if (!propName.trim()) {
      errs.propName = 'Please enter your property name.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2() {
    const errs: Record<string, string> = {};
    if (categories.length === 0) {
      errs.categories = 'Add at least one room category to continue.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // Room category handlers
  function openAddCategoryModal() {
    setEditingCatId(null);
    setCatNameInput('');
    setCatPriceInput('');
    setCatQtyInput('4');
    setCatBedInput('1 King Bed');
    setShowCatForm(true);
    setErrors({});
  }

  function openEditCategoryModal(cat: RoomCategoryDraft) {
    setEditingCatId(cat.id);
    setCatNameInput(cat.name);
    setCatPriceInput(cat.price);
    setCatQtyInput(cat.quantity);
    setCatBedInput(cat.bedType);
    setShowCatForm(true);
    setErrors({});
  }

  function saveCategory() {
    const errs: Record<string, string> = {};
    if (!catNameInput.trim()) errs.catName = 'Enter a room category name.';
    if (!catPriceInput.trim() || Number(catPriceInput) <= 0) errs.catPrice = 'Enter a nightly rate.';
    if (!catQtyInput.trim() || Number(catQtyInput) <= 0) errs.catQty = 'Enter room quantity.';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    if (editingCatId) {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === editingCatId
            ? { ...c, name: catNameInput.trim(), price: catPriceInput.trim(), quantity: catQtyInput.trim(), bedType: catBedInput }
            : c
        )
      );
    } else {
      setCategories((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          name: catNameInput.trim(),
          price: catPriceInput.trim(),
          quantity: catQtyInput.trim(),
          bedType: catBedInput,
        },
      ]);
    }
    setShowCatForm(false);
    setErrors({});
  }

  function deleteCategory(id: string) {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  // Final submission
  async function handleFinish(skipBank = false) {
    setLoading(true);
    setErrors({});

    try {
      const payload = {
        name: propName.trim(),
        propertyType: propType,
        country: country.name,
        currency: country.currency,
        phone: phone.trim(),
        instagram: instagram.trim(),
        roomCategories: categories.map((c) => ({
          name: c.name,
          priceMinorUnits: Number(c.price) * 100,
          quantity: Number(c.quantity),
          bedType: c.bedType,
        })),
        bankDetails: skipBank
          ? null
          : {
              bankName: bankName.trim(),
              accountName: accountName.trim(),
              accountNumber: accountNumber.trim(),
              instructions: paymentInstructions.trim(),
            },
      };

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'We couldn’t finish setting up your property. Your details are preserved. Try again.');
      }

      localStorage.setItem('sena_onboarding_completed', 'true');
      localStorage.setItem('sena_property_name', propName.trim());
      setCompleted(true);
    } catch (err: any) {
      setErrors({ submit: err.message || 'We couldn’t finish setting up your property. Your details are safe. Try again.' });
    } finally {
      setLoading(false);
    }
  }

  // Completion view
  if (completed) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#191816] flex flex-col justify-between p-6 sm:p-12">
        <header className="max-w-xl mx-auto w-full flex items-center justify-between pb-6 border-b border-[#E8E1D5]">
          <Image src="/assets/sena-logo.png" alt="Sena" width={96} height={32} priority className="h-7 w-auto object-contain" />
        </header>

        <main className="max-w-xl mx-auto w-full py-12 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#FAF4EF] border border-[#E5D4BC] flex items-center justify-center mx-auto text-[#B85C3E]">
            <Check className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-serif font-normal text-[#71382D]">Your property is ready.</h1>
            <p className="text-sm text-[#7A7267] max-w-md mx-auto leading-relaxed">
              We’ve set up your rooms and property details. You can change anything later from your workspace.
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => router.push('/onboarding/plans')}
              className="w-full sm:w-auto px-8 h-12 rounded-md bg-[#B85C3E] hover:bg-[#A34E32] text-white text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <span>Go to my dashboard &rarr;</span>
            </button>
          </div>
        </main>

        <footer className="text-center text-xs text-[#8C8275]">
          &copy; 2026 Sena Hospitality Operating System
        </footer>
      </div>
    );
  }

  // Loading View
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-6 max-w-md">
          <div className="relative w-12 h-12 mx-auto">
            <Loader2 className="w-12 h-12 text-[#B85C3E] animate-spin" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-serif text-[#71382D]">Setting up your property</h2>
            <p className="text-xs font-medium text-[#8C8275] transition-all duration-300">
              {loadingSubtexts[loadingTextIndex]}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#191816] flex flex-col justify-between p-4 sm:p-8 lg:p-12">
      {/* Header */}
      <header className="max-w-2xl mx-auto w-full flex items-center justify-between pb-6 border-b border-[#E8E1D5]">
        <Link href="/">
          <Image src="/assets/sena-logo.png" alt="Sena" width={100} height={32} priority className="h-7 w-auto object-contain" />
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-[#8C8275]">Step {step} of 3</span>
          <div className="flex gap-1">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i <= step ? 'bg-[#B85C3E]' : 'bg-[#E8E1D5]'
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Content Container */}
      <main className="max-w-2xl mx-auto w-full py-8 sm:py-12">
        {errors.submit && (
          <div className="mb-6 p-4 rounded-md bg-[#FDF2F2] border border-[#F2B8B8] text-[#8A2424] text-xs leading-relaxed">
            {errors.submit}
          </div>
        )}

        {/* ── STEP 1: YOUR PROPERTY ────────────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-white border border-[#E8E1D5] rounded-xl p-6 sm:p-10 space-y-8 shadow-xs">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-serif text-[#71382D]">Tell us about your property</h1>
              <p className="text-xs text-[#7A7267]">We’ll use this to set up your workspace.</p>
            </div>

            <div className="space-y-6">
              {/* Property Name */}
              <div>
                <label className="block text-xs font-semibold text-[#191816] mb-1.5">
                  Property Name <span className="text-[#B85C3E]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. The Still House"
                  value={propName}
                  onChange={(e) => {
                    setPropName(e.target.value);
                    if (errors.propName) setErrors({});
                  }}
                  className={`w-full h-11 px-3.5 rounded-md border bg-[#FAF9F7]/60 text-xs text-[#191816] focus:bg-white focus:outline-none focus:border-[#71382D] transition-all ${
                    errors.propName ? 'border-[#8A2424]' : 'border-[#E8E1D5]'
                  }`}
                />
                {errors.propName && <p className="text-[11px] text-[#8A2424] mt-1">{errors.propName}</p>}
              </div>

              {/* Property Type Cards */}
              <div>
                <label className="block text-xs font-semibold text-[#191816] mb-2">Property Style</label>
                <div className="grid grid-cols-2 gap-3">
                  {PROPERTY_TYPES.map((t) => {
                    const Icon = t.icon;
                    const selected = propType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setPropType(t.id)}
                        className={`p-3.5 rounded-lg border text-left flex items-center gap-3 transition-all cursor-pointer ${
                          selected
                            ? 'bg-[#FAF4EF] border-[#B85C3E] text-[#71382D]'
                            : 'bg-white border-[#E8E1D5] hover:border-[#D5CABA] text-[#191816]'
                        }`}
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${selected ? 'text-[#B85C3E]' : 'text-[#8C8275]'}`} />
                        <span className="text-xs font-medium">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Country & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#191816] mb-1.5">Country &amp; Currency</label>
                  <select
                    value={country.code}
                    onChange={(e) => {
                      const found = COUNTRIES.find((c) => c.code === e.target.value);
                      if (found) setCountry(found);
                    }}
                    className="w-full h-11 px-3.5 rounded-md border border-[#E8E1D5] bg-[#FAF9F7]/60 text-xs text-[#191816] focus:bg-white focus:outline-none focus:border-[#71382D] transition-all cursor-pointer"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name} ({c.currencySymbol} {c.currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#191816] mb-1.5">WhatsApp / Phone</label>
                  <input
                    type="tel"
                    placeholder={`${country.phoneCode} 800 000 0000`}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-md border border-[#E8E1D5] bg-[#FAF9F7]/60 text-xs text-[#191816] focus:bg-white focus:outline-none focus:border-[#71382D] transition-all"
                  />
                </div>
              </div>

              {/* Optional Instagram */}
              <div>
                <label className="block text-xs font-medium text-[#7A7267] mb-1.5">Instagram Handle (Optional)</label>
                <input
                  type="text"
                  placeholder="@thestillhouse"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-md border border-[#E8E1D5] bg-[#FAF9F7]/60 text-xs text-[#191816] focus:bg-white focus:outline-none focus:border-[#71382D] transition-all"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#F0ECE4] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (validateStep1()) setStep(2);
                }}
                className="h-11 px-6 rounded-md bg-[#B85C3E] hover:bg-[#A34E32] text-white text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <span>Continue &rarr;</span>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: YOUR ROOMS ───────────────────────────────────────────── */}
        {step === 2 && (
          <div className="bg-white border border-[#E8E1D5] rounded-xl p-6 sm:p-10 space-y-8 shadow-xs">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-serif text-[#71382D]">Add your rooms</h1>
              <p className="text-xs text-[#7A7267]">Start with your room types. You can edit individual rooms later.</p>
            </div>

            {errors.categories && (
              <p className="text-xs text-[#8A2424] bg-[#FDF2F2] p-3 rounded-md border border-[#F2B8B8]">
                {errors.categories}
              </p>
            )}

            {/* List of Configured Categories */}
            <div className="space-y-3">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="p-4 rounded-lg border border-[#E8E1D5] bg-[#FAF9F7]/50 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#191816]">{cat.name}</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#EAE3D9]/60 text-[#71382D]">
                        {cat.quantity} {Number(cat.quantity) === 1 ? 'room' : 'rooms'}
                      </span>
                    </div>
                    <p className="text-xs text-[#7A7267]">
                      {country.currencySymbol}
                      {Number(cat.price).toLocaleString()} / night &middot; {cat.bedType}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditCategoryModal(cat)}
                      className="p-2 text-[#7A7267] hover:text-[#71382D] rounded transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {categories.length > 1 && (
                      <button
                        type="button"
                        onClick={() => deleteCategory(cat.id)}
                        className="p-2 text-[#7A7267] hover:text-[#8A2424] rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add Room Type Button */}
            {!showCatForm && (
              <button
                type="button"
                onClick={openAddCategoryModal}
                className="w-full h-11 rounded-lg border border-dashed border-[#B85C3E]/60 text-[#B85C3E] hover:bg-[#FAF4EF] text-xs font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add another room type</span>
              </button>
            )}

            {/* Modal / Inline Category Form */}
            {showCatForm && (
              <div className="p-5 rounded-lg border border-[#B85C3E]/40 bg-[#FAF4EF]/40 space-y-4">
                <h4 className="text-xs font-semibold text-[#71382D] uppercase tracking-wider">
                  {editingCatId ? 'Edit Room Type' : 'New Room Type'}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#191816] mb-1">
                      Room Type Name <span className="text-[#B85C3E]">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Executive Suite"
                      value={catNameInput}
                      onChange={(e) => setCatNameInput(e.target.value)}
                      className="w-full h-10 px-3 rounded border border-[#E8E1D5] bg-white text-xs text-[#191816] focus:outline-none focus:border-[#71382D]"
                    />
                    {errors.catName && <p className="text-[10px] text-[#8A2424] mt-1">{errors.catName}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#191816] mb-1">
                      Nightly Price ({country.currencySymbol}) <span className="text-[#B85C3E]">*</span>
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 75000"
                      value={catPriceInput}
                      onChange={(e) => setCatPriceInput(e.target.value)}
                      className="w-full h-10 px-3 rounded border border-[#E8E1D5] bg-white text-xs text-[#191816] focus:outline-none focus:border-[#71382D]"
                    />
                    {errors.catPrice && <p className="text-[10px] text-[#8A2424] mt-1">{errors.catPrice}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#191816] mb-1">
                      Number of Rooms <span className="text-[#B85C3E]">*</span>
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 4"
                      value={catQtyInput}
                      onChange={(e) => setCatQtyInput(e.target.value)}
                      className="w-full h-10 px-3 rounded border border-[#E8E1D5] bg-white text-xs text-[#191816] focus:outline-none focus:border-[#71382D]"
                    />
                    {errors.catQty && <p className="text-[10px] text-[#8A2424] mt-1">{errors.catQty}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#191816] mb-1">Bed Layout</label>
                    <select
                      value={catBedInput}
                      onChange={(e) => setCatBedInput(e.target.value)}
                      className="w-full h-10 px-3 rounded border border-[#E8E1D5] bg-white text-xs text-[#191816] focus:outline-none focus:border-[#71382D]"
                    >
                      <option value="1 King Bed">1 King Bed</option>
                      <option value="2 Queen Beds">2 Queen Beds</option>
                      <option value="1 Double Bed">1 Double Bed</option>
                      <option value="Twin Beds">Twin Beds</option>
                      <option value="Studio Layout">Studio Layout</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCatForm(false)}
                    className="px-4 h-9 text-xs text-[#7A7267] hover:text-[#191816]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveCategory}
                    className="px-4 h-9 rounded bg-[#71382D] hover:bg-[#5C2D24] text-white text-xs font-medium transition-colors"
                  >
                    Save Room Type
                  </button>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-[#F0ECE4] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-[#7A7267] hover:text-[#191816]"
              >
                &larr; Back
              </button>

              <button
                type="button"
                onClick={() => {
                  if (validateStep2()) setStep(3);
                }}
                className="h-11 px-6 rounded-md bg-[#B85C3E] hover:bg-[#A34E32] text-white text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <span>Continue &rarr;</span>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: GET PAID ─────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="bg-white border border-[#E8E1D5] rounded-xl p-6 sm:p-10 space-y-8 shadow-xs">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-serif text-[#71382D]">Where should guests pay you?</h1>
              <p className="text-xs text-[#7A7267]">Add the bank account you want to show guests for direct transfers.</p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[#191816] mb-1.5">Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. GTBank, Zenith Bank, Moniepoint"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-md border border-[#E8E1D5] bg-[#FAF9F7]/60 text-xs text-[#191816] focus:bg-white focus:outline-none focus:border-[#71382D] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#191816] mb-1.5">Account Name</label>
                <input
                  type="text"
                  placeholder="e.g. The Still House Ltd"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-md border border-[#E8E1D5] bg-[#FAF9F7]/60 text-xs text-[#191816] focus:bg-white focus:outline-none focus:border-[#71382D] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#191816] mb-1.5">Account Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0123456789"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-md border border-[#E8E1D5] bg-[#FAF9F7]/60 text-xs text-[#191816] focus:bg-white focus:outline-none focus:border-[#71382D] transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#7A7267] mb-1.5">Payment Instructions (Optional)</label>
                <input
                  type="text"
                  placeholder="Please use your reservation reference as transfer description."
                  value={paymentInstructions}
                  onChange={(e) => setPaymentInstructions(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-md border border-[#E8E1D5] bg-[#FAF9F7]/60 text-xs text-[#191816] focus:bg-white focus:outline-none focus:border-[#71382D] transition-all"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#F0ECE4] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs text-[#7A7267] hover:text-[#191816]"
              >
                &larr; Back
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleFinish(true)}
                  className="text-xs text-[#7A7267] hover:text-[#191816] font-medium"
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  onClick={() => handleFinish(false)}
                  className="h-11 px-6 rounded-md bg-[#B85C3E] hover:bg-[#A34E32] text-white text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>Finish Setup &amp; Launch &rarr;</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto w-full pt-6 border-t border-[#E8E1D5] text-center text-xs text-[#8C8275]">
        &copy; 2026 Sena Operating System &middot; Your progress is saved.
      </footer>
    </div>
  );
}
