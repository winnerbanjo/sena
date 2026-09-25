'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Topbar } from '../../components/topbar';
import { NewReservationDialog } from '../../components/new-reservation-dialog';
import { Badge, Button } from '@sena/ui';
import {
  Globe,
  ExternalLink,
  Copy,
  Check,
  Smartphone,
  Monitor,
  Eye,
  Settings,
  Image as ImageIcon,
  MapPin,
  ShieldCheck,
  Save,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Plus,
  Star,
  MessageSquare,
  Sparkles,
  Palette,
  Layout,
  RefreshCw,
  Send,
  MessageCircle,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

function WebsiteContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') as any;

  const [newResOpen, setNewResOpen] = React.useState(false);
  const [previewDevice, setPreviewDevice] = React.useState<'desktop' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = React.useState<'preview' | 'brand' | 'sections' | 'reviews' | 'domain' | 'seo'>(
    initialTab || 'preview'
  );
  const [copied, setCopied] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [publishSuccess, setPublishSuccess] = React.useState(false);
  const [lastPublished, setLastPublished] = React.useState<string | null>(null);

  // Property info
  const [propertyName, setPropertyName] = React.useState('Your Property');
  const [propertySlug, setPropertySlug] = React.useState('amami');
  const [slugInput, setSlugInput] = React.useState('amami');
  const [slugUpdating, setSlugUpdating] = React.useState(false);
  const [slugError, setSlugError] = React.useState<string | null>(null);
  const [customDomain, setCustomDomain] = React.useState('');

  // Brand config
  const [theme, setTheme] = React.useState<'sena_one' | 'sena_two' | 'sena_three'>('sena_one');
  const [primaryColor, setPrimaryColor] = React.useState('#71382D');
  const [accentColor, setAccentColor] = React.useState('#B85C3E');
  const [buttonStyle, setButtonStyle] = React.useState<'square' | 'soft' | 'rounded'>('soft');
  const [headingFont, setHeadingFont] = React.useState('serif');
  const [logoUrl, setLogoUrl] = React.useState('');

  // Content config
  const [heroHeadline, setHeroHeadline] = React.useState('');
  const [heroSubheading, setHeroSubheading] = React.useState('');
  const [heroImageUrl, setHeroImageUrl] = React.useState('');
  const [heroCtaLabel, setHeroCtaLabel] = React.useState('Reserve Your Stay');
  const [welcomeEyebrow, setWelcomeEyebrow] = React.useState('Hospitality, Simplified');
  const [welcomeTitle, setWelcomeTitle] = React.useState('A Tranquil Sanctuary in the City');
  const [welcomeBody, setWelcomeBody] = React.useState('');
  const [aboutStory, setAboutStory] = React.useState('');
  const [contactPhone, setContactPhone] = React.useState('');
  const [contactEmail, setContactEmail] = React.useState('');
  const [contactWhatsapp, setContactWhatsapp] = React.useState('');
  const [whatsappEnabled, setWhatsappEnabled] = React.useState(true);

  // SEO config
  const [seoTitle, setSeoTitle] = React.useState('');
  const [seoDescription, setSeoDescription] = React.useState('');

  // Reviews state
  const [reviewsList, setReviewsList] = React.useState<any[]>([]);
  const [reviewFilter, setReviewFilter] = React.useState<'all' | 'published' | 'hidden_for_policy'>('all');
  const [importModalOpen, setImportModalOpen] = React.useState(false);
  const [importName, setImportName] = React.useState('');
  const [importRating, setImportRating] = React.useState(5);
  const [importSource, setImportSource] = React.useState('google');
  const [importBody, setImportBody] = React.useState('');
  const [importing, setImporting] = React.useState(false);
  const [replyReviewId, setReplyReviewId] = React.useState<string | null>(null);
  const [replyText, setReplyText] = React.useState('');

  // Fetch website configuration from API
  const fetchWebsiteData = React.useCallback(async () => {
    try {
      const res = await fetch('/api/website');
      if (res.ok) {
        const data = await res.json();
        const p = data.property;
        const c = data.config;

        if (p) {
          setPropertyName(p.name);
          setPropertySlug(p.slug || 'amami');
          setSlugInput(p.slug || 'amami');
          setCustomDomain(`${p.slug || 'amami'}.com`);
        }

        if (c) {
          setTheme(c.theme || 'sena_one');
          if (c.brandColors) {
            setPrimaryColor(c.brandColors.primaryColor || '#71382D');
            setAccentColor(c.brandColors.accentColor || '#B85C3E');
          }
          if (c.typography) {
            setHeadingFont(c.typography.headingFont || 'serif');
          }
          setButtonStyle(c.buttonStyle || 'soft');
          setLogoUrl(c.logoUrl || '');
          setHeroHeadline(c.heroHeadline || `Experience Warm Hospitality at ${p?.name || 'Our Property'}`);
          setHeroSubheading(c.heroSubheading || '');
          setHeroImageUrl(c.heroImageUrl || '');
          setHeroCtaLabel(c.heroCtaLabel || 'Reserve Your Stay');
          setWelcomeEyebrow(c.welcomeEyebrow || 'Hospitality, Simplified');
          setWelcomeTitle(c.welcomeTitle || 'A Tranquil Sanctuary in the City');
          setWelcomeBody(c.welcomeBody || '');
          setAboutStory(c.aboutStory || '');
          setContactPhone(c.contactPhone || p?.phone || '');
          setContactEmail(c.contactEmail || p?.email || '');
          setContactWhatsapp(c.contactWhatsapp || p?.phone || '');
          setWhatsappEnabled(c.whatsappEnabled ?? true);
          setSeoTitle(c.seoTitle || `${p?.name || 'Hotel'} | Boutique Direct Stays`);
          setSeoDescription(c.seoDescription || '');
          if (c.publishedAt) setLastPublished(new Date(c.publishedAt).toLocaleString());
        }
      }
    } catch (e) {
      console.error('Failed to load website config:', e);
    }
  }, []);

  // Fetch reviews from API
  const fetchReviews = React.useCallback(async () => {
    try {
      const res = await fetch('/api/reviews');
      if (res.ok) {
        const data = await res.json();
        setReviewsList(data.reviews || []);
      }
    } catch (e) {
      console.error('Failed to load reviews:', e);
    }
  }, []);

  React.useEffect(() => {
    fetchWebsiteData();
    fetchReviews();
  }, [fetchWebsiteData, fetchReviews]);

  // Save Draft
  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const payload = {
        draftOnly: false,
        theme,
        brandColors: { primaryColor, accentColor },
        typography: { headingFont, bodyFont: 'sans' },
        buttonStyle,
        logoUrl: logoUrl || null,
        heroHeadline,
        heroSubheading,
        heroImageUrl,
        heroCtaLabel,
        welcomeEyebrow,
        welcomeTitle,
        welcomeBody,
        aboutStory,
        contactPhone,
        contactEmail,
        contactWhatsapp,
        whatsappEnabled,
        seoTitle,
        seoDescription,
      };

      const res = await fetch('/api/website', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert('Failed to save changes');
      }
    } catch (e) {
      alert('Error saving website config');
    } finally {
      setSaving(false);
    }
  };

  // Publish to Live
  const handlePublish = async () => {
    setPublishing(true);
    try {
      // First save latest inputs
      await handleSaveDraft();

      const res = await fetch('/api/website', { method: 'PATCH' });
      if (res.ok) {
        const data = await res.json();
        setPublishSuccess(true);
        setLastPublished(new Date().toLocaleString());
        setTimeout(() => setPublishSuccess(false), 4000);
      } else {
        alert('Failed to publish website');
      }
    } catch {
      alert('Error publishing website');
    } finally {
      setPublishing(false);
    }
  };

  // Update Slug
  const handleUpdateSlug = async (e: React.FormEvent) => {
    e.preventDefault();
    setSlugUpdating(true);
    setSlugError(null);

    try {
      const res = await fetch('/api/website/slug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slugInput }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPropertySlug(data.slug);
        alert(`Subdomain successfully updated to: https://${data.subdomain}`);
      } else {
        setSlugError(data.error || 'Failed to update subdomain slug');
      }
    } catch (err: any) {
      setSlugError(err.message || 'Network error');
    } finally {
      setSlugUpdating(false);
    }
  };

  // Import Manual Review
  const handleImportReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importName || !importBody) return;
    setImporting(true);

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: importName,
          rating: importRating,
          source: importSource,
          body: importBody,
        }),
      });

      if (res.ok) {
        setImportModalOpen(false);
        setImportName('');
        setImportBody('');
        fetchReviews();
      } else {
        alert('Failed to import review');
      }
    } catch {
      alert('Error importing review');
    } finally {
      setImporting(false);
    }
  };

  // Reply to Review
  const handleReplyReview = async (reviewId: string) => {
    if (!replyText.trim()) return;

    try {
      const res = await fetch('/api/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          response: replyText,
        }),
      });

      if (res.ok) {
        setReplyReviewId(null);
        setReplyText('');
        fetchReviews();
      } else {
        alert('Failed to post response');
      }
    } catch {
      alert('Error submitting response');
    }
  };

  // Toggle Review Status (publish / hide)
  const handleToggleReviewStatus = async (reviewId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'published' ? 'hidden_for_policy' : 'published';

    try {
      const res = await fetch('/api/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          status: newStatus,
        }),
      });

      if (res.ok) {
        fetchReviews();
      }
    } catch {
      alert('Error updating review status');
    }
  };

  const workingDirectUrl = `https://app.sena.ng/${propertySlug}`;
  const subdomainUrl = `https://${propertySlug}.sena.ng`;
  const previewUrl = `/site/${propertySlug}`;

  const copyUrl = () => {
    navigator.clipboard?.writeText(subdomainUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      <Topbar title="Hotel Website CMS" onOpenNewReservation={() => setNewResOpen(true)} />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 bg-white">
        {/* Top Status & Action Bar */}
        <div className="bg-[#FAF7F2] border border-[#E8E2DA] rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#191816]">
                  {propertyName} Direct Website
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live &amp; Active
                </span>
              </div>
              <p className="text-xs text-[#7A7267] mt-1">
                Luxury direct booking website &middot; Instant confirmation &middot; Powered by Sena Engine
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <Button
                onClick={handleSaveDraft}
                disabled={saving}
                variant="outline"
                className="flex items-center gap-1.5 text-xs bg-white hover:bg-stone-50 border-[#D5CFC7]"
              >
                <Save className="w-3.5 h-3.5 text-[#7A7267]" />
                <span>{saveSuccess ? 'Draft Saved!' : saving ? 'Saving...' : 'Save Draft'}</span>
              </Button>

              <Button
                onClick={handlePublish}
                disabled={publishing}
                className="flex items-center gap-1.5 text-xs bg-[#71382D] hover:bg-[#5A2C23] text-white shadow-xs font-medium"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{publishSuccess ? 'Website Published Live!' : publishing ? 'Publishing...' : 'Publish Website'}</span>
              </Button>
            </div>
          </div>

          {/* Live Address & Quick Access Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#E8E2DA]/80 bg-white/70 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-4 sm:px-6 rounded-b-xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-[#5C564D]">
                <Globe className="w-3.5 h-3.5 text-[#71382D]" />
                <span className="font-medium text-[#191816]">Live Address:</span>
              </div>
              <a
                href={subdomainUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs font-semibold text-[#71382D] hover:underline bg-[#FAF7F2] px-2.5 py-1 rounded border border-[#E8E2DA] inline-flex items-center gap-1.5"
                title="Open live website in new tab"
              >
                {propertySlug}.sena.ng
                <ExternalLink className="w-3 h-3 text-[#B85C3E]" />
              </a>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <Check className="w-3 h-3" />
                Wildcard SSL Active
              </span>
              {lastPublished && (
                <span className="text-[11px] text-[#A39B90] hidden md:inline">
                  &middot; Published: {lastPublished}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyUrl}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs font-medium text-[#191816] hover:bg-[#FAF7F2] hover:border-[#D5CFC7] transition-all cursor-pointer shadow-2xs"
                title="Copy direct website address"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-medium">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#7A7267]" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>

              <a
                href={subdomainUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#191816] text-white text-xs font-medium hover:bg-[#2C2A28] transition-colors shadow-2xs"
              >
                <span>Open Website</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#E8E2DA]" />
              </a>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E8E2DA] gap-2">
          <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto whitespace-nowrap">
            {[
              { id: 'preview', label: 'Live Preview', icon: Eye },
              { id: 'brand', label: 'Brand & Themes', icon: Palette },
              { id: 'sections', label: 'Page Content', icon: Layout },
              { id: 'reviews', label: 'Guest Reviews', icon: Star },
              { id: 'domain', label: 'Subdomain & SSL', icon: Globe },
              { id: 'seo', label: 'SEO & Social Cards', icon: ShieldCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'border-[#B85C3E] text-[#B85C3E] font-semibold'
                      : 'border-transparent text-[#7A7267] hover:text-[#191816]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {activeTab === 'preview' && (
            <div className="flex items-center gap-1 p-0.5 rounded border border-[#E8E2DA] bg-[#FAFAFA] mb-2">
              <button
                onClick={() => setPreviewDevice('desktop')}
                className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors ${
                  previewDevice === 'desktop'
                    ? 'bg-white shadow-xs text-[#191816] font-medium'
                    : 'text-[#7A7267] hover:text-[#191816]'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="text-[11px]">Desktop</span>
              </button>
              <button
                onClick={() => setPreviewDevice('mobile')}
                className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors ${
                  previewDevice === 'mobile'
                    ? 'bg-white shadow-xs text-[#191816] font-medium'
                    : 'text-[#7A7267] hover:text-[#191816]'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="text-[11px]">Mobile (375px)</span>
              </button>
            </div>
          )}
        </div>

        {/* TAB 1: LIVE INTERACTIVE PREVIEW */}
        {activeTab === 'preview' && (
          <div className="flex justify-center bg-[#F9F7F5] p-4 sm:p-6 rounded-xl border border-[#E8E2DA]">
            <div
              className={`bg-white rounded-xl shadow-lg border border-[#E8E2DA] overflow-hidden transition-all duration-300 ${
                previewDevice === 'desktop' ? 'w-full max-w-5xl' : 'w-[375px]'
              }`}
            >
              {/* Browser Address Bar Simulator */}
              <div className="bg-[#F0ECE6] px-4 py-2 border-b border-[#E8E2DA] flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 bg-white px-3 py-1 rounded text-[11px] text-[#7A7267] flex items-center justify-between border border-[#E8E2DA]/60">
                  <div className="flex items-center gap-1.5 truncate">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span className="text-[#191816] font-mono">https://{propertySlug}.sena.ng</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 rounded font-medium">SSL Secure</span>
                </div>
              </div>

              {/* Embedded Live Iframe or Visual Preview */}
              <iframe
                src={previewUrl}
                className="w-full h-[640px] border-0 bg-white"
                title="Website Live Preview"
              />
            </div>
          </div>
        )}

        {/* TAB 2: BRAND & THEMES */}
        {activeTab === 'brand' && (
          <div className="space-y-6 max-w-4xl">
            {/* Curated Themes */}
            <div className="bg-white border border-[#E8E2DA] rounded-xl p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-[#191816]">Curated Hospitality Themes</h3>
                <p className="text-xs text-[#7A7267]">
                  Switch themes seamlessly at any time. All your content, room inventory, photos, and reviews are 100% preserved.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {[
                  {
                    id: 'sena_one',
                    name: 'Sena One',
                    vibe: 'Modern Luxury',
                    desc: 'Cinematic full-width imagery, clean sans typography, bold room cards, and generous whitespace.',
                    badge: 'Popular for Suites & Serviced Apts',
                  },
                  {
                    id: 'sena_two',
                    name: 'Sena Two',
                    vibe: 'Editorial Boutique',
                    desc: 'Classic serif headings, warm neutral tones, asymmetric magazine framing, and refined captions.',
                    badge: 'Boutique Stays & Heritage',
                  },
                  {
                    id: 'sena_three',
                    name: 'Sena Three',
                    vibe: 'Warm Resort',
                    desc: 'Earthy terracotta palette, pill-shaped buttons, immersive photo grid, and experiential highlights.',
                    badge: 'Resorts & Villas',
                  },
                ].map((th) => (
                  <div
                    key={th.id}
                    onClick={() => setTheme(th.id as any)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                      theme === th.id
                        ? 'border-[#71382D] bg-[#FAF7F2] ring-2 ring-[#71382D]/20 shadow-xs'
                        : 'border-[#E8E2DA] bg-white hover:border-[#71382D]/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <strong className="font-serif text-base text-[#191816]">{th.name}</strong>
                        {theme === th.id && (
                          <span className="w-2 h-2 rounded-full bg-[#71382D]" />
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-[#B85C3E] block mt-0.5">{th.vibe}</span>
                      <p className="text-xs text-[#7A7267] mt-2 leading-relaxed">{th.desc}</p>
                    </div>
                    <span className="text-[10px] text-[#5C564D] bg-white px-2 py-0.5 rounded border border-[#E8E2DA] inline-block font-mono">
                      {th.badge}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Colors & Styling */}
            <div className="bg-white border border-[#E8E2DA] rounded-xl p-6 space-y-5">
              <div>
                <h3 className="text-base font-semibold text-[#191816]">Brand Palette &amp; Accents</h3>
                <p className="text-xs text-[#7A7267]">
                  Define the signature tones that will subtly tint buttons, badges, and highlights across your site.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Primary Brand Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-10 h-10 rounded border border-[#E8E2DA] cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-28 px-3 py-2 rounded border border-[#E8E2DA] font-mono text-xs text-[#191816]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#191816] mb-1">
                    Secondary Accent Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-10 h-10 rounded border border-[#E8E2DA] cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-28 px-3 py-2 rounded border border-[#E8E2DA] font-mono text-xs text-[#191816]"
                    />
                  </div>
                </div>
              </div>

              {/* Button Shape */}
              <div className="pt-2 border-t border-[#F0ECE4]">
                <label className="block text-xs font-medium text-[#191816] mb-2">Button Corners</label>
                <div className="flex items-center gap-3">
                  {[
                    { id: 'square', label: 'Square (0px)' },
                    { id: 'soft', label: 'Soft (6px)' },
                    { id: 'rounded', label: 'Pill Rounded' },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => setButtonStyle(btn.id as any)}
                      className={`px-4 py-2 text-xs font-medium border transition-all ${
                        buttonStyle === btn.id
                          ? 'border-[#71382D] bg-[#FAF7F2] text-[#71382D] font-semibold'
                          : 'border-[#E8E2DA] text-[#5C564D] hover:bg-[#FAFAFA]'
                      } ${btn.id === 'square' ? 'rounded-none' : btn.id === 'soft' ? 'rounded-md' : 'rounded-full'}`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Typography */}
              <div className="pt-2 border-t border-[#F0ECE4]">
                <label className="block text-xs font-medium text-[#191816] mb-2">Heading Typography</label>
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  <button
                    type="button"
                    onClick={() => setHeadingFont('serif')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      headingFont === 'serif'
                        ? 'border-[#71382D] bg-[#FAF7F2] text-[#71382D]'
                        : 'border-[#E8E2DA] text-[#5C564D]'
                    }`}
                  >
                    <span className="font-serif text-base block font-normal">Editorial Serif</span>
                    <span className="text-[10px] text-[#7A7267]">Warm, sophisticated hospitality</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHeadingFont('sans')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      headingFont === 'sans'
                        ? 'border-[#71382D] bg-[#FAF7F2] text-[#71382D]'
                        : 'border-[#E8E2DA] text-[#5C564D]'
                    }`}
                  >
                    <span className="font-sans text-base block font-medium">Modern Clean Sans</span>
                    <span className="text-[10px] text-[#7A7267]">Crisp, architectural clarity</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SECTIONS & CONTENT */}
        {activeTab === 'sections' && (
          <div className="space-y-6 max-w-4xl">
            {/* Hero Section Content */}
            <div className="bg-white border border-[#E8E2DA] rounded-xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-[#191816]">Hero &amp; Headline</h3>
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-[#191816] mb-1">Headline</label>
                  <input
                    type="text"
                    value={heroHeadline}
                    onChange={(e) => setHeroHeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#191816] mb-1">Subheading</label>
                  <textarea
                    rows={2}
                    value={heroSubheading}
                    onChange={(e) => setHeroSubheading(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#191816] mb-1">Hero Image URL</label>
                  <input
                    type="text"
                    value={heroImageUrl}
                    onChange={(e) => setHeroImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] font-mono focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                  />
                </div>
              </div>
            </div>

            {/* Welcome Intro */}
            <div className="bg-white border border-[#E8E2DA] rounded-xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-[#191816]">Property Introduction</h3>
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-[#191816] mb-1">Intro Heading</label>
                  <input
                    type="text"
                    value={welcomeTitle}
                    onChange={(e) => setWelcomeTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#191816] mb-1">Welcome Story &amp; Description</label>
                  <textarea
                    rows={4}
                    value={welcomeBody}
                    onChange={(e) => setWelcomeBody(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                  />
                </div>
              </div>
            </div>

            {/* Direct Channels & WhatsApp */}
            <div className="bg-white border border-[#E8E2DA] rounded-xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-[#191816]">Concierge &amp; WhatsApp</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-[#191816] mb-1">Front Desk Phone</label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#191816] mb-1">Inquiry Email</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#191816] mb-1">WhatsApp Business Number</label>
                  <input
                    type="text"
                    value={contactWhatsapp}
                    onChange={(e) => setContactWhatsapp(e.target.value)}
                    placeholder="+234 800 000 0000"
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                  />
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <input
                    type="checkbox"
                    id="wa-toggle"
                    checked={whatsappEnabled}
                    onChange={(e) => setWhatsappEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-[#71382D] focus:ring-[#71382D]"
                  />
                  <label htmlFor="wa-toggle" className="text-xs font-medium text-[#191816]">
                    Enable WhatsApp direct chat on website
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: REVIEWS MANAGEMENT */}
        {activeTab === 'reviews' && (
          <div className="space-y-6 max-w-5xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E8E2DA] p-6 rounded-xl">
              <div>
                <h3 className="text-base font-semibold text-[#191816]">Guest Reviews Moderation</h3>
                <p className="text-xs text-[#7A7267] mt-0.5">
                  Verified stay reviews from direct bookings appear here. You can also import existing reviews from Google or Booking.com.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setImportModalOpen(true)}
                  className="flex items-center gap-1.5 text-xs bg-[#71382D] hover:bg-[#5A2C23] text-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Import Review</span>
                </Button>
              </div>
            </div>

            {/* Reviews List */}
            <div className="bg-white border border-[#E8E2DA] rounded-xl divide-y divide-[#E8E2DA] overflow-hidden">
              {reviewsList.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#7A7267]">
                  No reviews recorded yet. Click &ldquo;Import Review&rdquo; to add existing testimonials.
                </div>
              ) : (
                reviewsList.map((rev) => (
                  <div key={rev.id} className="p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <strong className="text-sm font-semibold text-[#191816]">{rev.guestName}</strong>
                        {rev.isVerifiedStay ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#2E6B4F] bg-[#EBF5ED] px-2 py-0.5 rounded-full border border-[#D1EADB]">
                            <ShieldCheck className="w-3 h-3" /> Verified Stay
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase font-mono text-[#7A7267] bg-[#FAF7F2] px-2 py-0.5 rounded border border-[#E8E2DA]">
                            {rev.source}
                          </span>
                        )}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            rev.status === 'published'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {rev.status === 'published' ? 'Published' : 'Hidden'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex text-amber-500">
                          {[...Array(rev.rating)].map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-current" />
                          ))}
                        </div>
                        <span className="text-[#7A7267]">
                          {new Date(rev.submittedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-[#5C564D] leading-relaxed italic">
                      &ldquo;{rev.body}&rdquo;
                    </p>

                    {/* Existing response */}
                    {rev.response && (
                      <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E8E2DA] text-xs space-y-1">
                        <span className="font-semibold text-[#71382D] block flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Owner Response:</span>
                        </span>
                        <p className="text-[#5C564D] italic">{rev.response}</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="pt-2 flex items-center gap-3 text-xs">
                      <button
                        onClick={() => {
                          setReplyReviewId(rev.id);
                          setReplyText(rev.response || '');
                        }}
                        className="text-[#71382D] hover:underline font-medium"
                      >
                        {rev.response ? 'Edit Response' : 'Reply to Guest'}
                      </button>

                      <button
                        onClick={() => handleToggleReviewStatus(rev.id, rev.status)}
                        className="text-[#7A7267] hover:text-[#191816]"
                      >
                        {rev.status === 'published' ? 'Hide Review' : 'Publish Review'}
                      </button>
                    </div>

                    {/* Reply composer */}
                    {replyReviewId === rev.id && (
                      <div className="mt-3 p-3 bg-[#FAF7F2] rounded-lg border border-[#E8E2DA] space-y-2">
                        <label className="block text-[11px] font-semibold text-[#191816]">
                          Public Response from {propertyName}
                        </label>
                        <textarea
                          rows={2}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Thank you for staying with us..."
                          className="w-full p-2 bg-white rounded border border-[#E8E2DA] text-xs focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReplyReview(rev.id)}
                            className="px-3 py-1.5 rounded bg-[#71382D] text-white text-xs font-medium"
                          >
                            Save Response
                          </button>
                          <button
                            onClick={() => setReplyReviewId(null)}
                            className="px-3 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs text-[#7A7267]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5: SUBDOMAIN & CUSTOM DOMAIN */}
        {activeTab === 'domain' && (
          <div className="space-y-6 max-w-3xl">
            {/* Sena Subdomain Editor */}
            <div className="bg-white border border-[#E8E2DA] rounded-xl p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-[#191816]">Sena Subdomain</h3>
                <p className="text-xs text-[#7A7267]">
                  Your permanent, high-speed direct booking address hosted on Sena edge infrastructure.
                </p>
              </div>

              <form onSubmit={handleUpdateSlug} className="space-y-3">
                <label className="block text-xs font-medium text-[#191816]">Subdomain Name</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center rounded border border-[#E8E2DA] overflow-hidden bg-[#FAFAFA] focus-within:ring-1 focus-within:ring-[#71382D]">
                    <span className="px-3 text-xs text-[#7A7267] font-mono select-none">https://</span>
                    <input
                      type="text"
                      value={slugInput}
                      onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      className="flex-1 py-2 px-1 text-xs text-[#191816] font-mono bg-white focus:outline-none"
                    />
                    <span className="px-3 text-xs text-[#7A7267] font-mono select-none">.sena.ng</span>
                  </div>
                  <Button type="submit" disabled={slugUpdating} className="text-xs">
                    {slugUpdating ? 'Saving...' : 'Update Subdomain'}
                  </Button>
                </div>

                {slugError && <p className="text-xs text-rose-600 font-medium">{slugError}</p>}

                <div className="p-3.5 bg-stone-50 rounded-lg border border-[#E8E2DA] space-y-2 text-xs pt-3 mt-3 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-[#5C564D] font-medium">Official Branded Address:</span>
                    <a
                      href={subdomainUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[#71382D] font-semibold hover:underline inline-flex items-center gap-1.5"
                    >
                      {subdomainUrl}
                      <ExternalLink className="w-3 h-3 text-[#B85C3E]" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#7A7267]">SSL &amp; Wildcard Status:</span>
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                      <Check className="w-3 h-3" />
                      Live &amp; Verified
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#E8E2DA]">
                    <span className="text-[#7A7267]">Platform Direct Route:</span>
                    <a
                      href={workingDirectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[#7A7267] hover:underline"
                    >
                      {workingDirectUrl}
                    </a>
                  </div>
                </div>

                <div className="p-3.5 bg-[#FAF7F2] rounded-lg border border-[#E8E2DA] text-xs text-[#5C564D] space-y-1.5">
                  <div className="flex items-center gap-1.5 font-medium text-[#191816]">
                    <Sparkles className="w-3.5 h-3.5 text-[#71382D]" />
                    <span>Instant Wildcard Routing Active</span>
                  </div>
                  <p className="text-[#7A7267] text-[11px] leading-relaxed">
                    Your direct booking website is active at <strong className="font-mono text-[#191816]">{subdomainUrl}</strong> with automatic HTTPS encryption.
                    If you recently tested this address before wildcard configuration and saw a 404, your web browser may have cached that response. Please perform a hard refresh (<code className="font-mono bg-white px-1 py-0.5 rounded border border-[#E8E2DA]">Cmd + Shift + R</code>) or open in a Private / Incognito window.
                  </p>
                </div>
              </form>
            </div>

            {/* Custom Domain (Future CNAME Mapping) */}
            <div className="bg-white border border-[#E8E2DA] rounded-xl p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-[#191816]">Custom Domain</h3>
                <p className="text-xs text-[#7A7267]">
                  Connect your primary domain (e.g. <code>{propertySlug}.com</code>) to your Sena direct booking website.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-[#FAF7F2] border border-[#E8E2DA] space-y-3 text-xs">
                <div className="flex items-center justify-between font-medium">
                  <span>DNS Target Configuration</span>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
                    Ready for Verification
                  </span>
                </div>
                <div className="bg-white p-3 rounded border border-[#E8E2DA] font-mono text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#7A7267]">Record Type:</span>
                    <span>CNAME</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7A7267]">Host / Name:</span>
                    <span>@ or www</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7A7267]">Points To / Value:</span>
                    <span className="text-[#71382D] font-bold">cname.sena.ng</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: SEO & SOCIAL CARDS */}
        {activeTab === 'seo' && (
          <div className="space-y-6 max-w-3xl">
            <div className="bg-white border border-[#E8E2DA] rounded-xl p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-[#191816]">Search Engine Optimization (SEO)</h3>
                <p className="text-xs text-[#7A7267]">
                  Control how your hotel appears in Google search snippets and social media previews.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-[#191816] mb-1">
                    Meta Title (Max 65 characters)
                  </label>
                  <input
                    type="text"
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#191816] mb-1">
                    Meta Description (Max 160 characters)
                  </label>
                  <textarea
                    rows={3}
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                  />
                </div>

                {/* Google Preview */}
                <div className="p-4 rounded-lg bg-[#FAF7F2] border border-[#E8E2DA] space-y-1">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-[#7A7267] block">
                    Google Search Snippet Preview
                  </span>
                  <div className="pt-1 space-y-0.5">
                    <span className="text-xs text-[#1a0dab] font-medium hover:underline cursor-pointer block truncate">
                      {seoTitle || `${propertyName} | Boutique Stays`}
                    </span>
                    <span className="text-[11px] text-[#006621] block">
                      https://{propertySlug}.sena.ng
                    </span>
                    <p className="text-[11px] text-[#545454] leading-relaxed">
                      {seoDescription || `Book directly at ${propertyName} for the guaranteed best rate and exclusive perks.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Manual Review Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E8E2DA] max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="border-b border-[#E8E2DA] pb-3">
              <h3 className="font-serif text-lg text-[#191816]">Import External Testimonial</h3>
              <p className="text-[11px] text-[#7A7267]">
                Import existing reviews from Google, Booking.com, or direct feedback.
              </p>
            </div>

            <form onSubmit={handleImportReview} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Guest Name *</label>
                <input
                  type="text"
                  required
                  value={importName}
                  placeholder="e.g. Tunde Lawal"
                  onChange={(e) => setImportName(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Rating</label>
                  <select
                    value={importRating}
                    onChange={(e) => setImportRating(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] bg-white focus:outline-none"
                  >
                    <option value={5}>5 Stars (Excellent)</option>
                    <option value={4}>4 Stars (Very Good)</option>
                    <option value={3}>3 Stars (Average)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Source Platform</label>
                  <select
                    value={importSource}
                    onChange={(e) => setImportSource(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[#E8E2DA] bg-white focus:outline-none"
                  >
                    <option value="google">Google Reviews</option>
                    <option value="booking_com">Booking.com</option>
                    <option value="airbnb">Airbnb</option>
                    <option value="manual">Guest Book</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Review Content *</label>
                <textarea
                  rows={3}
                  required
                  value={importBody}
                  placeholder="Copy the guest quote here..."
                  onChange={(e) => setImportBody(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-[#E8E2DA] focus:outline-none focus:ring-1 focus:ring-[#71382D]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={importing} className="flex-1 text-xs bg-[#71382D] text-white">
                  {importing ? 'Importing...' : 'Save Review'}
                </Button>
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 rounded border border-[#E8E2DA] text-xs text-[#7A7267]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <NewReservationDialog open={newResOpen} onOpenChange={setNewResOpen} onCreateReservation={() => {}} />
    </div>
  );
}

export default function WebsitePage() {
  return (
    <React.Suspense fallback={<div className="flex h-screen items-center justify-center text-xs text-[#7A7267]">Loading Website Engine...</div>}>
      <WebsiteContent />
    </React.Suspense>
  );
}

