/* Mitchell Gondwe — portfolio interactions */
(function () {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  try { localStorage.removeItem('mg-theme'); } catch (e) {}

  /* ---------- Nav: scrolled state, mobile menu, scroll spy ---------- */
  const nav = $('.nav');
  const links = $('#nav-links');
  const burger = $('#nav-burger');
  window.addEventListener('scroll', () => nav.classList.toggle('is-scrolled', window.scrollY > 10), { passive: true });
  burger.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });
  $$('.nav__link').forEach(a => a.addEventListener('click', () => {
    links.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
  }));

  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      $$('.nav__link').forEach(l => l.classList.toggle('is-active', l.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach(s => spy.observe(s));

  /* ---------- Reveal + counters + GPA chart ---------- */
  const animateCount = el => {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const suffix = el.dataset.suffix || '';
    if (reduceMotion) { el.textContent = target.toFixed(decimals) + suffix; return; }
    const start = performance.now(), dur = 1400;
    const tick = now => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const revealer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-visible');
      $$('[data-count]', e.target).forEach(animateCount);
      const gpa = $('#gpa-chart', e.target);
      if (gpa) gpa.classList.add('is-visible');
      revealer.unobserve(e.target);
    });
  }, { threshold: 0.15 });
  $$('.reveal').forEach((el, i) => {
    el.style.transitionDelay = (i % 3) * 80 + 'ms';
    revealer.observe(el);
  });

  /* ---------- Typed text ---------- */
  const phrases = [
    'Telecommunications & industrial IoT',
    'Embedded systems & instrumentation',
    'Industrial control & automation',
    'FFT → PCA → health index, on-device',
  ];
  const typed = $('#typed-text');
  if (reduceMotion) {
    typed.textContent = phrases[0];
  } else {
    let pi = 0, ci = 0, deleting = false;
    (function type() {
      const word = phrases[pi];
      typed.textContent = word.slice(0, ci);
      if (!deleting && ci < word.length) { ci++; setTimeout(type, 55); }
      else if (!deleting) { deleting = true; setTimeout(type, 1800); }
      else if (ci > 0) { ci--; setTimeout(type, 28); }
      else { deleting = false; pi = (pi + 1) % phrases.length; setTimeout(type, 300); }
    })();
  }

  /* ---------- Hero oscilloscope (simulated vibration + FFT) ---------- */
  const tCanvas = $('#scope-time');
  const fCanvas = $('#scope-fft');
  const tCtx = tCanvas.getContext('2d');
  const fCtx = fCanvas.getContext('2d');
  const hiFill = $('#hi-fill'), hiValue = $('#hi-value'), hiState = $('#hi-state');
  const N = 256;

  function sizeCanvas(c) {
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = parseInt(c.getAttribute('height'), 10);
    c.width = w * dpr; c.height = h * dpr; c.style.height = h + 'px';
    c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const resize = () => { sizeCanvas(tCanvas); sizeCanvas(fCanvas); };
  resize();
  window.addEventListener('resize', resize);

  // Naive DFT magnitude (N=256 is cheap enough) with Hann window
  function spectrum(x) {
    const half = N / 2, out = new Float32Array(half);
    for (let k = 0; k < half; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) {
        const w = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
        const a = (2 * Math.PI * k * n) / N;
        re += x[n] * w * Math.cos(a);
        im -= x[n] * w * Math.sin(a);
      }
      out[k] = Math.sqrt(re * re + im * im) / half;
    }
    return out;
  }

  const css = v => getComputedStyle(root).getPropertyValue(v).trim();
  let phase = 0, fault = 0, faultTarget = 0, lastHiUpdate = 0;
  setInterval(() => { faultTarget = faultTarget ? 0 : 1; }, 6000); // alternate healthy / degraded

  function draw(now) {
    fault += (faultTarget - fault) * 0.02;
    const x = new Float32Array(N);
    for (let n = 0; n < N; n++) {
      const t = (n + phase) / 1000;
      x[n] = 0.6 * Math.sin(2 * Math.PI * 25 * t)                  // 1x running speed
           + 0.25 * Math.sin(2 * Math.PI * 50 * t)                 // 2x harmonic
           + fault * 0.45 * Math.sin(2 * Math.PI * 162 * t)        // bearing-fault tone
           + fault * 0.2 * Math.sin(2 * Math.PI * 324 * t)
           + (Math.random() - 0.5) * (0.12 + fault * 0.25);
    }
    phase += 4;

    const accent = css('--accent'), amber = css('--amber');
    const lineColor = fault > 0.5 ? amber : accent;

    // time domain
    let w = tCanvas.clientWidth, h = 130;
    tCtx.clearRect(0, 0, w, h);
    tCtx.beginPath();
    for (let n = 0; n < N; n++) {
      const px = (n / (N - 1)) * w, py = h / 2 - x[n] * (h / 3.2);
      n ? tCtx.lineTo(px, py) : tCtx.moveTo(px, py);
    }
    tCtx.strokeStyle = lineColor; tCtx.lineWidth = 1.6;
    tCtx.shadowColor = lineColor; tCtx.shadowBlur = 8;
    tCtx.stroke(); tCtx.shadowBlur = 0;

    // frequency domain
    const spec = spectrum(x);
    w = fCanvas.clientWidth; h = 110;
    fCtx.clearRect(0, 0, w, h);
    const bw = w / spec.length;
    for (let k = 1; k < spec.length; k++) {
      const mag = Math.min(spec[k] * 2.4, 1);
      const bh = mag * (h - 8);
      fCtx.fillStyle = k * (1000 / N) > 120 && fault > 0.3 ? amber : accent;
      fCtx.globalAlpha = 0.35 + mag * 0.65;
      fCtx.fillRect(k * bw, h - bh, Math.max(bw - 1, 1), bh);
    }
    fCtx.globalAlpha = 1;

    // health index readout (throttled)
    if (now - lastHiUpdate > 400) {
      lastHiUpdate = now;
      const hi = Math.max(0.05, 0.95 - fault * 0.6 + (Math.random() - 0.5) * 0.03);
      hiFill.style.width = (hi * 100).toFixed(0) + '%';
      hiValue.textContent = hi.toFixed(2);
      const warn = hi < 0.6;
      hiState.textContent = warn ? 'DEGRADED' : 'HEALTHY';
      hiState.classList.toggle('is-warn', warn);
      hiFill.style.background = warn
        ? `linear-gradient(90deg, ${amber}, ${css('--rose')})`
        : `linear-gradient(90deg, ${css('--green')}, ${accent})`;
    }
    if (!reduceMotion) requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  /* ---------- Project filters ---------- */
  $$('.filter').forEach(btn => btn.addEventListener('click', () => {
    $$('.filter').forEach(b => b.classList.toggle('is-active', b === btn));
    const f = btn.dataset.filter;
    $$('.project').forEach(p => {
      p.classList.toggle('is-hidden', f !== 'all' && !p.dataset.cat.split(' ').includes(f));
    });
  }));

  /* ---------- Modals ---------- */
  $$('[data-modal]').forEach(btn => btn.addEventListener('click', () => $('#' + btn.dataset.modal).showModal()));
  $$('.modal').forEach(m => {
    $('.modal__close', m).addEventListener('click', () => m.close());
    m.addEventListener('click', e => { if (e.target === m) m.close(); }); // click backdrop
  });

  /* ---------- Toast + copy ---------- */
  const toast = $('#toast');
  let toastTimer;
  const showToast = msg => {
    toast.textContent = msg;
    toast.classList.add('is-shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-shown'), 2200);
  };
  $$('.copy-btn').forEach(btn => btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      showToast('Copied ' + btn.dataset.copy);
    } catch (e) {
      showToast('Copy failed. Please select the text manually.');
    }
  }));

  /* ---------- Print CV ---------- */
  $('#hero-print-btn').addEventListener('click', () => window.print());

  /* ---------- Contact form → mailto ---------- */
  $('#contact-form').addEventListener('submit', e => {
    e.preventDefault();
    const form = e.currentTarget;
    const fields = ['cf-name', 'cf-email', 'cf-message'].map(id => $('#' + id, form));
    let ok = true;
    fields.forEach(f => {
      const valid = f.value.trim() !== '' && (f.type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value));
      f.classList.toggle('is-invalid', !valid);
      if (!valid) ok = false;
    });
    if (!ok) { showToast('Please fill in all fields correctly.'); return; }
    const [name, email, msg] = fields.map(f => f.value.trim());
    const subject = encodeURIComponent('Website enquiry from ' + name);
    const body = encodeURIComponent(msg + '\n\n— ' + name + ' (' + email + ')');
    window.location.href = `mailto:mitchellgondwe7@gmail.com?subject=${subject}&body=${body}`;
    showToast('Opening your email app…');
  });

  /* ---------- Footer year ---------- */
  $('#year').textContent = new Date().getFullYear();
})();
