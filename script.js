const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Theme toggle (remembered per browser when storage is available)
const THEME_KEY = 'sireus-theme';
try {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
} catch (e) { /* storage unavailable */ }

document.getElementById('theme-toggle').addEventListener('click', () => {
  const current = root.dataset.theme ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* storage unavailable */ }
});

// Mobile menu
const nav = document.getElementById('nav');
const navToggle = document.getElementById('nav-toggle');

const setMenu = open => {
  nav.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', open);
  navToggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
};
navToggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));

// Star chart: Canis Major, positions in right ascension (hours) and declination (degrees)
const sky = (() => {
  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d');

  const stars = {
    sirius:    { ra: 6.752, dec: -16.72, mag: -1.46, name: 'Сириус' },
    mirzam:    { ra: 6.378, dec: -17.96, mag: 1.98, name: 'Мирзам' },
    muliphein: { ra: 7.062, dec: -15.63, mag: 4.11 },
    iota:      { ra: 6.936, dec: -17.05, mag: 4.37 },
    theta:     { ra: 6.903, dec: -12.04, mag: 4.07 },
    omicron2:  { ra: 7.050, dec: -23.83, mag: 3.02 },
    wezen:     { ra: 7.140, dec: -26.39, mag: 1.83, name: 'Везен' },
    adhara:    { ra: 6.977, dec: -28.97, mag: 1.50, name: 'Адара' },
    aludra:    { ra: 7.402, dec: -29.30, mag: 2.45, name: 'Алудра' },
    sigma:     { ra: 7.028, dec: -27.93, mag: 3.47 },
    omicron1:  { ra: 6.902, dec: -24.18, mag: 3.87 },
  };
  const lines = [
    ['mirzam', 'sirius'], ['sirius', 'iota'], ['iota', 'muliphein'], ['muliphein', 'theta'],
    ['sirius', 'omicron2'], ['omicron2', 'wezen'], ['wezen', 'aludra'],
    ['wezen', 'sigma'], ['sigma', 'adhara'], ['omicron2', 'omicron1'],
  ];

  // Seeded background field so it looks the same on every load
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const field = Array.from({ length: 140 }, () => ({ x: rand(), y: rand(), r: rand() * 0.9 + 0.2, p: rand() * Math.PI * 2 }));

  const center = { ra: 6.89, dec: -20.6 };
  const spanDeg = 21;
  let colors = {};
  let size = 0;
  let dpr = 1;

  const readColors = () => {
    const cs = getComputedStyle(root);
    const get = n => cs.getPropertyValue(n).trim();
    colors = { ink: get('--ink'), muted: get('--muted'), line: get('--line'), accent: get('--accent'), glint: get('--glint') };
  };

  const project = s => {
    const cosDec = Math.cos(center.dec * Math.PI / 180);
    const x = -(s.ra - center.ra) * 15 * cosDec; // east is left on a sky chart
    const y = -(s.dec - center.dec);
    return { x: size / 2 + (x / spanDeg) * size, y: size * 0.46 + (y / spanDeg) * size };
  };

  const radiusFor = mag => Math.max(1.2, (4.6 - mag) * 1.25) * (size / 520);

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = rect.width;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const draw = t => {
    const s = size;
    ctx.clearRect(0, 0, s, s);

    // Coordinate grid: declination every 5°, right ascension every 15 minutes
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.font = `${Math.max(9, s / 52)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = colors.muted;
    for (let dec = -35; dec <= -5; dec += 5) {
      const { y } = project({ ra: center.ra, dec });
      if (y < 0 || y > s * 0.86) continue;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
      ctx.fillText(`${dec}°`, 8, y - 4);
    }
    for (let ra = 6.25; ra <= 7.75; ra += 0.25) {
      const { x } = project({ ra, dec: center.dec });
      if (x < 0 || x > s) continue;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s * 0.86); ctx.stroke();
      const h = Math.floor(ra), m = Math.round((ra - h) * 60);
      ctx.fillText(`${h}ʰ${String(m).padStart(2, '0')}ᵐ`, x + 4, 14);
    }
    ctx.setLineDash([]);

    // Faint field stars
    ctx.fillStyle = colors.muted;
    field.forEach(f => {
      const tw = reduceMotion.matches ? 0.5 : 0.35 + 0.35 * Math.sin(t / 900 + f.p);
      ctx.globalAlpha = tw;
      ctx.beginPath(); ctx.arc(f.x * s, f.y * s * 0.86, f.r * (s / 520), 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Constellation lines
    ctx.strokeStyle = colors.accent;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.2;
    lines.forEach(([a, b]) => {
      const p = project(stars[a]), q = project(stars[b]);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // Named stars
    Object.entries(stars).forEach(([key, star]) => {
      const p = project(star);
      const r = radiusFor(star.mag);
      if (key === 'sirius') return;
      ctx.fillStyle = colors.ink;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      if (star.name) {
        ctx.fillStyle = colors.muted;
        ctx.fillText(star.name, p.x + r + 6, p.y + 4);
      }
    });

    // Sirius: the glint
    const p = project(stars.sirius);
    const pulse = reduceMotion.matches ? 1 : 1 + 0.08 * Math.sin(t / 600);
    const R = radiusFor(stars.sirius.mag) * pulse;
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R * 5);
    glow.addColorStop(0, colors.glint);
    glow.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(p.x, p.y, R * 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = colors.glint;
    const spike = R * 3.4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - spike);
    ctx.lineTo(p.x + R * 0.35, p.y - R * 0.35);
    ctx.lineTo(p.x + spike, p.y);
    ctx.lineTo(p.x + R * 0.35, p.y + R * 0.35);
    ctx.lineTo(p.x, p.y + spike);
    ctx.lineTo(p.x - R * 0.35, p.y + R * 0.35);
    ctx.lineTo(p.x - spike, p.y);
    ctx.lineTo(p.x - R * 0.35, p.y - R * 0.35);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x, p.y, R * 0.8, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = colors.ink;
    ctx.font = `600 ${Math.max(11, s / 38)}px "Onest", sans-serif`;
    ctx.fillText('Сириус', p.x + spike + 6, p.y - 6);
    ctx.font = `${Math.max(9, s / 52)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = colors.muted;
    ctx.fillText('α CMa', p.x + spike + 6, p.y + 10);
  };

  let frame;
  const loop = t => {
    draw(t);
    if (!reduceMotion.matches) frame = requestAnimationFrame(loop);
  };

  const refresh = () => {
    cancelAnimationFrame(frame);
    readColors();
    resize();
    loop(performance.now());
  };

  new ResizeObserver(refresh).observe(canvas);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refresh);
  new MutationObserver(refresh).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  reduceMotion.addEventListener('change', refresh);
  if (document.fonts) document.fonts.ready.then(refresh);
  refresh();

  return { refresh };
})();

// Copy email
const copyBtn = document.getElementById('copy-email');
const emailEl = document.getElementById('email');
copyBtn.addEventListener('click', () => {
  const done = () => {
    copyBtn.textContent = 'Скопировано';
    setTimeout(() => { copyBtn.textContent = 'Скопировать'; }, 1800);
  };
  const selectText = () => {
    const range = document.createRange();
    range.selectNodeContents(emailEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    copyBtn.textContent = 'Выделено — нажмите Ctrl+C';
  };
  try {
    navigator.clipboard.writeText(emailEl.textContent).then(done, selectText);
  } catch (e) {
    selectText();
  }
});

// Contact form (client-side only: no server is connected yet)
const form = document.getElementById('contact-form');
const status = document.getElementById('form-status');

form.addEventListener('submit', e => {
  e.preventDefault();
  let valid = true;

  form.querySelectorAll('input[required], textarea[required]').forEach(field => {
    const ok = field.value.trim() !== '' && field.checkValidity();
    field.classList.toggle('invalid', !ok);
    if (!ok) valid = false;
  });

  if (!valid) {
    status.textContent = 'Заполните имя, корректный email и пару слов о задаче.';
    status.className = 'form__status err';
    return;
  }

  status.textContent = 'Спасибо! Форма пока работает в демо-режиме: продублируйте, пожалуйста, письмо на почту выше.';
  status.className = 'form__status ok';
  form.reset();
});

form.addEventListener('input', e => e.target.classList.remove('invalid'));

document.getElementById('year').textContent = new Date().getFullYear();
