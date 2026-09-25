/**
 * Sena Connect Universal Booking Widget & Button Script
 * Version: 1.0.0
 * https://sena.ng
 */
(function (window, document) {
  'use strict';

  if (window.Sena && window.Sena.initialized) return;

  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';
  var BASE_URL = (function () {
    try {
      if (SCRIPT_SRC) {
        var url = new URL(SCRIPT_SRC);
        return url.origin;
      }
    } catch (e) {}
    return 'https://app.sena.ng';
  })();

  var overlayEl = null;
  var iframeEl = null;

  function createModal() {
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'sena-booking-overlay';
    overlayEl.setAttribute('role', 'dialog');
    overlayEl.setAttribute('aria-modal', 'true');
    overlayEl.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'width: 100vw',
      'height: 100vh',
      'background: rgba(15, 23, 42, 0.65)',
      'backdrop-filter: blur(8px)',
      '-webkit-backdrop-filter: blur(8px)',
      'z-index: 999999',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'opacity: 0',
      'pointer-events: none',
      'transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      'box-sizing: border-box',
      'padding: 16px',
    ].join(';');

    var container = document.createElement('div');
    container.id = 'sena-modal-container';
    container.style.cssText = [
      'position: relative',
      'width: 100%',
      'max-width: 680px',
      'height: 90vh',
      'max-height: 840px',
      'background: #ffffff',
      'border-radius: 16px',
      'overflow: hidden',
      'box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      'transform: translateY(20px) scale(0.98)',
      'transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      'display: flex',
      'flex-direction: column',
    ].join(';');

    var closeBtn = document.createElement('button');
    closeBtn.setAttribute('aria-label', 'Close booking modal');
    closeBtn.innerHTML = '&#x2715;';
    closeBtn.style.cssText = [
      'position: absolute',
      'top: 14px',
      'right: 14px',
      'width: 34px',
      'height: 34px',
      'border-radius: 50%',
      'background: rgba(241, 245, 249, 0.9)',
      'color: #0f172a',
      'border: none',
      'cursor: pointer',
      'font-size: 16px',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'z-index: 10',
      'transition: background 0.15s ease',
    ].join(';');
    closeBtn.onmouseover = function () { closeBtn.style.background = '#e2e8f0'; };
    closeBtn.onmouseout = function () { closeBtn.style.background = 'rgba(241, 245, 249, 0.9)'; };
    closeBtn.onclick = closeModal;

    iframeEl = document.createElement('iframe');
    iframeEl.id = 'sena-booking-iframe';
    iframeEl.title = 'Sena Direct Hotel Booking';
    iframeEl.style.cssText = 'width: 100%; height: 100%; border: none; flex: 1;';

    container.appendChild(closeBtn);
    container.appendChild(iframeEl);
    overlayEl.appendChild(container);
    document.body.appendChild(overlayEl);

    // Backdrop click dismiss
    overlayEl.addEventListener('click', function (e) {
      if (e.target === overlayEl) closeModal();
    });

    // Escape key listener
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlayEl && overlayEl.style.opacity === '1') {
        closeModal();
      }
    });

    // Message listener from iframe
    window.addEventListener('message', function (event) {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.action === 'sena:close') {
        closeModal();
      } else if (event.data.action === 'sena:confirmed') {
        var detail = event.data.payload || {};
        var customEvt = new CustomEvent('sena:booking_confirmed', { detail: detail });
        window.dispatchEvent(customEvt);
        if (typeof window.Sena.onBookingComplete === 'function') {
          window.Sena.onBookingComplete(detail);
        }
      }
    });
  }

  function openModal(options) {
    createModal();
    options = options || {};
    var propertyId = options.propertyId || options.property || '';
    if (!propertyId) {
      console.error('[Sena] Cannot open booking: Missing property ID.');
      return;
    }

    var params = new URLSearchParams();
    params.set('property', propertyId);
    if (options.checkIn) params.set('check_in', options.checkIn);
    if (options.checkOut) params.set('check_out', options.checkOut);
    if (options.guests) params.set('guests', options.guests);
    if (options.roomTypeId) params.set('room_type', options.roomTypeId);
    if (options.theme) params.set('theme', options.theme);

    var targetUrl = BASE_URL + '/embed/booking?' + params.toString();
    if (iframeEl.src !== targetUrl) {
      iframeEl.src = targetUrl;
    }

    document.body.style.overflow = 'hidden';
    overlayEl.style.pointerEvents = 'auto';
    overlayEl.style.opacity = '1';
    var container = document.getElementById('sena-modal-container');
    if (container) {
      container.style.transform = 'translateY(0) scale(1)';
    }
  }

  function closeModal() {
    if (!overlayEl) return;
    document.body.style.overflow = '';
    overlayEl.style.opacity = '0';
    overlayEl.style.pointerEvents = 'none';
    var container = document.getElementById('sena-modal-container');
    if (container) {
      container.style.transform = 'translateY(20px) scale(0.98)';
    }
  }

  function bindButtons() {
    var triggers = document.querySelectorAll('[data-sena-booking], [data-sena-book]');
    triggers.forEach(function (btn) {
      if (btn._senaBound) return;
      btn._senaBound = true;
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var propId =
          btn.getAttribute('data-sena-booking') ||
          btn.getAttribute('data-sena-property') ||
          btn.getAttribute('data-property-id');

        // Look for companion input fields if in an external form
        var checkInInput = document.querySelector('[data-sena-input="checkin"], input[name="checkin"], input[name="check_in"]');
        var checkOutInput = document.querySelector('[data-sena-input="checkout"], input[name="checkout"], input[name="check_out"]');
        var guestsInput = document.querySelector('[data-sena-input="guests"], select[name="guests"], input[name="guests"]');

        openModal({
          propertyId: propId,
          checkIn: checkInInput ? checkInInput.value : undefined,
          checkOut: checkOutInput ? checkOutInput.value : undefined,
          guests: guestsInput ? guestsInput.value : undefined,
        });
      });
    });
  }

  function renderInlineWidgets() {
    var containers = document.querySelectorAll('#sena-booking-widget, [data-sena-widget]');
    containers.forEach(function (container) {
      if (container._senaRendered) return;
      container._senaRendered = true;

      var propId =
        container.getAttribute('data-property') ||
        container.getAttribute('data-property-id') ||
        '';

      var accentColor = container.getAttribute('data-primary-color') || '#0f172a';
      var today = new Date().toISOString().split('T')[0];
      var tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      container.innerHTML = [
        '<div style="display:flex; flex-wrap:wrap; align-items:center; gap:12px; background:#ffffff; padding:12px 16px; border:1px solid #e2e8f0; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.05); font-family:system-ui,-apple-system,sans-serif;">',
        '  <div style="flex:1; min-width:140px;">',
        '    <label style="display:block; font-size:11px; font-weight:700; text-transform:uppercase; color:#64748b; margin-bottom:4px; letter-spacing:0.05em;">Check-in</label>',
        '    <input type="date" class="sena-w-in" value="' + today + '" min="' + today + '" style="width:100%; border:1px solid #cbd5e1; border-radius:6px; padding:8px 10px; font-size:13px; color:#0f172a; outline:none; background:#f8fafc;" />',
        '  </div>',
        '  <div style="flex:1; min-width:140px;">',
        '    <label style="display:block; font-size:11px; font-weight:700; text-transform:uppercase; color:#64748b; margin-bottom:4px; letter-spacing:0.05em;">Check-out</label>',
        '    <input type="date" class="sena-w-out" value="' + tomorrow + '" min="' + tomorrow + '" style="width:100%; border:1px solid #cbd5e1; border-radius:6px; padding:8px 10px; font-size:13px; color:#0f172a; outline:none; background:#f8fafc;" />',
        '  </div>',
        '  <div style="flex:0 0 90px;">',
        '    <label style="display:block; font-size:11px; font-weight:700; text-transform:uppercase; color:#64748b; margin-bottom:4px; letter-spacing:0.05em;">Guests</label>',
        '    <select class="sena-w-guests" style="width:100%; border:1px solid #cbd5e1; border-radius:6px; padding:8px; font-size:13px; color:#0f172a; outline:none; background:#f8fafc;">',
        '      <option value="1">1 Guest</option>',
        '      <option value="2" selected>2 Guests</option>',
        '      <option value="3">3 Guests</option>',
        '      <option value="4">4 Guests</option>',
        '    </select>',
        '  </div>',
        '  <div style="flex:0 0 auto; align-self:flex-end;">',
        '    <button type="button" class="sena-w-submit" style="background:' + accentColor + '; color:#ffffff; font-weight:600; font-size:13px; border:none; border-radius:6px; padding:10px 20px; cursor:pointer; transition:opacity 0.2s; white-space:nowrap;">',
        '      Search Rooms',
        '    </button>',
        '  </div>',
        '</div>',
      ].join('');

      var btn = container.querySelector('.sena-w-submit');
      var inEl = container.querySelector('.sena-w-in');
      var outEl = container.querySelector('.sena-w-out');
      var guestEl = container.querySelector('.sena-w-guests');

      if (btn) {
        btn.addEventListener('click', function () {
          openModal({
            propertyId: propId,
            checkIn: inEl ? inEl.value : undefined,
            checkOut: outEl ? outEl.value : undefined,
            guests: guestEl ? guestEl.value : undefined,
          });
        });
      }
    });
  }

  function init() {
    bindButtons();
    renderInlineWidgets();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // MutationObserver for dynamically injected elements
  if (typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function () {
      bindButtons();
      renderInlineWidgets();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.Sena = {
    initialized: true,
    version: '1.0.0',
    openBooking: openModal,
    closeBooking: closeModal,
    init: init,
    onBookingComplete: null,
  };
})(window, document);
