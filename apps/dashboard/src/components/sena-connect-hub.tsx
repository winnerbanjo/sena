'use client';

import * as React from 'react';
import {
  Code2,
  Copy,
  Check,
  Key,
  Webhook,
  Activity,
  BookOpen,
  Terminal,
  ExternalLink,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Send,
  Shield,
  Layers,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Badge, Button, Input } from '@sena/ui';

interface SenaConnectHubProps {
  propertyId: string;
  propertyName: string;
  propertySlug: string;
}

interface ApiKeyItem {
  id: string;
  name: string;
  keyType: 'publishable' | 'secret';
  keyPrefix: string;
  displayKey: string;
  scopes: string[];
  isRevoked: boolean;
  lastUsedAt?: string;
  createdAt: string;
}

interface WebhookItem {
  id: string;
  url: string;
  description?: string;
  events: string[];
  signingSecret: string;
  isActive: boolean;
  createdAt: string;
}

interface WebhookDeliveryItem {
  id: string;
  eventType: string;
  eventId: string;
  status: 'success' | 'failed';
  httpStatus?: number;
  attemptCount: number;
  createdAt: string;
}

interface ApiLogItem {
  id: string;
  method: string;
  endpoint: string;
  statusCode: number;
  latencyMs: number;
  keyName?: string;
  ipAddress?: string;
  createdAt: string;
}

export function SenaConnectHub({
  propertyId,
  propertyName,
  propertySlug,
}: SenaConnectHubProps) {
  const [activeTab, setActiveTab] = React.useState<
    'embed' | 'keys' | 'webhooks' | 'quickstart' | 'logs'
  >('embed');

  // Copy helper
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // API Keys state
  const [keys, setKeys] = React.useState<ApiKeyItem[]>([]);
  const [loadingKeys, setLoadingKeys] = React.useState(false);
  const [newKeyModal, setNewKeyModal] = React.useState(false);
  const [newKeyName, setNewKeyName] = React.useState('');
  const [newKeyType, setNewKeyType] = React.useState<'publishable' | 'secret'>('publishable');
  const [revealedKey, setRevealedKey] = React.useState<string | null>(null);

  // Webhooks state
  const [webhooks, setWebhooks] = React.useState<WebhookItem[]>([]);
  const [deliveries, setDeliveries] = React.useState<WebhookDeliveryItem[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = React.useState(false);
  const [newWebhookModal, setNewWebhookModal] = React.useState(false);
  const [webhookUrl, setWebhookUrl] = React.useState('');
  const [webhookDesc, setWebhookDesc] = React.useState('');
  const [selectedEvents, setSelectedEvents] = React.useState<string[]>([
    'reservation.created',
    'reservation.confirmed',
    'reservation.cancelled',
  ]);
  const [testingWebhook, setTestingWebhook] = React.useState(false);
  const [testResult, setTestResult] = React.useState<string | null>(null);

  // Logs state
  const [logs, setLogs] = React.useState<ApiLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = React.useState(false);

  // Load API keys
  const loadKeys = React.useCallback(async () => {
    setLoadingKeys(true);
    try {
      const res = await fetch('/api/connect/keys');
      const data = await res.json();
      if (data.keys) setKeys(data.keys);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  // Load webhooks
  const loadWebhooks = React.useCallback(async () => {
    setLoadingWebhooks(true);
    try {
      const res = await fetch('/api/connect/webhooks');
      const data = await res.json();
      if (data.webhooks) setWebhooks(data.webhooks);
      if (data.deliveries) setDeliveries(data.deliveries);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingWebhooks(false);
    }
  }, []);

  // Load logs
  const loadLogs = React.useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/connect/logs');
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  React.useEffect(() => {
    if (activeTab === 'keys') loadKeys();
    if (activeTab === 'webhooks') loadWebhooks();
    if (activeTab === 'logs') loadLogs();
  }, [activeTab, loadKeys, loadWebhooks, loadLogs]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    try {
      const res = await fetch('/api/connect/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName.trim(),
          keyType: newKeyType,
          scopes: newKeyType === 'publishable' ? ['availability:read', 'rooms:read', 'holds:create', 'reservations:create'] : ['*'],
        }),
      });
      const data = await res.json();
      if (data.key?.rawKey) {
        setRevealedKey(data.key.rawKey);
        loadKeys();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? Any applications using it will be immediately blocked.')) return;
    try {
      await fetch(`/api/connect/keys?id=${id}`, { method: 'DELETE' });
      loadKeys();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;

    try {
      await fetch('/api/connect/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl.trim(),
          description: webhookDesc.trim(),
          events: selectedEvents,
        }),
      });
      setNewWebhookModal(false);
      setWebhookUrl('');
      setWebhookDesc('');
      loadWebhooks();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to remove this webhook endpoint?')) return;
    try {
      await fetch(`/api/connect/webhooks?id=${id}`, { method: 'DELETE' });
      loadWebhooks();
    } catch (e) {
      console.error(e);
    }
  };

  const testOpenModal = () => {
    if (typeof window !== 'undefined') {
      const existingScript = document.getElementById('sena-embed-script');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'sena-embed-script';
        script.src = '/embed/v1.js';
        script.onload = () => {
          (window as any).Sena?.openBooking({ propertyId });
        };
        document.body.appendChild(script);
      } else {
        (window as any).Sena?.openBooking({ propertyId });
      }
    }
  };

  const embedScriptTag = `<script src="https://app.sena.ng/embed/v1.js" async></script>`;
  const bookingButtonHtml = `<button\n  data-sena-booking="${propertyId}"\n  style="background:#1B2A4A; color:#fff; padding:12px 24px; border-radius:8px; border:none; font-weight:600; cursor:pointer;"\n>\n  Reserve Your Stay\n</button>`;
  const bookingWidgetHtml = `<div\n  id="sena-booking-widget"\n  data-property="${propertyId}"\n  data-primary-color="#1B2A4A"\n></div>`;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-[#E8E2DA] bg-gradient-to-r from-[#FAF8F5] to-white p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-[#B85C3E] bg-[#B85C3E]/10 px-2 py-0.5 rounded">
                Sena Connect v1.0
              </span>
              <span className="text-xs text-[#7A7267]">Interoperability Suite</span>
            </div>
            <h2 className="text-xl font-serif text-[#191816] mt-2">
              Connect Your Existing Hotel Website
            </h2>
            <p className="text-xs text-[#7A7267] mt-1 max-w-2xl leading-relaxed">
              Plug Sena's authoritative inventory engine, live availability checks, and direct booking modal into your custom website — whether built with Next.js, Webflow, WordPress, or HTML.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-2 bg-white border border-[#E8E2DA] p-3 rounded-lg">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A7267]">
              Property Tenant ID
            </span>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono font-semibold text-[#191816] bg-[#FAF8F5] px-2 py-1 rounded border border-[#E8E2DA]">
                {propertyId}
              </code>
              <button
                onClick={() => copyToClipboard(propertyId, 'prop-id')}
                className="p-1.5 text-[#7A7267] hover:text-[#191816] rounded hover:bg-[#FAF8F5] transition"
                title="Copy Property ID"
              >
                {copiedKey === 'prop-id' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E8E2DA] pb-1 overflow-x-auto whitespace-nowrap">
        {[
          { id: 'embed', label: '1. Booking Button & Widget', icon: Code2 },
          { id: 'keys', label: '2. API Keys', icon: Key },
          { id: 'webhooks', label: '3. Webhooks Engine', icon: Webhook },
          { id: 'quickstart', label: '4. Next.js & REST Docs', icon: BookOpen },
          { id: 'logs', label: '5. Live Request Logs', icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-t border-b-2 -mb-1 transition ${
                isActive
                  ? 'border-[#B85C3E] text-[#B85C3E] bg-[#FAF8F5] font-semibold'
                  : 'border-transparent text-[#7A7267] hover:text-[#191816]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: EMBEDDABLE BOOKING BUTTON & WIDGET */}
      {activeTab === 'embed' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Step 1: Include Script */}
            <div className="bg-white border border-[#E8E2DA] rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider font-semibold text-[#191816]">
                  Step A: Embed Universal Script
                </span>
                <button
                  onClick={() => copyToClipboard(embedScriptTag, 'script')}
                  className="flex items-center gap-1 text-[11px] font-medium text-[#B85C3E] hover:underline"
                >
                  {copiedKey === 'script' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'script' ? 'Copied!' : 'Copy Snippet'}</span>
                </button>
              </div>
              <p className="text-xs text-[#7A7267]">
                Add this script before the closing <code>&lt;/body&gt;</code> tag on your website. It loads asynchronously with zero layout shifts.
              </p>
              <pre className="p-3 bg-[#191816] text-[#FAF8F5] rounded text-xs font-mono overflow-x-auto">
                <code>{embedScriptTag}</code>
              </pre>
            </div>

            {/* Test Interactive Modal */}
            <div className="bg-[#FAF8F5] border border-[#E8E2DA] rounded-lg p-5 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider font-semibold text-[#191816]">
                  Live Preview Sandbox
                </span>
                <h4 className="text-sm font-semibold text-[#191816] mt-1">Test The Overlay Sheet</h4>
                <p className="text-xs text-[#7A7267] mt-1 leading-relaxed">
                  Verify how the guest booking modal opens, displays live rooms, and facilitates reservation checkout for <strong>{propertyName}</strong>.
                </p>
              </div>
              <button
                onClick={testOpenModal}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-[#191816] text-white text-xs font-semibold hover:bg-[#2C2A26] transition shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Test Open Booking Modal Now</span>
              </button>
            </div>
          </div>

          {/* Step 2: Choose Embed Mode */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Option 1: Trigger Button */}
            <div className="bg-white border border-[#E8E2DA] rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono uppercase tracking-wider font-semibold text-[#191816]">
                    Option 1: Booking Button
                  </span>
                  <p className="text-xs text-[#7A7267] mt-0.5">Attach to any button or link on your hero section or navigation bar.</p>
                </div>
                <button
                  onClick={() => copyToClipboard(bookingButtonHtml, 'btn-code')}
                  className="flex items-center gap-1 text-[11px] font-medium text-[#B85C3E] hover:underline"
                >
                  {copiedKey === 'btn-code' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'btn-code' ? 'Copied!' : 'Copy HTML'}</span>
                </button>
              </div>
              <pre className="p-3 bg-[#191816] text-[#FAF8F5] rounded text-xs font-mono overflow-x-auto">
                <code>{bookingButtonHtml}</code>
              </pre>
            </div>

            {/* Option 2: Inline Search Bar Widget */}
            <div className="bg-white border border-[#E8E2DA] rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono uppercase tracking-wider font-semibold text-[#191816]">
                    Option 2: Inline Availability Bar
                  </span>
                  <p className="text-xs text-[#7A7267] mt-0.5">Renders an interactive Check-in / Check-out & Guests bar on your homepage.</p>
                </div>
                <button
                  onClick={() => copyToClipboard(bookingWidgetHtml, 'widget-code')}
                  className="flex items-center gap-1 text-[11px] font-medium text-[#B85C3E] hover:underline"
                >
                  {copiedKey === 'widget-code' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'widget-code' ? 'Copied!' : 'Copy HTML'}</span>
                </button>
              </div>
              <pre className="p-3 bg-[#191816] text-[#FAF8F5] rounded text-xs font-mono overflow-x-auto">
                <code>{bookingWidgetHtml}</code>
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: API KEYS */}
      {activeTab === 'keys' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-serif text-[#191816]">Developer API Keys</h3>
              <p className="text-xs text-[#7A7267] mt-0.5">
                Keys allow external applications to interact with Sena's inventory and reservation engine.
              </p>
            </div>
            <Button
              onClick={() => {
                setRevealedKey(null);
                setNewKeyName('');
                setNewKeyModal(true);
              }}
              className="flex items-center gap-1 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Generate API Key</span>
            </Button>
          </div>

          {/* Active Keys Table */}
          <div className="bg-white border border-[#E8E2DA] rounded-lg overflow-hidden">
            <div className="p-4 border-b border-[#E8E2DA] flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider font-semibold text-[#191816]">
                Configured Keys ({keys.length})
              </span>
              <button onClick={loadKeys} className="text-xs text-[#7A7267] hover:text-[#191816] flex items-center gap-1">
                <RefreshCw className={`w-3 h-3 ${loadingKeys ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {keys.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#7A7267]">
                No API keys created yet. Generate a publishable key for client widgets or a secret key for server-side integrations.
              </div>
            ) : (
              <div className="divide-y divide-[#E8E2DA]">
                {keys.map((k) => (
                  <div key={k.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#191816]">{k.name}</span>
                        <span
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                            k.keyType === 'publishable'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {k.keyType}
                        </span>
                        {k.isRevoked && (
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold bg-red-50 text-red-700">
                            Revoked
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-[#7A7267]">{k.displayKey}</code>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-[#7A7267]">
                      <div>
                        <span>Last used: </span>
                        <span className="font-mono text-[#191816]">
                          {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                        </span>
                      </div>
                      {!k.isRevoked && (
                        <button
                          onClick={() => handleRevokeKey(k.id)}
                          className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 font-medium"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Revoke</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* New Key Modal */}
          {newKeyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-xl border border-[#E8E2DA] max-w-md w-full p-6 space-y-4 shadow-xl">
                {revealedKey ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <div className="text-xs">
                        <p className="font-bold">Copy your key immediately</p>
                        <p className="mt-0.5">For your security, we will never display this full key again.</p>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-mono uppercase tracking-wider text-[#7A7267] block mb-1">
                        Generated Key
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={revealedKey}
                          className="w-full font-mono text-xs p-2.5 bg-[#FAF8F5] border border-[#E8E2DA] rounded select-all"
                        />
                        <button
                          onClick={() => copyToClipboard(revealedKey, 'revealed')}
                          className="px-3 py-2.5 bg-[#191816] text-white text-xs font-semibold rounded hover:bg-[#2C2A26] flex items-center gap-1"
                        >
                          {copiedKey === 'revealed' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedKey === 'revealed' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setNewKeyModal(false);
                        setRevealedKey(null);
                      }}
                      className="w-full py-2 bg-[#FAF8F5] hover:bg-[#E8E2DA] text-[#191816] text-xs font-semibold rounded transition"
                    >
                      I Have Securely Saved This Key
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleCreateKey} className="space-y-4">
                    <div>
                      <h4 className="text-base font-serif text-[#191816]">Create API Key</h4>
                      <p className="text-xs text-[#7A7267] mt-0.5">Select the key purpose and assign a descriptive identifier.</p>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-[#191816] block mb-1">Key Name *</label>
                      <Input
                        placeholder="e.g. Next.js Website Production"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-[#191816] block mb-2">Key Type *</label>
                      <div className="grid grid-cols-2 gap-3">
                        <label
                          onClick={() => setNewKeyType('publishable')}
                          className={`p-3 rounded-lg border cursor-pointer transition ${
                            newKeyType === 'publishable' ? 'border-[#B85C3E] bg-[#FAF8F5]' : 'border-[#E8E2DA] bg-white'
                          }`}
                        >
                          <div className="text-xs font-bold text-[#191816]">Publishable (`pk_live_`)</div>
                          <p className="text-[11px] text-[#7A7267] mt-1">Safe for client-side embedding, widgets, and public reads.</p>
                        </label>

                        <label
                          onClick={() => setNewKeyType('secret')}
                          className={`p-3 rounded-lg border cursor-pointer transition ${
                            newKeyType === 'secret' ? 'border-[#B85C3E] bg-[#FAF8F5]' : 'border-[#E8E2DA] bg-white'
                          }`}
                        >
                          <div className="text-xs font-bold text-[#191816]">Secret (`sk_live_`)</div>
                          <p className="text-[11px] text-[#7A7267] mt-1">Server-side operations, booking creation, and cancellations.</p>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={() => setNewKeyModal(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Generate Key</Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WEBHOOKS PLATFORM */}
      {activeTab === 'webhooks' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-serif text-[#191816]">Webhooks Platform</h3>
              <p className="text-xs text-[#7A7267] mt-0.5">
                Receive instant HTTP notifications signed with HMAC SHA-256 when reservations are created or confirmed.
              </p>
            </div>
            <Button onClick={() => setNewWebhookModal(true)} className="flex items-center gap-1 text-xs">
              <Plus className="w-3.5 h-3.5" />
              <span>Add Endpoint</span>
            </Button>
          </div>

          {/* Endpoints List */}
          <div className="bg-white border border-[#E8E2DA] rounded-lg overflow-hidden">
            <div className="p-4 border-b border-[#E8E2DA] flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider font-semibold text-[#191816]">
                Subscribed Endpoints ({webhooks.length})
              </span>
              <button onClick={loadWebhooks} className="text-xs text-[#7A7267] hover:text-[#191816] flex items-center gap-1">
                <RefreshCw className={`w-3 h-3 ${loadingWebhooks ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {webhooks.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#7A7267]">
                No webhook endpoints registered. Add your server webhook URL to listen for reservation lifecycle events.
              </div>
            ) : (
              <div className="divide-y divide-[#E8E2DA]">
                {webhooks.map((wh) => (
                  <div key={wh.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono font-semibold text-[#191816]">{wh.url}</code>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold bg-emerald-50 text-emerald-700">
                          Active
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#7A7267]">
                        <span>Signing Secret: </span>
                        <code className="font-mono text-[11px] bg-[#FAF8F5] px-1.5 py-0.5 rounded border border-[#E8E2DA]">
                          {wh.signingSecret}
                        </code>
                        <button
                          onClick={() => copyToClipboard(wh.signingSecret, `wh-${wh.id}`)}
                          className="text-[#B85C3E] hover:underline text-[11px]"
                        >
                          {copiedKey === `wh-${wh.id}` ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        {wh.events.map((evt) => (
                          <span key={evt} className="text-[10px] font-mono bg-[#FAF8F5] text-[#7A7267] px-1.5 py-0.5 rounded border border-[#E8E2DA]">
                            {evt}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeleteWebhook(wh.id)}
                        className="text-xs text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50 transition"
                        title="Remove endpoint"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Deliveries Log */}
          <div className="bg-white border border-[#E8E2DA] rounded-lg overflow-hidden">
            <div className="p-4 border-b border-[#E8E2DA]">
              <span className="text-xs font-mono uppercase tracking-wider font-semibold text-[#191816]">
                Recent Webhook Deliveries ({deliveries.length})
              </span>
            </div>
            {deliveries.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#7A7267]">
                No delivery attempts recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-[#E8E2DA]">
                {deliveries.map((del) => (
                  <div key={del.id} className="p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          del.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {del.httpStatus || (del.status === 'success' ? '200 OK' : 'Failed')}
                      </span>
                      <code className="font-mono text-[#191816] font-semibold">{del.eventType}</code>
                      <span className="text-[#7A7267] font-mono text-[11px]">{del.eventId}</span>
                    </div>
                    <span className="text-[#7A7267] font-mono text-[11px]">
                      {new Date(del.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Webhook Modal */}
          {newWebhookModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <form onSubmit={handleCreateWebhook} className="bg-white rounded-xl border border-[#E8E2DA] max-w-md w-full p-6 space-y-4 shadow-xl">
                <div>
                  <h4 className="text-base font-serif text-[#191816]">Add Webhook Endpoint</h4>
                  <p className="text-xs text-[#7A7267] mt-0.5">Provide a public HTTPS destination URL to receive event payloads.</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-[#191816] block mb-1">Destination URL *</label>
                  <Input
                    placeholder="https://example.com/api/webhooks/sena"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-[#191816] block mb-1">Description (Optional)</label>
                  <Input
                    placeholder="e.g. Production Next.js webhook listener"
                    value={webhookDesc}
                    onChange={(e) => setWebhookDesc(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setNewWebhookModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Endpoint</Button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DEVELOPER QUICKSTART & REST DOCS */}
      {activeTab === 'quickstart' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E8E2DA] rounded-lg p-5 space-y-4">
            <h3 className="text-base font-serif text-[#191816]">Next.js App Router Integration</h3>
            <p className="text-xs text-[#7A7267] leading-relaxed">
              If your hotel website is built with Next.js, connect securely in your Route Handler using your secret key (`sk_live_...`):
            </p>
            <pre className="p-4 bg-[#191816] text-[#FAF8F5] rounded-lg text-xs font-mono overflow-x-auto leading-relaxed">
              {`// app/api/reservations/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();

  const response = await fetch('https://app.sena.ng/api/v1/reservations', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${process.env.SENA_SECRET_KEY}\`,
      'Content-Type': 'application/json',
      'Idempotency-Key': \`res_\${Date.now()}_\${Math.random().toString(36).substring(7)}\`,
    },
    body: JSON.stringify({
      property_id: '${propertyId}',
      room_type_id: body.room_type_id,
      check_in: body.check_in,
      check_out: body.check_out,
      num_guests: body.num_guests || 1,
      guest: {
        name: body.guest.name,
        email: body.guest.email,
        phone: body.guest.phone,
      },
    }),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}`}
            </pre>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-[#E8E2DA] rounded-lg p-5 space-y-3">
              <span className="text-xs font-mono uppercase tracking-wider font-semibold text-[#191816]">
                Check Live Availability (cURL)
              </span>
              <pre className="p-3 bg-[#191816] text-[#FAF8F5] rounded text-xs font-mono overflow-x-auto">
{`curl -X GET "https://app.sena.ng/api/v1/properties/${propertyId}/availability?check_in=2026-10-01&check_out=2026-10-05" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
              </pre>
            </div>

            <div className="bg-white border border-[#E8E2DA] rounded-lg p-5 space-y-3">
              <span className="text-xs font-mono uppercase tracking-wider font-semibold text-[#191816]">
                Create 10-Minute Hold (cURL)
              </span>
              <pre className="p-3 bg-[#191816] text-[#FAF8F5] rounded text-xs font-mono overflow-x-auto">
{`curl -X POST "https://app.sena.ng/api/v1/holds" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "property_id": "${propertyId}",
    "room_type_id": "YOUR_ROOM_TYPE_ID",
    "check_in": "2026-10-01",
    "check_out": "2026-10-05",
    "guest": { "name": "Guest Name", "email": "guest@hotel.com" }
  }'`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: LIVE REQUEST LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-serif text-[#191816]">Real-time API Traffic</h3>
              <p className="text-xs text-[#7A7267] mt-0.5">
                Inspect incoming API and widget requests, response latencies, and HTTP status codes.
              </p>
            </div>
            <button
              onClick={loadLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#E8E2DA] text-xs font-medium text-[#191816] hover:bg-[#FAF8F5] transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              <span>Refresh Logs</span>
            </button>
          </div>

          <div className="bg-white border border-[#E8E2DA] rounded-lg overflow-hidden">
            <div className="p-4 border-b border-[#E8E2DA]">
              <span className="text-xs font-mono uppercase tracking-wider font-semibold text-[#191816]">
                Recent Requests ({logs.length})
              </span>
            </div>

            {logs.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#7A7267]">
                No API requests logged yet for this property. Send a request or test the booking widget to view live telemetry.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] text-[#7A7267] font-mono uppercase text-[10px] border-b border-[#E8E2DA]">
                    <tr>
                      <th className="p-3">Status</th>
                      <th className="p-3">Method</th>
                      <th className="p-3">Endpoint</th>
                      <th className="p-3">Latency</th>
                      <th className="p-3">Key / Origin</th>
                      <th className="p-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E2DA] font-mono">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#FAF8F5]/50">
                        <td className="p-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              log.statusCode < 300
                                ? 'bg-emerald-50 text-emerald-700'
                                : log.statusCode < 400
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {log.statusCode}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-[#191816]">{log.method}</td>
                        <td className="p-3 text-[#191816]">{log.endpoint}</td>
                        <td className="p-3 text-[#7A7267]">{log.latencyMs}ms</td>
                        <td className="p-3 text-[#7A7267] truncate max-w-[140px]">{log.keyName || 'Direct'}</td>
                        <td className="p-3 text-[#7A7267]">{new Date(log.createdAt).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
