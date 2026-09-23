(() => {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.querySelector('.header');
  const progress = document.createElement('div');
  progress.className = 'reading-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.append(progress);
  const dashboard = document.querySelector('.dashboard');
  let ticking = false;
  function updateScroll() {
    ticking = false;
    const range = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${range > 0 ? Math.min(1, scrollY / range) : 0})`;
    header?.classList.toggle('is-scrolled', scrollY > 32);
    if (dashboard) {
      const rect = dashboard.parentElement.getBoundingClientRect();
      const amount = Math.max(0, Math.min(1, (innerHeight - rect.top) / (innerHeight * .8)));
      dashboard.style.transform = preference.matches || innerWidth < 701 ? '' : `scale(${.97 + amount * .03})`;
    }
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(updateScroll); } }, { passive: true });
  addEventListener('resize', updateScroll, { passive: true });
  updateScroll();

  // Content is visible by default. Only enhance offscreen elements after JS is ready.
  const targets = [...document.querySelectorAll('.statement .container, .section-heading, .feature-copy, .product-stage, .calendar, .hospitality-photo>div, .website-stage, .four-features>div, .payment-visual, .housekeeping-stage, .analytics-metrics>div, .chart, .integrations-grid>div, .portfolio-card, .future-note, .plan, .faq-layout>div, .final-cta .container, .editorial-grid>div, .story-signoff .container')];
  const activeAnimations = new Set();
  function animate(element, frames, options = {}) {
    if (!element || preference.matches || !element.animate) return;
    const animation = element.animate(frames, { duration: 600, easing: 'cubic-bezier(.2,.65,.25,1)', ...options });
    activeAnimations.add(animation);
    animation.finished.then(() => activeAnimations.delete(animation)).catch(() => activeAnimations.delete(animation));
  }
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.remove('reveal-wait');
      if (!preference.matches) {
        animate(el, [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'translateY(0)' }]);
        if (el.matches('.calendar')) el.querySelectorAll('.reservation').forEach((bar, i) => animate(bar, [{ opacity: 0, transform: 'translateX(-8px)' }, { opacity: 1, transform: 'translateX(0)' }], { delay: i * 90, fill: 'backwards', duration: 500 }));
        if (el.matches('.chart')) {
          const path = el.querySelector('path');
          if (path) { const length = path.getTotalLength(); animate(path, [{ strokeDasharray: `${length}`, strokeDashoffset: length }, { strokeDasharray: `${length}`, strokeDashoffset: 0 }], { duration: 1400 }); }
        }
      }
      observer.unobserve(el);
    });
  }, { threshold: .08 }) : null;
  if (observer && !preference.matches) targets.forEach(el => {
    if (el.getBoundingClientRect().top > innerHeight + 30) { el.classList.add('reveal-wait'); observer.observe(el); }
  });
  preference.addEventListener('change', () => {
    if (preference.matches) {
      activeAnimations.forEach(a => a.finish());
      document.querySelectorAll('.reveal-wait').forEach(el => el.classList.remove('reveal-wait'));
      observer?.disconnect();
    }
    updateScroll();
  });
  // Animate real changes, without auto-playing or interrupting a guest's input.
  const booking = document.querySelector('#booking-card');
  if (booking) new MutationObserver(() => {
    animate(booking, [{ opacity: .35, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 350 });
    const heading = booking.querySelector('h3');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }).observe(booking, { childList: true });
  const rooms = document.querySelector('#room-grid');
  if (rooms) new MutationObserver(() => rooms.querySelectorAll('.room-tile').forEach((el, i) => animate(el, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 280, delay: i * 35, fill: 'backwards' }))).observe(rooms, { childList: true });
  document.querySelectorAll('[data-billing]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.plan-price').forEach(el => animate(el, [{ opacity: .25, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 300 }));
  }));
  document.querySelectorAll('[data-checkin], [data-clean]').forEach(button => button.addEventListener('click', () => {
    animate(button.closest('.checkin-row, .cleaning-card'), [{ backgroundColor: '#e5d4bc' }, { backgroundColor: 'transparent' }], { duration: 850 });
  }));
  document.querySelectorAll('.faq-list details').forEach(detail => detail.addEventListener('toggle', () => {
    if (detail.open) animate(detail.querySelector('p'), [{ opacity: 0, transform: 'translateY(-5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 300 });
  }));
  // A focused section in the legal index remains apparent while reading.
  const sections = document.querySelectorAll('.legal-copy>section');
  if (sections.length && 'IntersectionObserver' in window) {
    const index = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      document.querySelectorAll('.legal-toc nav a').forEach(link => {
        const current = link.hash === '#' + entry.target.id;
        link.classList.toggle('current', current);
        if (current) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
      });
    }), { rootMargin: '-15% 0px -60% 0px', threshold: 0 });
    sections.forEach(section => index.observe(section));
  }
})();
