'use client';

import * as React from 'react';
import {
  Download,
  Smartphone,
  Monitor,
  Share2,
  PlusSquare,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Laptop,
} from 'lucide-react';
import { Button } from '@sena/ui';
import { usePwa, type PwaPlatform } from './pwa-provider';

interface PwaInstallCardProps {
  className?: string;
}

export function PwaInstallCard({ className = '' }: PwaInstallCardProps) {
  const {
    isInstallable,
    isInstalled,
    platform: detectedPlatform,
    installApp,
    purgeAndLogout,
  } = usePwa();

  // Allow hotelier to view instructions for other devices if needed
  const [selectedPlatform, setSelectedPlatform] = React.useState<PwaPlatform>('other');

  React.useEffect(() => {
    if (detectedPlatform && detectedPlatform !== 'other') {
      setSelectedPlatform(detectedPlatform);
    } else {
      setSelectedPlatform('chromium');
    }
  }, [detectedPlatform]);

  const isCurrentDevice = selectedPlatform === detectedPlatform;

  return (
    <div
      id="sena-app-section"
      className={`bg-white border border-[#E8E2DA] rounded-lg p-4 sm:p-6 space-y-5 ${className}`}
    >
      {/* Header with permanent visibility */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#B85C3E]">
              Sena App
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-[#191816] mt-1">
            {isInstalled ? 'Sena is installed on this device' : 'Install Sena on your device'}
          </h3>
          <p className="text-xs text-[#7A7267] mt-1 max-w-xl leading-relaxed">
            {isInstalled
              ? 'Sena is actively running as a standalone operations app with live real-time synchronization.'
              : 'Get quicker access to your front desk, reservations, calendar and housekeeping by installing Sena on this device.'}
          </p>
        </div>

        {/* Status indicator */}
        <div className="flex-shrink-0 self-start">
          {isInstalled ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Installed</span>
            </span>
          ) : isInstallable ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#FAF0EC] text-[#71382D] border border-[#F2D6CD]">
              <Download className="w-3.5 h-3.5 text-[#B85C3E]" />
              <span>Ready to Install</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#F5EFE9] text-[#71382D] border border-[#E8E2DA]">
              <Monitor className="w-3.5 h-3.5 text-[#7A7267]" />
              <span>Web Operations</span>
            </span>
          )}
        </div>
      </div>

      {/* If already installed: do NOT show primary install button */}
      {isInstalled ? (
        <div className="bg-[#FAF8F5] border border-[#E8E2DA] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-[#7A7267]">
            <p className="font-semibold text-[#191816]">Operating in Standalone Mode</p>
            <p className="mt-0.5">
              Launch directly from your Home Screen, Dock, or Applications folder.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (confirm('Purge local application cache and reload fresh operational data?')) {
                purgeAndLogout();
              }
            }}
            className="flex items-center gap-1.5 text-xs text-[#71382D] border-[#E8E2DA] hover:bg-white self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Purge Local Cache</span>
          </Button>
        </div>
      ) : (
        /* Not installed: Render exact platform guidance & interactive CTAs */
        <div className="space-y-4">
          {/* Device Tabs for cross-device reference */}
          <div className="flex items-center gap-2 border-b border-[#E8E2DA] pb-2 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setSelectedPlatform('chromium')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                selectedPlatform === 'chromium'
                  ? 'bg-[#191816] text-white'
                  : 'text-[#7A7267] hover:text-[#191816] hover:bg-[#F5EFE9]'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Chrome / Windows / Android</span>
              {detectedPlatform === 'chromium' && (
                <span className="text-[10px] opacity-75">(This device)</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSelectedPlatform('ios')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                selectedPlatform === 'ios'
                  ? 'bg-[#191816] text-white'
                  : 'text-[#7A7267] hover:text-[#191816] hover:bg-[#F5EFE9]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>iPhone / iPad (Safari)</span>
              {detectedPlatform === 'ios' && (
                <span className="text-[10px] opacity-75">(This device)</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSelectedPlatform('mac-safari')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                selectedPlatform === 'mac-safari'
                  ? 'bg-[#191816] text-white'
                  : 'text-[#7A7267] hover:text-[#191816] hover:bg-[#F5EFE9]'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Mac Safari</span>
              {detectedPlatform === 'mac-safari' && (
                <span className="text-[10px] opacity-75">(This device)</span>
              )}
            </button>
          </div>

          {/* Tab 1: Chromium (Chrome, Edge, Android) */}
          {selectedPlatform === 'chromium' && (
            <div className="bg-[#FAF8F5] border border-[#E8E2DA] rounded-lg p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-semibold text-[#191816]">
                    One-Click App Installation
                  </h4>
                  <p className="text-xs text-[#7A7267] mt-0.5">
                    Installs Sena directly to your Windows Taskbar, Mac Applications, or Android Home Screen.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={installApp}
                  className="flex items-center gap-1.5 text-xs bg-[#191816] text-white hover:bg-[#2D2B28] self-start sm:self-auto cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install Sena</span>
                </Button>
              </div>

              {!isInstallable && (
                <div className="pt-2 border-t border-[#E8E2DA] text-xs text-[#7A7267]">
                  <p className="font-medium text-[#191816]">Manual address-bar install:</p>
                  <p className="mt-0.5">
                    If the prompt did not trigger automatically, click the <strong>Install</strong> icon (⊕ or computer with arrow) in your browser’s address bar, or open the menu (⋮) and select <strong>Install Sena</strong>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: iPhone / iPad (iOS Safari) */}
          {selectedPlatform === 'ios' && (
            <div className="bg-[#FAF8F5] border border-[#E8E2DA] rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-semibold text-[#191816]">
                Install Sena on iPhone or iPad
              </h4>
              <p className="text-xs text-[#7A7267]">
                iOS Safari requires adding Sena to your Home Screen manually:
              </p>

              <ol className="space-y-2 text-xs text-[#191816] pt-1">
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#191816] text-white flex items-center justify-center font-bold text-[10px]">
                    1
                  </span>
                  <div className="pt-0.5">
                    Tap the <strong>Share</strong> button in Safari <Share2 className="w-3.5 h-3.5 inline mx-1 text-[#B85C3E]" /> (square with upward arrow).
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#191816] text-white flex items-center justify-center font-bold text-[10px]">
                    2
                  </span>
                  <div className="pt-0.5">
                    Scroll down and choose <strong>Add to Home Screen</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-[#B85C3E]" />.
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#191816] text-white flex items-center justify-center font-bold text-[10px]">
                    3
                  </span>
                  <div className="pt-0.5">
                    Tap <strong>Add</strong> in the top-right corner.
                  </div>
                </li>
              </ol>
            </div>
          )}

          {/* Tab 3: Mac Safari */}
          {selectedPlatform === 'mac-safari' && (
            <div className="bg-[#FAF8F5] border border-[#E8E2DA] rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-semibold text-[#191816]">
                Install Sena on Mac (Safari)
              </h4>
              <p className="text-xs text-[#7A7267]">
                macOS Safari lets you turn Sena into a standalone Mac app:
              </p>

              <ol className="space-y-2 text-xs text-[#191816] pt-1">
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#191816] text-white flex items-center justify-center font-bold text-[10px]">
                    1
                  </span>
                  <div className="pt-0.5">
                    In Safari, click <strong>File</strong> in the top menu bar (or click the <strong>Share</strong> button).
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#191816] text-white flex items-center justify-center font-bold text-[10px]">
                    2
                  </span>
                  <div className="pt-0.5">
                    Choose <strong>Add to Dock…</strong>.
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#191816] text-white flex items-center justify-center font-bold text-[10px]">
                    3
                  </span>
                  <div className="pt-0.5">
                    Click <strong>Add</strong> to place the Sena app icon into your Mac Dock and Applications folder.
                  </div>
                </li>
              </ol>
            </div>
          )}

          {/* Notice if current browser doesn't support 1-click install */}
          {!isInstallable && detectedPlatform === 'other' && (
            <div className="p-3 bg-[#FFF9F5] border border-[#F2D6CD] rounded-lg text-xs text-[#71382D]">
              <p className="font-semibold">Your current browser doesn't support one-click installation.</p>
              <p className="mt-0.5">
                To install Sena as an app, we recommend opening <strong>https://app.sena.ng</strong> in Google Chrome, Microsoft Edge, or Apple Safari.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Operational Safety Guarantee & Diagnostic Controls */}
      <div className="border-t border-[#E8E2DA] pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#7A7267]">
        <div className="space-y-0.5">
          <span className="font-semibold text-[#191816]">Real-Time Operational Guarantee</span>
          <p>
            Room inventory, folios, and housekeeping are strictly synchronized with the live database to prevent double bookings.
          </p>
        </div>

        {!isInstalled && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (confirm('Purge local application cache and reload fresh operational data?')) {
                purgeAndLogout();
              }
            }}
            className="flex items-center gap-1.5 text-xs text-[#71382D] border-[#E8E2DA] hover:bg-[#FAF8F5] self-start sm:self-auto flex-shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Purge Cache</span>
          </Button>
        )}
      </div>
    </div>
  );
}
