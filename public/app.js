/* Baron Türkiye — istemci */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const after = (ms, fn) => (ms > 0 ? setTimeout(fn, ms) : fn());
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DICE_MS = REDUCED ? 0 : 1050;
  const STEP_MS = 210;
  const PREVIEW_MS = REDUCED ? 0 : 750;   // zar sonrası hedef kare önizlemesi
  const sfx = (n) => { if (window.BaronAudio) window.BaronAudio.sfx(n); };
  const COLORS = ['#e63946', '#1d7cf2', '#2a9d8f', '#f4a261', '#9b5de5', '#ff4fa3'];
  const GROUP_ORDER = ['kahve', 'acikmavi', 'pembe', 'turuncu', 'kirmizi', 'sari', 'yesil', 'lacivert'];

  // ---------- para biçimi: çizgili B ----------
  const CUR = '<span class="cur">B</span>';
  const num = (n) => Math.abs(Math.round(n)).toLocaleString('tr-TR');
  const money = (n) => `<span class="mny">${n < 0 ? '−' : ''}${CUR}${num(n)}</span>`;
  const fmtText = (s) => esc(s).replace(/B(?=\d)/g, CUR);
  const moneyShort = (n) => `${CUR}${n >= 1e6 ? `${(n / 1e6).toLocaleString('tr-TR')}M` : `${Math.round(n / 1000)}K`}`;

  // ---------- çizimler (emoji yerine SVG) ----------
  const svg = (inner, vb = '0 0 24 24') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
  const TOKENS = {
    araba: svg('<path fill="currentColor" d="M3.2 13.2 5 8.6C5.4 7.6 6.3 7 7.4 7h9.2c1.1 0 2 .6 2.4 1.6l1.8 4.6c.9.3 1.7 1.2 1.7 2.3V18h-2.2a2.6 2.6 0 0 1-5.1 0H8.8a2.6 2.6 0 0 1-5.1 0H1.5v-2.5c0-1.1.7-2 1.7-2.3Zm3-.5h11.6l-1.3-3.4a.9.9 0 0 0-.9-.6H8.4a.9.9 0 0 0-.9.6Z"/><circle cx="6.2" cy="18" r="1.6" fill="#fff"/><circle cx="17.8" cy="18" r="1.6" fill="#fff"/>'),
    sapka: svg('<path fill="currentColor" d="M7 3.5h10l-.6 10.5H7.6Z"/><path fill="#d7263d" d="M7.4 10.5h9.2l-.15 2.2H7.55Z"/><path fill="currentColor" d="M2 16c0-1.4 2.7-2.3 10-2.3s10 .9 10 2.3-3.3 3-10 3S2 17.4 2 16Z"/>'),
    gemi: svg('<path fill="currentColor" d="M3 14.5h18l-3 5H6Z"/><path fill="currentColor" d="M11.2 3v10.4H5.5Zm1.6 2.2 5.4 8.2h-5.4Z"/><path fill="#1d5fd0" d="M1.5 21c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1v1.6c-2 0-2 .9-4 .9s-2-.9-4-.9-2 .9-4 .9-2-.9-4-.9-2 .9-4 .9Z"/>'),
    cay: svg('<path fill="currentColor" d="M7.5 2.5h9c0 3.2-1.8 5.2-1.8 8.3 0 2.6 1.8 3.8 1.8 6 0 1.4-2 2.4-4.5 2.4s-4.5-1-4.5-2.4c0-2.2 1.8-3.4 1.8-6 0-3.1-1.8-5.1-1.8-8.3Z"/><path fill="#c0392b" d="M8.6 9.5h6.8c-.4 1-.7 2.1-.7 3.3 0 1.9 1.4 3 1.6 4.2-.8.8-2.4 1.2-4.3 1.2s-3.5-.4-4.3-1.2c.2-1.2 1.6-2.3 1.6-4.2 0-1.2-.3-2.3-.7-3.3Z" opacity=".9"/><ellipse fill="currentColor" cx="12" cy="21.3" rx="8" ry="1.6"/>'),
    nazar: svg('<circle cx="12" cy="12" r="10.5" fill="#1747b8"/><circle cx="12" cy="12" r="7.2" fill="#fff"/><circle cx="12" cy="12" r="5" fill="#5fa8ff"/><circle cx="12" cy="12" r="2.6" fill="#0b0f1a"/>'),
    ucak: svg('<path fill="currentColor" d="M21.5 15.5v-2l-8-5V3.6a1.5 1.5 0 0 0-3 0v4.9l-8 5v2l8-2.5v5l-2 1.5V21l3.5-1 3.5 1v-1.5l-2-1.5v-5Z"/>'),
    tac: svg('<path fill="currentColor" d="m2.5 7.5 5 4.2L12 4l4.5 7.7 5-4.2-2 11H4.5Z"/><path fill="currentColor" d="M4.5 19.5h15V22h-15Z"/><circle cx="12" cy="14.5" r="1.5" fill="#d7263d"/>'),
    roket: svg('<path fill="currentColor" d="M12 1.5c3.2 2.2 4.8 5.8 4.8 10l2.2 3.2v3.8l-3.3-1.6H8.3L5 18.5v-3.8l2.2-3.2c0-4.2 1.6-7.8 4.8-10Z"/><circle cx="12" cy="9.5" r="1.9" fill="#fff"/><path fill="#f2b632" d="M9.8 17.6h4.4L12 22.5Z"/>'),
  };
  const ICON = {
    train: svg('<path fill="currentColor" fill-rule="evenodd" d="M7 2.5h10a3.5 3.5 0 0 1 3.5 3.5v9a3.5 3.5 0 0 1-3 3.46l2 3.04h-2.3l-1.9-3H8.7l-1.9 3H4.5l2-3.04a3.5 3.5 0 0 1-3-3.46V6A3.5 3.5 0 0 1 7 2.5ZM6 6.2v4.3h12V6.2Zm1.8 7.3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8.4 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/>'),
    ship: TOKENS.gemi, plane: TOKENS.ucak, car: TOKENS.araba, hat: TOKENS.sapka,
    bulb: svg('<path fill="currentColor" d="M12 1.8a7.2 7.2 0 0 0-4.2 13v2.4h8.4v-2.4A7.2 7.2 0 0 0 12 1.8Z"/><path fill="#5b4a1c" d="M8.3 18.2h7.4v1.6H8.3Zm1 2.4h5.4v1.6H9.3Z"/><path fill="#fff" opacity=".55" d="M9.3 5.6a4 4 0 0 1 3-1.4v1.6a2.4 2.4 0 0 0-1.8.8Z"/>'),
    drop: svg('<path fill="currentColor" d="M12 2s-7 8.1-7 13a7 7 0 0 0 14 0c0-4.9-7-13-7-13Z"/><path fill="#fff" opacity=".6" d="M8.7 14.5a3.4 3.4 0 0 0 2.6 4l-.3 1.4a4.8 4.8 0 0 1-3.7-5.6Z"/>'),
    chest: svg('<path fill="currentColor" d="M3 10.5h18V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path fill="currentColor" opacity=".8" d="M3 9.5C3 6.5 5 4.5 8 4.5h8c3 0 5 2 5 5Z"/><path fill="#f2b632" d="M2.5 9.3h19v2.2h-19Zm7.8 1h3.4v4.6h-3.4Z"/><circle cx="12" cy="13" r=".8" fill="#5b3a00"/>'),
    coins: svg('<g fill="currentColor"><ellipse cx="9" cy="17.5" rx="6.5" ry="2.5"/><path d="M2.5 14.5v3c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-3c0 1.4-2.9 2.5-6.5 2.5s-6.5-1.1-6.5-2.5Z"/><ellipse cx="9" cy="13.5" rx="6.5" ry="2.5"/><path d="M8.5 9v3c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V9c0 1.4-2.9 2.5-6.5 2.5S8.5 10.4 8.5 9Z"/><ellipse cx="15" cy="8" rx="6.5" ry="2.5"/></g><ellipse cx="15" cy="8" rx="3.5" ry="1.2" fill="#fff" opacity=".35"/>'),
    ring: svg('<path fill="currentColor" fill-rule="evenodd" d="M12 9.5a6.3 6.3 0 1 0 0 12.6 6.3 6.3 0 0 0 0-12.6Zm0 2.2a4.1 4.1 0 1 1 0 8.2 4.1 4.1 0 0 1 0-8.2Z"/><path fill="#5fc6ff" d="M8.6 2.5h6.8l2 3-5.4 4.6-5.4-4.6Z"/><path fill="#fff" opacity=".6" d="m9.6 3.4 1.2 2.2-2.3.1Z"/>'),
    arrow: svg('<path fill="currentColor" d="M2 12 11 4v5h11v6H11v5Z"/>', '0 0 24 24'),
    cuffs: svg('<g fill="currentColor"><path fill-rule="evenodd" d="M6.5 9a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Zm0 2.4a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2Z"/><path fill-rule="evenodd" d="M17.5 9a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Zm0 2.4a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2Z"/><path d="M5.2 6.5h2.6v3H5.2Zm11 0h2.6v3h-2.6Z"/><path d="M7.5 6.2c1-2.3 3-3.2 4.5-3.2s3.5.9 4.5 3.2l-1.4.6C14.4 5.2 13.2 4.6 12 4.6s-2.4.6-3.1 2.2Z"/></g>'),
    dice: svg('<rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor"/><g fill="#fff"><circle cx="8" cy="8" r="1.7"/><circle cx="16" cy="16" r="1.7"/><circle cx="12" cy="12" r="1.7"/></g>'),
    gavel: svg('<g fill="currentColor"><rect x="9" y="2" width="8" height="5" rx="1" transform="rotate(45 13 4.5)"/><rect x="10.5" y="7.5" width="3" height="11" rx="1" transform="rotate(-45 12 13)"/><rect x="2" y="19" width="11" height="3" rx="1"/></g>'),
  };

  // ---------- il çizimleri (her il karesine küçük bir simge) ----------
  const A = (inner) => `<svg viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
  const SEA = '<path fill="#5aa9dd" d="M0 20.5c2.7 0 2.7-1.2 5.3-1.2s2.7 1.2 5.4 1.2 2.6-1.2 5.3-1.2 2.7 1.2 5.3 1.2 2.7-1.2 5.4-1.2 2.6 1.2 5.3 1.2V24H0z"/>';
  const ART = {
    Sinop: A(`<path fill="#f2b632" opacity=".45" d="M18 3 31 0v6zM14 3 1 0v6z"/><path fill="#fff" stroke="#37474f" stroke-width=".7" d="M13 7h6l1.6 13h-9.2z"/><path fill="#d7263d" d="M12.6 10.5h6.8l.4 3h-7.6zM12 15.5h8l.35 2.6h-8.7z"/><path fill="#37474f" d="M12.3 5h7.4v2h-7.4z"/><path fill="#ffd54f" d="M14 2h4v3h-4z"/>${SEA}`),
    Kastamonu: A('<path fill="#8bc34a" d="M0 21h32v3H0z"/><path fill="#2e7d32" d="M9 1.5 15 11h-3l4 7H2l4-7H3z"/><path fill="#1b5e20" d="m22.5 4 5 8h-2.5l3.5 6.5H16.5L20 12h-2.5z"/><path fill="#6d4c41" d="M8 18h2v3.5H8zm13.5 0h2v3.5h-2z"/>'),
    Amasya: A('<circle cx="13" cy="14.5" r="7.5" fill="#c62828"/><circle cx="19" cy="14.5" r="7.5" fill="#e53935"/><path fill="#5d4037" d="M15.4 4.5h1.3v4.2h-1.3z"/><path fill="#43a047" d="M16.8 5.5c3-3 6.2-2.2 7.2-1.2-2 2.2-5 3.2-7.2 1.2z"/><ellipse cx="11.5" cy="11.5" rx="2.2" ry="1.3" fill="#fff" opacity=".45"/>'),
    Tokat: A('<path fill="#6d4c41" d="M15.5 2h1.4v4h-1.4z"/><path fill="#558b2f" d="M17 4c3-2 7-1 8 1-3 1.5-6 1.5-8-1z"/><g fill="#7b1fa2"><circle cx="10" cy="8" r="2.6"/><circle cx="14.7" cy="8" r="2.6"/><circle cx="19.4" cy="8" r="2.6"/><circle cx="24" cy="8" r="2.4"/><circle cx="12.3" cy="12.2" r="2.6"/><circle cx="17" cy="12.2" r="2.6"/><circle cx="21.7" cy="12.2" r="2.6"/><circle cx="14.7" cy="16.4" r="2.6"/><circle cx="19.4" cy="16.4" r="2.6"/><circle cx="17" cy="20.6" r="2.6"/></g><g fill="#ce93d8" opacity=".7"><circle cx="9.3" cy="7.2" r=".8"/><circle cx="16.3" cy="11.4" r=".8"/><circle cx="14" cy="15.6" r=".8"/></g>'),
    'Çorum': A('<path fill="none" stroke="#8d6324" stroke-width="2.2" d="M4.5 19.5a11.5 11.5 0 0 1 23 0"/><g fill="#8d6324"><circle cx="4.8" cy="15" r="1.3"/><circle cx="8" cy="10" r="1.3"/><circle cx="12.6" cy="7.6" r="1.3"/><circle cx="19.4" cy="7.6" r="1.3"/><circle cx="24" cy="10" r="1.3"/><circle cx="27.2" cy="15" r="1.3"/></g><circle cx="16" cy="15.5" r="5.5" fill="#f2b632" stroke="#8d6324" stroke-width="1.4"/><path fill="#8d6324" d="M9 19.5h14v3H9z"/>'),
    Malatya: A('<circle cx="16" cy="14.5" r="8" fill="#fb8c00"/><path fill="none" stroke="#e65100" stroke-width="1" d="M16 7c-2.5 3-2.5 12 0 15.5"/><ellipse cx="12.5" cy="11.5" rx="2.3" ry="1.4" fill="#ffe0b2" opacity=".7"/><path fill="#5d4037" d="M15.6 3.5h1.2v4h-1.2z"/><path fill="#43a047" d="M17 5c3-2.5 6.5-1.6 7.5-.5-2.4 2.2-5.3 2.6-7.5.5z"/>'),
    'Elazığ': A('<path fill="#a1887f" d="M0 21h32v3H0z"/><path fill="#b98a5d" d="M5 10h22v11H5z"/><path fill="#b98a5d" d="M5 7h3.4v3H5zm6 0h3.4v3H11zm6.6 0H21v3h-3.4zm5 0H27v3h-3.4z"/><path fill="#8d6748" d="M5 10h22v1.4H5z"/><path fill="#4e342e" d="M14 14.5a2 2 0 0 1 4 0V21h-4z"/><path fill="#4e342e" d="M8 13h2v2.5H8zm14 0h2v2.5h-2z"/>'),
    'Diyarbakır': A('<path fill="#2e7d32" d="M2 7h28a14 14 0 0 1-28 0z"/><path fill="#c5e1a5" d="M4 7h24a12 12 0 0 1-24 0z"/><path fill="#e53935" d="M5.6 7h20.8a10.4 10.4 0 0 1-20.8 0z"/><g fill="#212121"><ellipse cx="11" cy="10" rx=".7" ry="1.1"/><ellipse cx="16" cy="12.5" rx=".7" ry="1.1"/><ellipse cx="21" cy="10" rx=".7" ry="1.1"/><ellipse cx="13.5" cy="15" rx=".7" ry="1.1"/><ellipse cx="18.5" cy="15" rx=".7" ry="1.1"/></g>'),
    Hatay: A('<ellipse cx="16" cy="17.5" rx="14.5" ry="5" fill="#b0bec5"/><ellipse cx="16" cy="16.5" rx="12.5" ry="4.2" fill="#cfd8dc"/><ellipse cx="16" cy="15" rx="10.5" ry="4" fill="#d35400"/><ellipse cx="16" cy="13.8" rx="10.5" ry="3.8" fill="#f39c12"/><g fill="#7cb342"><circle cx="12" cy="13.5" r=".9"/><circle cx="16" cy="12.5" r=".9"/><circle cx="20" cy="13.8" r=".9"/><circle cx="14" cy="15.2" r=".9"/><circle cx="18" cy="15.3" r=".9"/></g>'),
    Adana: A('<path fill="#9e9e9e" d="M1 12.4h30v1.2H1z"/><rect x="4" y="9" width="21" height="8" rx="4" fill="#8d4a26"/><path stroke="#5d2e14" stroke-width="1" d="M8 9.5v7M12 9.5v7M16 9.5v7M20 9.5v7"/><path fill="#43a047" d="M24.5 6c4 1 6 4 6 7.5-1.5-1.5-3-2.6-5.5-3z"/><path fill="#2e7d32" d="M24 5.5h1.2v2H24z"/>'),
    Mersin: A('<ellipse cx="16" cy="14" rx="10.5" ry="7.2" fill="#fdd835" stroke="#f9a825" stroke-width="1"/><path fill="#fdd835" stroke="#f9a825" stroke-width=".8" d="M5.6 14 2 12.6v2.8zm20.8 0 3.6-1.4v2.8z"/><ellipse cx="12" cy="11" rx="3" ry="1.4" fill="#fff" opacity=".5"/><path fill="#43a047" d="M17 7c2-4 6.2-4.3 8.3-3.2-2 3-5.3 4.3-8.3 3.2z"/>'),
    Rize: A('<path fill="#2e7d32" d="M15.5 22.5C7.5 18.5 5.5 10 9.5 2.5c6 4 8 12 6 20z"/><path fill="#43a047" d="M16.5 22.5c8-4 10-12.5 6-20-6 4-8 12-6 20z"/><path fill="none" stroke="#a5d6a7" stroke-width=".7" d="M15.5 21C12 16 10.5 10 10 4M16.5 21c3.5-5 5-11 5.5-17"/>'),
    Trabzon: A('<path fill="#455a64" d="M2 12c5.5-5.5 15.5-5.5 22.5 0-7 5.5-17 5.5-22.5 0z"/><path fill="#b0bec5" d="M4.5 12.5c5-2.4 13.5-2.4 18.5 0-5 2.4-13.5 2.4-18.5 0z"/><path fill="#455a64" d="m23.8 12 6.4-4.6v9.2z"/><circle cx="6.5" cy="10.8" r="1.1" fill="#111"/><path fill="none" stroke="#263238" stroke-width=".6" d="M9 9.5c.8 1.6.8 3.4 0 5"/>'),
    Samsun: A(`<path fill="#eceff1" d="M8.5 10.5h15v4.5h-15z"/><path fill="#263238" d="M3 15h26l-3.2 5.5H6.2z"/><path fill="#d7263d" d="M14 5.5h4.2v5H14z"/><path fill="#263238" d="M14 5.5h4.2v1.4H14z"/><g fill="#90a4ae" opacity=".8"><circle cx="17.5" cy="3.2" r="1.7"/><circle cx="20.8" cy="2" r="1.3"/></g><g fill="#5aa9dd"><circle cx="11" cy="12.7" r=".8"/><circle cx="21" cy="12.7" r=".8"/></g>${SEA}`),
    'Çanakkale': A('<path fill="#5d4037" d="M3.5 18.5h19v2h-19z"/><circle cx="6.5" cy="21.5" r="1.8" fill="#3e2723"/><circle cx="19.5" cy="21.5" r="1.8" fill="#3e2723"/><path fill="#a1662f" d="M6 9.5h14v6H6zM7 15.5h2.2v3H7zm9.8 0H19v3h-2.2z"/><path fill="#a1662f" d="m18 10 3-7.5h5.5l1.4 3.2h-4.4l-2.3 4.8z"/><path fill="#6d3f17" d="m21.2 2.5 2-1.6.7 1.6zM4 10l2-1v4z"/><circle cx="24" cy="4" r=".7" fill="#111"/>'),
    'Balıkesir': A('<path fill="none" stroke="#6d4c41" stroke-width="1.4" d="M3 21C10 16 18 10.5 29 4"/><g fill="#7cb342"><ellipse cx="9" cy="14" rx="4" ry="1.6" transform="rotate(-50 9 14)"/><ellipse cx="13" cy="18.2" rx="4" ry="1.6" transform="rotate(20 13 18.2)"/><ellipse cx="17.5" cy="9" rx="4" ry="1.6" transform="rotate(-55 17.5 9)"/><ellipse cx="22" cy="12.5" rx="4" ry="1.6" transform="rotate(15 22 12.5)"/><ellipse cx="26" cy="3.6" rx="3.5" ry="1.4" transform="rotate(-30 26 3.6)"/></g><g fill="#4a3b5c"><ellipse cx="12.5" cy="12" rx="1.7" ry="2.2"/><ellipse cx="20.5" cy="7.3" rx="1.7" ry="2.2"/></g><ellipse cx="17" cy="13.5" rx="1.7" ry="2.2" fill="#9ccc65"/>'),
    Bursa: A('<path fill="#81c784" d="M0 20h32v4H0z"/><path fill="#5b7f95" d="M0 21 11 5.5l6 8 4.2-5.2L32 21z"/><path fill="#fff" d="m11 5.5 3.7 5-2-1-1.7 2-1.6-2-2.1 1zm10.2 2.8 3 3.8-1.5-.6-1.5 1-1.1-1-1.5.5z"/><path fill="#2e7d32" d="m4 20 2-4 2 4zm20 0 2-4 2 4z"/>'),
    'Muğla': A(`<path fill="#ffffff" stroke="#90a4ae" stroke-width=".6" d="M15 2v13H6.5zm1.6 2L25 15h-8.4z"/><path fill="#8d5524" d="M3 15.5h26l-3 4H6z"/><path fill="#5d3a16" d="M3 15.5h26v1.2H3z"/>${SEA}`),
    Antalya: A(`<path fill="#ffe082" d="M0 19h32v5H0z"/><circle cx="26" cy="5.5" r="3.6" fill="#fdd835"/><path fill="none" stroke="#8d6e63" stroke-width="2" d="M13 20c1-5 1-10-1.5-13.5"/><g fill="#43a047"><path d="M11.5 6.5C8 4 4.5 5 3 7.5c3-.5 5.5 0 8.5-1z"/><path d="M11.5 6.5C14 3 18 3 20 5c-3 .2-5.5.6-8.5 1.5z"/><path d="M11.5 6.5c-1-3.5 0-5.5 2-6.5 0 2.5-.6 4.5-2 6.5z"/><path d="M11.5 6.5C9 7.5 7.5 10 7.5 12.5c1.5-2.2 2.6-3.8 4-6z"/><path d="M11.5 6.5c3 .5 4.5 3 4.8 5.5-1.6-1.8-3-3.4-4.8-5.5z"/></g><path fill="#5aa9dd" d="M18 20.5h14V24H18z"/>`),
    'İzmir': A('<path fill="#bdb0a0" d="M9 20.5h14V23H9z"/><path fill="#e8d5b5" d="M12.5 9h7v11.5h-7z"/><path fill="#d4bd96" d="M11.5 18h9v2.5h-9zM12 9h8v1.4h-8z"/><path fill="#c0392b" d="M13 9c0-2.6 1.4-5 3-6.5 1.6 1.5 3 3.9 3 6.5z"/><circle cx="16" cy="13" r="2.3" fill="#fff" stroke="#5d4037" stroke-width=".7"/><path stroke="#5d4037" stroke-width=".6" d="M16 13v-1.5M16 13h1.2"/><path fill="#5d4037" d="M15 16h2v2h-2z"/>'),
    Ankara: A('<path fill="#c8b48e" d="M2 20h28v3H2z"/><path fill="#e3d3b0" d="M4 18.5h24V20H4zM4 7.5h24v2.2H4z"/><path fill="#d6c39b" d="M6 5.5h20v2H6z"/><g fill="#efe3c6"><path d="M5.2 9.7h2v8.8h-2zm4 0h2v8.8h-2zm4 0h2v8.8h-2zm4 0h2v8.8h-2zm4 0h2v8.8h-2zm4 0h2v8.8h-2z"/></g>'),
    'İstanbul': A('<path fill="#78909c" d="M2 20h28v3H2z"/><path fill="#90a4ae" d="M8.5 15.5a7.5 6.5 0 0 1 15 0z"/><path fill="#b0bec5" d="M7.5 15.5h17V20h-17z"/><path fill="#90a4ae" d="M5.5 17a2.6 2.3 0 0 1 5.2 0zm16 0a2.6 2.3 0 0 1 5.2 0z"/><path fill="#cfd8dc" d="M15.7 6.6h.6v2.4h-.6z"/><path fill="#b0bec5" d="M3.4 6h1.4v14H3.4zm23.8 0h1.4v14h-1.4z"/><path fill="#78909c" d="m3.4 6 .7-4 .7 4zm23.8 0 .7-4 .7 4z"/><path fill="#5aa9dd" d="M0 23h32v1H0z"/>'),
  };

  // ---------- çip (kalıcı puan) ----------
  const CHIP_SVG = '<svg class="chip-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#d7263d"/><g fill="#fff"><rect x="10.6" y="1" width="2.8" height="4" rx=".6"/><rect x="10.6" y="19" width="2.8" height="4" rx=".6"/><rect x="1" y="10.6" width="4" height="2.8" rx=".6"/><rect x="19" y="10.6" width="4" height="2.8" rx=".6"/><rect x="3.6" y="4.9" width="2.8" height="4" rx=".6" transform="rotate(-45 5 6.9)"/><rect x="17.6" y="15.1" width="2.8" height="4" rx=".6" transform="rotate(-45 19 17.1)"/><rect x="15.1" y="3.6" width="4" height="2.8" rx=".6" transform="rotate(-45 17.1 5)"/><rect x="4.9" y="17.6" width="4" height="2.8" rx=".6" transform="rotate(-45 6.9 19)"/></g><circle cx="12" cy="12" r="6.6" fill="#fff"/><circle cx="12" cy="12" r="5.2" fill="none" stroke="#d7263d" stroke-width="1" stroke-dasharray="2 1.4"/><text x="12" y="15.2" text-anchor="middle" font-size="8" font-weight="900" fill="#d7263d" font-family="Nunito,sans-serif">B</text></svg>';
  const chips = (n) => `<span class="chips">${CHIP_SVG}${Math.round(n).toLocaleString('tr-TR')}</span>`;

  // ---------- Baron Doları banknotları ----------
  let K = 1000;
  const NOTE_DEN = () => [1000, 500, 100, 50, 20, 10, 5, 1].map((x) => x * K);
  const NOTE_COLORS = [['#f4f1ea', '#5f6368'], ['#f9c9dc', '#9c2759'], ['#fbe58a', '#7a5f00'], ['#bfe8c8', '#1f6e3a'], ['#c2d9f7', '#1d4f9c'], ['#f6d3a8', '#93500f'], ['#dccbf5', '#4b2380'], ['#c9eef0', '#0f6a73']];
  function noteSVG(d) {
    const idx = [1, 5, 10, 20, 50, 100, 500, 1000].indexOf(d / K);
    const [bg, ink] = NOTE_COLORS[Math.max(0, idx)];
    const lbl = d >= 1e6 ? `${d / 1e6} MİLYON` : `${num(d)}`;
    return `<svg class="note" viewBox="0 0 160 80" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="1.5" width="157" height="77" rx="7" fill="${bg}" stroke="${ink}" stroke-width="3"/>
      <rect x="8" y="8" width="144" height="64" rx="4" fill="none" stroke="${ink}" stroke-width="1.2" stroke-dasharray="4 2" opacity=".55"/>
      <path d="M8 40 Q 40 22 80 40 T 152 40 M8 46 Q 40 28 80 46 T 152 46" stroke="${ink}" stroke-width="1" fill="none" opacity=".25"/>
      <circle cx="80" cy="42" r="21" fill="#fff" opacity=".6" stroke="${ink}" stroke-width="1.5"/>
      <text x="80" y="53" text-anchor="middle" font-size="31" font-weight="900" fill="${ink}" font-family="Nunito,Arial,sans-serif">B</text>
      <rect x="78" y="29" width="2.6" height="27" rx="1.2" fill="${ink}"/>
      <text x="80" y="17" text-anchor="middle" font-size="7.5" letter-spacing="2.5" fill="${ink}" font-weight="800" font-family="Nunito,Arial,sans-serif">BARON BANKASI</text>
      <text x="14" y="28" font-size="11" font-weight="900" fill="${ink}" font-family="Nunito,Arial,sans-serif">${lbl}</text>
      <text x="146" y="69" text-anchor="end" font-size="11" font-weight="900" fill="${ink}" font-family="Nunito,Arial,sans-serif">${lbl}</text>
    </svg>`;
  }
  const noteFor = (amt) => NOTE_DEN().find((n) => n <= amt) || NOTE_DEN().at(-1);
  function breakdown(amt) {
    const out = [];
    let r = Math.max(0, amt);
    for (const n of NOTE_DEN()) { const c = Math.floor(r / n); if (c) out.push([n, c]); r -= c * n; }
    return out;
  }

  // ---------- Türkiye haritası (yaklaşık sınırlar) ----------
  const PROJ = ([lon, lat]) => [((lon - 25.6) * 77.7).toFixed(1), ((42.3 - lat) * 100).toFixed(1)];
  const THRACE = [[26.03, 40.73], [26.33, 41.24], [26.6, 41.6], [26.35, 41.75], [26.6, 41.97], [27.3, 42.08], [28.0, 41.98], [28.3, 41.55], [28.8, 41.35], [29.05, 41.23], [29.0, 41.02], [28.6, 40.97], [27.9, 40.98], [27.4, 40.9], [27.0, 40.6], [26.7, 40.45], [26.2, 40.05], [26.35, 40.4], [26.75, 40.62], [26.4, 40.62]];
  const ANATOLIA = [[29.1, 41.22], [30.3, 41.2], [31.4, 41.3], [32.3, 41.75], [33.3, 42.0], [34.5, 41.95], [35.15, 42.05], [35.5, 41.7], [36.1, 41.65], [36.6, 41.35], [37.6, 41.05], [38.5, 40.95], [39.7, 41.05], [40.5, 41.05], [41.55, 41.52], [42.5, 41.45], [43.4, 41.1], [43.7, 40.7], [43.6, 40.1], [44.8, 39.7], [44.1, 39.4], [44.4, 38.4], [44.2, 37.9], [44.8, 37.3], [44.2, 37.0], [42.4, 37.1], [41.2, 37.05], [40.2, 36.85], [38.6, 36.75], [37.4, 36.65], [36.7, 36.8], [36.6, 36.25], [36.0, 35.82], [35.9, 36.2], [36.2, 36.6], [35.8, 36.75], [35.3, 36.6], [34.7, 36.8], [34.0, 36.3], [33.3, 36.15], [32.6, 36.1], [32.0, 36.5], [31.3, 36.8], [30.6, 36.85], [30.5, 36.3], [29.7, 36.15], [29.1, 36.6], [28.3, 36.75], [27.6, 36.7], [27.4, 37.05], [27.2, 37.5], [27.3, 37.95], [26.4, 38.3], [26.8, 38.7], [26.7, 39.3], [26.1, 39.5], [26.2, 39.9], [26.45, 40.15], [26.7, 40.4], [27.5, 40.35], [28.4, 40.4], [29.0, 40.4], [29.4, 40.75], [29.9, 40.75], [29.3, 40.85], [29.05, 41.0]];
  const CITY = {
    Sinop: [35.15, 42.02], Kastamonu: [33.78, 41.38], Amasya: [35.83, 40.65], Tokat: [36.55, 40.31], 'Çorum': [34.95, 40.55],
    Malatya: [38.31, 38.35], 'Elazığ': [39.22, 38.67], 'Diyarbakır': [40.23, 37.91], Hatay: [36.16, 36.2], Adana: [35.32, 37.0],
    Mersin: [34.63, 36.8], Rize: [40.52, 41.02], Trabzon: [39.72, 41.0], Samsun: [36.33, 41.29], 'Çanakkale': [26.41, 40.15],
    'Balıkesir': [27.88, 39.65], Bursa: [29.06, 40.18], 'Muğla': [28.36, 37.21], Antalya: [30.71, 36.89], 'İzmir': [27.14, 38.42],
    Ankara: [32.86, 39.93], 'İstanbul': [28.98, 41.01],
  };

  // harita etiketlerinin çakışmaması için konum ayarları [hizalama, dx, dy]
  const LABEL = {
    Sinop: ['middle', 0, -20], Kastamonu: ['end', -16, 2], 'Çorum': ['end', -16, 22], Amasya: ['middle', 0, -20], Tokat: ['start', 16, 22],
    Samsun: ['start', 16, -6], Trabzon: ['middle', 0, -20], Rize: ['start', 16, 8], Malatya: ['end', -16, 10], 'Elazığ': ['middle', 0, -20],
    'Diyarbakır': ['start', 16, 10], Mersin: ['end', -16, 8], Adana: ['middle', 0, -20], Hatay: ['start', 16, 14], 'Çanakkale': ['start', 14, 28],
    Bursa: ['start', 16, 4], 'Balıkesir': ['middle', 0, 36], 'İzmir': ['start', 16, 8], 'Muğla': ['middle', 0, 38], Antalya: ['middle', 0, 38],
    Ankara: ['middle', 0, 36], 'İstanbul': ['middle', 0, -20],
  };

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* yok */ } },
  };

  let BOARD = null;
  let room = null, latest = null, prevGame = null;
  let session = null;                 // { code, pid } — içinde bulunduğun oda
  let token = store.get('baron_token');
  let user = null;
  let skew = 0;
  let boardBuilt = false;
  let lastLogSeq = 0, seenChatSeq = 0;
  let modalRender = null;
  const queue = [];
  let busy = false;
  const shownPos = {}, pawnEls = {}, cashShown = {}, cashTweens = {};

  const socket = io({ transports: ['websocket', 'polling'], autoConnect: false, auth: (cb) => cb({ token }) });
  if (location.hostname === 'localhost') window.__baronDebug = (d) => socket.emit('debug:dice', d); if (location.hostname === 'localhost') window.__baronEnd = () => socket.emit('debug:end'); // yalnızca yerel test

  // ---------- ekrana sığdırma (kaydırma yok) ----------
  // iPhone çentiği / ana ekran çubuğu için güvenli alan payları
  const safeProbe = document.createElement('div');
  safeProbe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(safeProbe);
  function safeArea() {
    const cs = getComputedStyle(safeProbe);
    return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  }
  // ---------- 3D görünüm (three.js) ----------
  let V3 = null, v3Loading = null;
  function fitLayout() {
    const sa = safeArea(), root = document.documentElement.style;
    const fullW = window.innerWidth, fullH = window.innerHeight;
    root.setProperty('--vh', `${fullH}px`);
    root.setProperty('--sat', `${sa.t}px`); root.setProperty('--sar', `${sa.r}px`); root.setProperty('--sab', `${sa.b}px`); root.setProperty('--sal', `${sa.l}px`);
    const W = fullW - sa.l - sa.r, H = fullH - sa.t - sa.b;   // çentik dışında kalan alan
    const portrait = H > W * 1.05, small = Math.min(W, H) < 560;
    // tahta üstü göstergelerin karesi: tahtayla birlikte büyür/küçülür
    const hs = Math.round(portrait ? Math.min(W, H * 0.6) : Math.min(H, W * 0.62));
    root.setProperty('--hs', `${hs}px`);
    const gm = $('#game');
    gm.classList.toggle('g-portrait', portrait);
    gm.classList.toggle('g-small', small);
    if (V3) {
      V3.setPortrait(portrait);
      // köşe kartları ve yan araç çubukları tahtanın üstüne binmesin
      const side = small ? 58 : 74;   // eşkenar dörtgen tahtanın sol/sağ uçları ortada; köşe kartları üstte kalır
      // yatayda üstteki tur/sıra bilgisi tahtanın en üst köşesini (OTOPARK) kapatmasın: tahta biraz aşağı insin
      const topInfo = small ? 50 : Math.min(96, Math.round(H * 0.09));
      const many = gm.classList.contains('many');
      V3.setMargins(portrait ? { top: sa.t + (many ? (small ? 150 : 170) : (small ? 64 : 80)), bottom: sa.b + (small ? 64 : 80), left: sa.l + 4, right: sa.r + 4 } : { top: sa.t + topInfo, bottom: sa.b + 4, left: sa.l + side, right: sa.r + side });
    }
    if (document.body.classList.contains('ingame') && (window.scrollX || window.scrollY)) window.scrollTo(0, 0);
    fitHome();
  }
  // Bilgisayarda ana sayfa kaydırma gerektirmeden ekrana sığsın
  function fitHome() {
    const h = $('#home2'); if (!h || $('#home').classList.contains('hidden')) return;
    const desk = window.innerWidth > 920;
    if (!desk) { h.style.transform = ''; h.style.marginBottom = ''; return; }
    const natural = h.offsetHeight, avail = window.innerHeight;
    const k = Math.max(0.6, Math.min(1, avail / natural));
    h.style.transform = k < 1 ? `scale(${k})` : '';
    h.style.marginBottom = k < 1 ? `${-(natural * (1 - k))}px` : '';
  }
  if (window.ResizeObserver) new ResizeObserver(() => fitHome()).observe($('#home2'));
  // 3D görünümü yükle ve oyunun o anki hâliyle eşitle
  function load3D() {
    if (v3Loading) return v3Loading;
    v3Loading = import('/3d/view.js').then(async (mod) => {
      V3 = await mod.createView($('#gl3d'), { squares: BOARD.squares, groups: BOARD.groups, ART, ICON, onPick: (i) => openDeed(i) });
      if (location.hostname === 'localhost') window.__V3 = V3;
      const portrait = innerHeight > innerWidth * 1.05;
      V3.setCamMode('all'); renderCamBtn();
      fitLayout();
      const g = game(); if (g) sync3D(g);
    }).catch((e) => { console.error(e); toast('3D görünüm yüklenemedi: ' + (e && e.message), 'err'); });
    return v3Loading;
  }
  function sync3D(g) {
    if (!V3 || !g) return;
    g.players.forEach((p) => V3.ensurePawn(p.id, p.token, p.color));
    BOARD.squares.forEach((s, i) => { const pr = g.props[i]; if (!pr) return; const o = pr.owner && playerById(pr.owner); V3.setProp(i, o ? o.color : null, s.type === 'prop' ? pr.houses : 0, pr.mortgaged); });
    styleOfPawns(g); layoutPawns(false);
    if (g.rollId) V3.setDice(g.dice, false);
    const mv = g.moves && g.moves.length ? g.moves[g.moves.length - 1] : null;
    V3.landed(mv && g.phase !== 'gameover' ? mv.to : null);
  }
  function renderCamBtn() { const b = $('#camBtn'); if (b && V3) { const f = V3.camMode === 'follow'; b.textContent = f ? '🗺' : '🔍'; b.title = f ? 'Tüm tahtayı göster' : 'Sırası geleni yakından izle'; } }
  $('#tbMoreBtn').onclick = (e) => { e.stopPropagation(); $('#tbMore').classList.toggle('hidden'); };
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#tbMore, #tbMoreBtn')) $('#tbMore').classList.add('hidden'); });
  $('#camBtn').onclick = () => { if (!V3) return; V3.setCamMode(V3.camMode === 'follow' ? 'all' : 'follow'); renderCamBtn(); };
  function fitNames() { /* 3D'de gerekmiyor */ }
  // Oyun içi açılır menü
  function openDrawer() { const t = $(`.tab[data-tab="${incomingTrades ? 'trades' : 'chat'}"]`); if (t) t.click(); $('#gameDrawer').classList.add('open'); $('#drawerBackdrop').classList.remove('hidden'); if (latest) renderChat(latest); updateMenuBadge(); }
  function closeDrawer() { $('#gameDrawer').classList.remove('open'); $('#drawerBackdrop').classList.add('hidden'); }
  const drawerOpen = () => $('#gameDrawer').classList.contains('open');
  let unreadChat = 0, incomingTrades = 0;
  function updateMenuBadge() {
    const n = unreadChat + incomingTrades, b = $('#menuBadge');
    b.textContent = n; b.classList.toggle('hidden', !n);
  }
  $('#menuBtn').onclick = () => (drawerOpen() ? closeDrawer() : openDrawer());
  $('#drawerClose').onclick = closeDrawer;
  $('#drawerBackdrop').onclick = closeDrawer;
  window.addEventListener('resize', fitLayout);
  window.addEventListener('orientationchange', () => setTimeout(fitLayout, 250));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitLayout);
  fitLayout();

  // ---------- yardımcılar ----------
  function toast(msg, kind = '') {
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }
  function showScreen(id) {
    ['loading', 'auth', 'home', 'lobby', 'game'].forEach((s) => $(`#${s}`).classList.toggle('hidden', s !== id));
    if (id === 'home' && token) loadLeaderboard();
    document.body.classList.toggle('ingame', id === 'game');
    if (id === 'game') requestAnimationFrame(() => { fitLayout(); if (V3) V3.resize(); if (boardBuilt) layoutPawns(false); });
    if (id === 'home') requestAnimationFrame(fitHome);
  }
  function saveSession(res) {
    session = { code: res.code, pid: res.pid };
    history.replaceState(null, '', `?oda=${res.code}`);
  }
  function clearSession() {
    session = null; room = null; latest = null; prevGame = null; queue.length = 0; busy = false;
    if (V3) V3.reset(); gameKey = null;
    history.replaceState(null, '', location.pathname);
    boardBuilt = false; renderGameOver.done = false; renderGameOver.res = false; lastLogSeq = 0; seenChatSeq = 0;
    [shownPos, pawnEls, cashShown].forEach((o) => Object.keys(o).forEach((k) => delete o[k]));
    $('#tokenLayer').innerHTML = '';
    $('#overlay').classList.add('hidden');
    closeModal();
    showScreen('home');
    socket.emit('rooms:list', renderRooms);
  }
  const handle = (res) => {
    if (res && res.error) { toast(res.error, 'err'); return false; }
    if (res && res.pid) { saveSession(res); if ($('#modalBody').querySelector('#botsForm, #createForm')) closeModal(); }
    return true;
  };
  function act(type, extra = {}) {
    socket.emit('game:act', { type, ...extra }, (res) => { if (res && res.error) toast(res.error, 'err'); });
  }
  const now = () => Date.now() + skew;
  const game = () => room && room.game;
  const me = () => game() && session && game().players.find((p) => p.id === session.pid);
  const playerById = (id) => game() && game().players.find((p) => p.id === id);
  const sq = (i) => BOARD.squares[i];
  const groupColor = (s) => (s.group ? BOARD.groups[s.group].color : s.type === 'station' ? '#3b4046' : '#8a8a8a');
  const tokenSVG = (t) => TOKENS[t] || TOKENS.araba;
  // 3D görünümlü oyun piyonu (oyuncu renginde ışık-gölge)
  function mixHex(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
    return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
  }
  function pawnSVG(c, id) {
    const L = mixHex(c, '#ffffff', 0.55), D = mixHex(c, '#000000', 0.5), DD = mixHex(c, '#000000', 0.7);
    const g = `pg${id}`;
    return `<svg viewBox="0 0 40 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>
      <radialGradient id="${g}h" cx=".36" cy=".3" r=".78"><stop offset="0" stop-color="#fff"/><stop offset=".16" stop-color="${L}"/><stop offset=".58" stop-color="${c}"/><stop offset="1" stop-color="${D}"/></radialGradient>
      <linearGradient id="${g}b" x1="0" x2="1"><stop offset="0" stop-color="${D}"/><stop offset=".28" stop-color="${L}"/><stop offset=".5" stop-color="${c}"/><stop offset="1" stop-color="${DD}"/></linearGradient>
      <linearGradient id="${g}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
      <path d="M4 52v4a16 6 0 0 0 32 0v-4z" fill="url(#${g}b)"/>
      <ellipse cx="20" cy="52" rx="16" ry="6" fill="url(#${g}t)"/>
      <path d="M8.5 52C10.5 41 15 34 16 27.5h8C25 34 29.5 41 31.5 52c-3 2.2-20 2.2-23 0z" fill="url(#${g}b)"/>
      <ellipse cx="20" cy="27.5" rx="8.6" ry="3" fill="url(#${g}b)"/>
      <circle cx="20" cy="15" r="10" fill="url(#${g}h)"/>
      <ellipse cx="16.2" cy="10.8" rx="3.2" ry="2.1" fill="#fff" opacity=".75"/>
      <path d="M12 44c2-6 4-10 5-14" stroke="#fff" stroke-opacity=".35" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    </svg>`;
  }
  const chip = (p, extra = '') => `<span class="token-chip" style="--c:${p.color};${extra}">${tokenSVG(p.token || p.icon)}</span>`;

  // ---------- modal ----------
  function openModal(renderFn) {
    modalRender = renderFn;
    $('#modalBody').innerHTML = '';
    renderFn($('#modalBody'));
    $('#modal').classList.remove('hidden');
  }
  function closeModal() {
    modalRender = null;
    ['#botsForm', '#createForm'].forEach((f) => { const el = $(f); if (el && !$('#formStash').contains(el)) $('#formStash').appendChild(el); });
    $('#modal').classList.add('hidden');
  }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if ((e.key === 'f' || e.key === 'F') && !e.target.closest('input,textarea,select') && !$('#game').classList.contains('hidden')) toggleFullscreen();
  });
  function confirmBox(text, yesLabel, onYes) {
    openModal((el) => {
      el.innerHTML = `<h3>${esc(text)}</h3><div class="modal-actions"><button class="btn primary" id="cYes">${esc(yesLabel)}</button><button class="btn" data-close>Vazgeç</button></div>`;
      $('#cYes', el).onclick = () => { closeModal(); onYes(); };
    });
  }

  // ---------- tam ekran ----------
  const standalone = () => matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone;
  function toggleFullscreen() {
    const d = document, el = d.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (d.fullscreenElement || d.webkitFullscreenElement) return (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    if (!req) {
      // iPhone Safari tam ekran API'sini desteklemiyor: ana ekrana eklenince tam ekran açılır
      if (standalone()) return toast('Oyun zaten tam ekran modunda.');
      return openModal((m) => { m.innerHTML = `<h3>Tam ekran (iPhone)</h3><p>iPhone'da Safari sitelerin tam ekran olmasına izin vermiyor. Bunun yerine oyunu ana ekrana ekle; oradan açınca <b>tam ekran</b> ve uygulama gibi çalışır:</p><ol><li>Safari'de alttaki <b>Paylaş</b> (kare ve yukarı ok) düğmesine dokun.</li><li><b>Ana Ekrana Ekle</b>'yi seç.</li><li>Ana ekrandaki <b>Baron</b> simgesinden aç.</li></ol>`; });
    }
    Promise.resolve(req.call(el, { navigationUI: 'hide' })).catch(() => toast('Tarayıcı tam ekrana izin vermedi.', 'err'));
  }
  $('#fsBtn').onclick = toggleFullscreen;
  function renderSoundBtns() {
    const A = window.BaronAudio; if (!A) return;
    $$('[data-snd="music"]').forEach((b) => { b.classList.toggle('off', !A.musicOn); b.title = A.musicOn ? 'Müziği kapat' : 'Müziği aç'; });
    $$('[data-toggle="music"]').forEach((t) => t.classList.toggle('on', A.musicOn));
    $$('[data-toggle="sfx"]').forEach((t) => t.classList.toggle('on', A.sfxOn));
    $$('[data-snd="sfx"]').forEach((b) => { b.classList.toggle('off', !A.sfxOn); b.textContent = A.sfxOn ? '🔊' : '🔈'; b.title = A.sfxOn ? 'Efektleri kapat' : 'Efektleri aç'; });
  }
  $$('[data-snd]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const A = window.BaronAudio; if (!A) return;
      const on = b.dataset.snd === 'music' ? A.toggleMusic() : A.toggleSfx();
      toast(b.dataset.snd === 'music' ? (on ? 'Müzik açıldı' : 'Müzik kapatıldı') : (on ? 'Efektler açıldı' : 'Efektler kapatıldı'));
      renderSoundBtns();
    };
  });
  renderSoundBtns();
  document.addEventListener('fullscreenchange', () => {
    $('#fsBtn').textContent = document.fullscreenElement ? 'Küçült' : 'Tam ekran';
    setTimeout(fitLayout, 100);
  });

  // ---------- ana menü ----------
  $$('[data-hat]').forEach((el) => { el.innerHTML = TOKENS.sapka; });
  $('#deckChestIcon').innerHTML = ICON.chest;
  function notesBackground() {
    $('#notesBg').innerHTML = [1, 5, 10, 20, 50, 100, 500, 1000, 100, 50, 20, 500].map((d, i) => {
      const left = (i * 8.3 + Math.random() * 6) % 96;
      const dur = 16 + Math.random() * 14, delay = -Math.random() * dur;
      const r0 = Math.round(Math.random() * 60 - 30), r1 = r0 + Math.round(Math.random() * 240 - 120);
      return `<div class="note-float" style="left:${left}%;animation-duration:${dur}s;animation-delay:${delay}s;--r0:${r0}deg;--r1:${r1}deg">${noteSVG(d * K)}</div>`;
    }).join('');
  }
  notesBackground();

  const params = new URLSearchParams(location.search);
  if (params.get('oda')) $('#codeInput').value = params.get('oda').toUpperCase();

  // ---------- hesap: giriş / kayıt ----------
  let authMode = 'login';
  $$('[data-auth]').forEach((t) => {
    t.onclick = () => {
      authMode = t.dataset.auth;
      $$('[data-auth]').forEach((x) => x.classList.toggle('active', x === t));
      $('#authBtn').textContent = authMode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur';
      $('#authPass').autocomplete = authMode === 'login' ? 'current-password' : 'new-password';
      const reg = authMode === 'register';
      $('#authEmailField').classList.toggle('hidden', !reg);
      $('#authEmail').required = reg;
      $('#authUserLabel').textContent = reg ? 'Kullanıcı adı' : 'Kullanıcı adı veya e-posta';
      $('#authUser').maxLength = reg ? 16 : 120;
      $('#authUser').placeholder = reg ? 'Örn. Baron_34' : '';
      $('#authHint').innerHTML = authMode === 'login' ? 'Yeni hesaplar <b class="chipv">1.000</b> çiple başlar.' : 'Kullanıcı adı 3–16 karakter (harf, rakam, _). Şifre en az 6 karakter.';
    };
  });
  async function api(path, body) {
    const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, ...j };
  }
  $('#authForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#authBtn'); btn.disabled = true;
    const body = authMode === 'login'
      ? { login: $('#authUser').value.trim(), password: $('#authPass').value }
      : { username: $('#authUser').value.trim(), email: $('#authEmail').value.trim(), password: $('#authPass').value };
    const r = await api(authMode === 'login' ? '/api/login' : '/api/register', body);
    btn.disabled = false;
    if (!r.ok) return toast(r.error || 'Bir hata oluştu.', 'err');
    token = r.token; store.set('baron_token', token);
    $('#authPass').value = '';
    setUser(r.user);
    if (authMode === 'register') toast(`Hoş geldin ${r.user.name}! Hesabına 1.000 çip yüklendi.`);
    startSocket();
  };
  function setUser(u) {
    if (!u) return;
    const prev = user;
    user = u;
    $('#ubName').textContent = u.name;
    $('#ubAvatar').textContent = u.name.slice(0, 1).toLocaleUpperCase('tr-TR');
    $('#ubStats').textContent = `${u.games} oyun · ${u.wins} galibiyet${u.games ? ` · %${Math.round((u.wins / u.games) * 100)}` : ''}`;
    renderDailyCard(u);
    $('#ubChips').innerHTML = chips(u.chips);
    $('#mChips').innerHTML = chips(u.chips);
    if (u.admin !== undefined) ['#adminLink', '#adminLink2'].forEach((id) => $(id) && $(id).classList.toggle('hidden', !u.admin));
    $('#mGiftDot').classList.toggle('hidden', !u.dailyAvailable);
    if (prev && prev.chips !== u.chips) { const el = $('#ubChips'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  }
  function renderDailyCard(u) {
    const today = u.dailyAvailable ? u.streak + 1 : u.streak;
    $('#dailyStrip').innerHTML = u.dailyRewards.map((r, k) => {
      const day = k + 1, done = day < today || (!u.dailyAvailable && day === today), now = u.dailyAvailable && day === Math.min(today, 7);
      return `<div class="ds ${done ? 'done' : ''} ${now ? 'now' : ''}" title="${day}. gün: ${r} çip"><i>${done ? '✓' : day}</i><small>${r}</small></div>`;
    }).join('');
    $('#dailyInfo').textContent = u.streak ? `${u.streak} günlük seri` : 'Seriye başla!';
    const b = $('#dailyBtn');
    b.disabled = false;
    if (u.dailyAvailable) { b.innerHTML = `Ödülü Al +${chips(u.nextDaily)}`; b.classList.add('glow'); b.classList.remove('ghost'); }
    else {
      // Türkiye saatine göre gece yarısına kalan süre
      const n = new Date(Date.now() + 3 * 3600e3), left = 86400 - (n.getUTCHours() * 3600 + n.getUTCMinutes() * 60 + n.getUTCSeconds());
      b.innerHTML = `Yarın tekrar gel · ${Math.floor(left / 3600)} sa ${Math.floor((left % 3600) / 60)} dk`;
      b.classList.remove('glow'); b.classList.add('ghost');
    }
  }
  async function loadLeaderboard() {
    const r = await api('/api/leaderboard').catch(() => null);
    if (!r || !r.top) return;
    $('#lbMini').innerHTML = r.top.slice(0, 5).map((u, k) => `<li class="${user && u.name === user.name ? 'me' : ''}"><span class="rk">${k + 1}</span><b>${esc(u.name)}</b>${chips(u.chips)}</li>`).join('') || '<li class="muted">Henüz kimse yok.</li>';
  }
  function startSocket() {
    if (socket.connected) socket.disconnect();
    socket.connect();
  }
  function logout() {
    token = null; user = null; store.set('baron_token', null);
    socket.disconnect();
    session = null; room = null;
    $('[data-auth="login"]').click();   // çıkıştan sonra giriş sekmesi açık olsun
    $('#authUser').value = ''; $('#authPass').value = '';
    showScreen('auth');
  }
  $('#logoutBtn').onclick = () => confirmBox('Çıkış yapmak istiyor musun?', 'Çıkış Yap', logout);

  function openDaily() {
    if (!user) return;
    openModal((el) => {
      const today = user.dailyAvailable ? user.streak + 1 : user.streak;
      el.innerHTML = `<h3>Günlük Giriş Ödülü</h3><p class="muted">Her gün gel, seriyi bozma! 7. günden sonra her gün ${chips(user.dailyRewards.at(-1))}.</p>
        <div class="daily-grid">${user.dailyRewards.map((r, k) => {
          const day = k + 1, done = day < today || (!user.dailyAvailable && day === today), now = user.dailyAvailable && day === Math.min(today, 7);
          return `<div class="dday ${done ? 'done' : ''} ${now ? 'now' : ''}"><small>${day}. gün</small>${CHIP_SVG}<b>${r}</b></div>`;
        }).join('')}</div>
        <div class="modal-actions">${user.dailyAvailable ? `<button class="btn primary claim-btn" id="claimBtn">Ödülü Al +${chips(user.nextDaily)}</button>` : '<p><b>Bugünkü ödülünü aldın.</b> Yarın tekrar gel!</p>'}</div>`;
      const b = $('#claimBtn', el);
      if (b) b.onclick = async () => {
        b.disabled = true;
        const r = await api('/api/daily', {});
        if (!r.ok) { toast(r.error || 'Alınamadı.', 'err'); if (r.user) setUser(r.user); return; }
        const from = centerOf(b);
        setUser(r.user);
        chipBurst(from, centerOf($('#ubChips')), r.reward);
        toast(`+${r.reward} çip hesabına eklendi!`);
        closeModal();
      };
    });
  }
  function chipBurst(from, to, amount) {
    if (REDUCED) return;
    const n = Math.min(12, 4 + Math.floor(amount / 60));
    for (let k = 0; k < n; k++) {
      const el = document.createElement('div');
      el.className = 'fly-chip';
      el.innerHTML = CHIP_SVG;
      el.style.left = `${from.x}px`; el.style.top = `${from.y}px`;
      $('#fx').appendChild(el);
      const dx = to.x - from.x + (Math.random() * 30 - 15), dy = to.y - from.y;
      el.animate([
        { transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 },
        { transform: `translate(calc(-50% + ${dx * 0.3 + (Math.random() * 120 - 60)}px), calc(-50% + ${dy * 0.3 - 80}px)) scale(1.2)`, opacity: 1, offset: 0.35 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.6)`, opacity: 0.2 },
      ], { duration: 900, delay: k * 50, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'both' }).onfinish = () => el.remove();
    }
  }
  $('#dailyBtn').onclick = async () => {
    if (!user) return;
    if (!user.dailyAvailable) return openDaily();
    const b = $('#dailyBtn'); b.disabled = true;
    const r = await api('/api/daily', {});
    if (!r.ok) { toast(r.error || 'Alınamadı.', 'err'); if (r.user) setUser(r.user); b.disabled = false; return; }
    const from = centerOf(b);
    setUser(r.user);
    chipBurst(from, centerOf($('#ubChips')), r.reward);
    toast(`+${r.reward} çip hesabına eklendi!`);
    loadLeaderboard();
  };
  $('#lbBtn').onclick = async () => {
    const r = await api('/api/leaderboard');
    openModal((el) => {
      el.innerHTML = `<h3>Sıralama — En Zengin Baronlar</h3><ol class="lb">${(r.top || []).map((u, k) => `<li class="${user && u.name === user.name ? 'me' : ''}"><span class="rk">${k + 1}</span><b>${esc(u.name)}</b><span class="muted small">${u.wins} galibiyet · ${u.games} oyun</span>${chips(u.chips)}</li>`).join('') || '<li class="muted">Henüz kimse yok.</li>'}</ol>`;
    });
  };
  const home2 = () => $('#home2');
  $('#homeMenuBtn').onclick = () => home2().classList.add('drawer-open');
  $('#homeMenuClose').onclick = () => home2().classList.remove('drawer-open');
  $('#homeBackdrop').onclick = () => home2().classList.remove('drawer-open');
  $('#mGiftBtn').onclick = () => $('#dailyBtn').click();
  $('#homeFsBtn').onclick = () => { home2().classList.remove('drawer-open'); toggleFullscreen(); };
  $('#logoutBtn2').onclick = () => $('#logoutBtn').click();
  $$('[data-toggle]').forEach((t) => { t.onclick = (e) => { e.preventDefault(); const b = $(`.snd[data-snd="${t.dataset.toggle}"]`); if (b) b.click(); }; });
  $('#addBotBtn').onclick = () => socket.emit('lobby:bot', { add: true }, handle);

  // seçim düğmeleri (açılır liste yerine: para/çip simgeleri görünsün)
  const opt = { startMoney: 1500000, stake: 0, rounds: 40, bots: 3, botRounds: 40, botLevel: store.get('baron_level') ?? 1 };
  const LEVEL_KEYS = ['easy', 'normal', 'hard'], LEVEL_NAMES = ['Kolay', 'Normal', 'Zor'], LEVEL_PRIZE = [15, 25, 40];
  function seg(id, key, values, label) {
    const el = $(id);
    el.innerHTML = values.map((v) => `<button type="button" class="${v === opt[key] ? 'sel' : ''}" data-v="${v}">${label(v)}</button>`).join('');
    $$('button', el).forEach((b) => { b.onclick = () => { opt[key] = +b.dataset.v; seg(id, key, values, label); }; });
  }
  // karakter ve renk seçimi (botlu oyun) — tercih hatırlanır
  const TOKEN_NAMES = { araba: 'Araba', sapka: 'Şapka', gemi: 'Gemi', cay: 'Çay', nazar: 'Nazar', ucak: 'Uçak', tac: 'Taç', roket: 'Roket' };
  const PICK_COLORS = ['#e63946', '#1d7cf2', '#2a9d8f', '#f4a261', '#9b5de5', '#ff4fa3'];
  const look = { icon: store.get('baron_icon') || 'araba', color: store.get('baron_color') || '#e63946' };
  function renderLookPick() {
    const tp = $('#botTokPick'), cp = $('#botColPick'); if (!tp) return;
    tp.innerHTML = Object.keys(TOKEN_NAMES).map((k) => `<button type="button" class="${k === look.icon ? 'sel' : ''}" data-k="${k}" style="--c:${look.color}" title="${TOKEN_NAMES[k]}">${TOKENS[k]}<small>${TOKEN_NAMES[k]}</small></button>`).join('');
    cp.innerHTML = PICK_COLORS.map((c) => `<button type="button" class="${c === look.color ? 'sel' : ''}" data-c="${c}" style="--c:${c}" aria-label="renk"></button>`).join('');
    $$('button', tp).forEach((b) => { b.onclick = () => { look.icon = b.dataset.k; store.set('baron_icon', look.icon); renderLookPick(); }; });
    $$('button', cp).forEach((b) => { b.onclick = () => { look.color = b.dataset.c; store.set('baron_color', look.color); renderLookPick(); }; });
  }
  const roundLabel = (v) => (v ? `${v} tur` : 'Sınırsız');
  function renderSegs() {
    seg('#startMoneySeg', 'startMoney', [1000, 1500, 2000, 2500].map((x) => x * K), money);
    seg('#stakeSeg', 'stake', [0, 50, 100, 250, 500], (v) => (v ? chips(v) : 'Ücretsiz'));
    seg('#roundSeg', 'rounds', [20, 40, 60, 0], roundLabel);
    seg('#botCountSeg', 'bots', [1, 2, 3, 4, 5], (v) => `${v} bot`);
    seg('#botRoundSeg', 'botRounds', [20, 40, 60, 0], roundLabel);
    seg('#botLevelSeg', 'botLevel', [0, 1, 2], (v) => LEVEL_NAMES[v]);
    $$('#botLevelSeg button').forEach((b) => { const f = b.onclick; b.onclick = () => { f(); store.set('baron_level', opt.botLevel); renderSegs(); }; });
    if ($('#botPrize')) $('#botPrize').textContent = LEVEL_PRIZE[opt.botLevel];
  }
  renderSegs();

  // Formlar pencerede açılır; kapanınca saklandıkları yere döner
  function openFormModal(id, title) {
    openModal((el) => { el.innerHTML = `<h3>${title}</h3>`; el.appendChild($(id)); });
    modalRender = null;
  }
  const toggleForm = (id) => openFormModal(id, id === '#botsForm' ? 'Botlarla Oyna' : 'Oda Kur');
  $('#quickBtn').onclick = () => socket.emit('room:quick', {}, handle);
  $('#showCreateBtn').onclick = () => toggleForm('#createForm');
  $('#showBotsBtn').onclick = () => { renderLookPick(); toggleForm('#botsForm'); };
  $('#botsForm').onsubmit = (e) => { e.preventDefault(); socket.emit('room:bots', { bots: opt.bots, roundLimit: opt.botRounds, startMoney: 1500 * K, icon: look.icon, color: look.color, level: LEVEL_KEYS[opt.botLevel] }, handle); };
  $('#createForm').onsubmit = (e) => {
    e.preventDefault();
    socket.emit('room:create', {
      roomName: $('#roomNameInput').value, maxPlayers: +$('#maxPlayersSel').value,
      startMoney: opt.startMoney, stake: opt.stake, roundLimit: opt.rounds, isPublic: $('#publicSel').value === '1',
    }, handle);
  };
  const join = (code) => socket.emit('room:join', { code }, handle);
  $('#joinBtn').onclick = () => { const c = $('#codeInput').value.trim(); if (c.length < 5) return toast('5 haneli oda kodunu gir.', 'err'); join(c); };
  $('#codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#joinBtn').click(); });

  function renderRooms(list) {
    const ul = $('#publicRooms');
    if (!Array.isArray(list) || !list.length) { ul.innerHTML = '<li class="muted">Şu an açık oda yok. İlk odayı sen kur!</li>'; return; }
    ul.innerHTML = list.map((r) => `<li class="room"><div><b>${esc(r.name)}</b>${r.quick ? '<span class="tag">HIZLI</span>' : ''}<div class="muted">${r.players}/${r.maxPlayers} oyuncu · ${r.stake ? `giriş ${chips(r.stake)}` : 'ücretsiz'} · ${esc(r.code)}</div></div><button class="btn sm" data-join="${esc(r.code)}">Katıl</button></li>`).join('');
    $$('[data-join]', ul).forEach((b) => { b.onclick = () => join(b.dataset.join); });
  }

  // ---------- bağlantı & durum kuyruğu ----------
  socket.on('connect', () => {
    $('#conn').classList.add('hidden');
    socket.emit('room:resume', (res) => {
      if (res && res.ok) handle(res);
      else { session = null; if (!room) { showScreen('home'); socket.emit('rooms:list', renderRooms); } }
    });
  });
  let connFails = 0;
  socket.on('connect_error', (e) => {
    if (e && e.message === 'auth') return logout();
    // sunucu/veritabanı uyanıyor olabilir: bekle ve tekrar dene
    connFails++;
    if (!$('#loading').classList.contains('hidden')) {
      $('#loadingText').textContent = 'Sunucuya bağlanılıyor…';
      $('#loadingSub').textContent = connFails > 3 ? 'Sunucu yanıt vermiyor. Biraz bekleyip yeniden dene.' : 'Sunucu uyanıyor, birkaç saniye…';
      if (connFails > 3) $('#retryBtn').classList.remove('hidden');
    } else toast('Sunucuya bağlanılamadı, tekrar deneniyor…', 'err');
    setTimeout(() => { if (token && !socket.connected) socket.connect(); }, Math.min(10000, 1500 * connFails));
  });
  socket.on('disconnect', (reason) => { if (token && reason !== 'io client disconnect') $('#conn').classList.remove('hidden'); });
  socket.on('me', (u) => setUser(u));
  socket.on('rooms:list', renderRooms);
  socket.on('kicked', (msg) => { toast(msg, 'err'); session = null; room = null; showScreen('home'); });
  socket.on('room:state', (s) => {
    skew = s.serverNow - Date.now();
    latest = s;
    renderChat(s);
    if (!s.game) { queue.length = 0; busy = false; room = s; prevGame = null; showScreen('lobby'); renderLobby(); return; }
    queue.push(s);
    pump();
  });
  function pump() {
    if (busy || !queue.length || !BOARD) return;
    const s = queue.shift();
    busy = true;
    const fast = REDUCED || queue.length > 2;
    const dur = applyGame(s, fast);
    setTimeout(() => { busy = false; pump(); }, dur);
  }

  // ---------- lobi ----------
  function renderLobby() {
    $('#lobbyName').textContent = room.name;
    $('#lobbyInfo').innerHTML = `${room.players.length}/${room.maxPlayers} oyuncu · Başlangıç ${money(room.startMoney)} · ${room.roundLimit ? `${room.roundLimit} tur` : 'tur sınırı yok'} · ${room.stake ? `Giriş ${chips(room.stake)} · Ödül ${chips(room.stake * room.players.filter((p) => !p.isBot).length)}` : 'Ücretsiz masa'}${room.players.some((p) => p.isBot) ? ` · Botlar: ${LEVEL_NAMES[LEVEL_KEYS.indexOf(room.botLevel || 'normal')]}` : ''} · ${room.isPublic ? 'herkese açık' : 'kodla'}`;
    const host0 = room.hostId === session.pid;
    $('#botControls').classList.toggle('hidden', !host0 || room.stake > 0 || room.players.length >= room.maxPlayers);
    $('#lobbyCode').textContent = room.code;
    const mine = room.players.find((p) => p.id === session.pid);
    $('#lobbyPlayers').innerHTML = room.players.map((p) => `
      <li class="${p.connected ? '' : 'off'}">${chip(p)}
        <b>${esc(p.name)}</b>${p.id === session.pid ? ' <span class="muted">(sen)</span>' : ''}
        ${p.isBot ? '<span class="badge-s">BOT</span>' : (p.chips != null ? `<span class="muted small">${chips(p.chips)}</span>` : '')}
        ${p.id === room.hostId ? '<span class="crown">ODA SAHİBİ</span>' : ''}
        ${p.isBot && host0 ? `<button class="btn sm ghost" data-rmbot="${p.id}" title="Botu çıkar">✕</button>` : ''}
      </li>`).join('') + Array.from({ length: room.maxPlayers - room.players.length }, () => '<li class="muted">Boş koltuk…</li>').join('');
    const takenI = new Set(room.players.filter((p) => p !== mine).map((p) => p.icon));
    const takenC = new Set(room.players.filter((p) => p !== mine).map((p) => p.color));
    $('#iconPicker').innerHTML = Object.keys(TOKENS).map((i) => `<button class="chip ${mine && mine.icon === i ? 'sel' : ''} ${takenI.has(i) ? 'taken' : ''}" data-icon="${i}" title="${i}">${TOKENS[i]}</button>`).join('');
    $('#colorPicker').innerHTML = COLORS.map((c) => `<button class="chip ${mine && mine.color === c ? 'sel' : ''} ${takenC.has(c) ? 'taken' : ''}" data-color="${c}" style="background:${c}"></button>`).join('');
    $$('[data-rmbot]').forEach((b) => { b.onclick = () => socket.emit('lobby:bot', { id: b.dataset.rmbot }, handle); });
    $$('[data-icon]').forEach((b) => { b.onclick = () => socket.emit('lobby:token', { icon: b.dataset.icon }); });
    $$('[data-color]').forEach((b) => { b.onclick = () => socket.emit('lobby:token', { color: b.dataset.color }); });
    const host = room.hostId === session.pid;
    $('#startBtn').classList.toggle('hidden', !host);
    $('#startBtn').disabled = room.players.length < 2;
    $('#startBtn').textContent = room.players.length < 2 ? 'En az 2 oyuncu bekleniyor…' : 'Oyunu Başlat';
    $('#waitHost').classList.toggle('hidden', host);
    $('#lobbySettingsBtn').classList.toggle('hidden', !host || room.quick);
  }
  // oda sahibi için masa ayarları
  $('#lobbySettingsBtn').onclick = () => {
    const st = { name: room.name, isPublic: room.isPublic, maxPlayers: room.maxPlayers, startMoney: room.startMoney, roundLimit: room.roundLimit, botLevel: room.botLevel || 'normal' };
    const segH = (key, vals, label) => `<div class="seg" data-k="${key}">${vals.map((v) => `<button type="button" class="${st[key] === v ? 'sel' : ''}" data-v="${v}">${label(v)}</button>`).join('')}</div>`;
    openModal((el) => {
      el.innerHTML = `<h3>Masa ayarları</h3><form class="create-form" id="lobbySetForm">
        <label class="field"><span>Oda adı</span><input id="lsName" maxlength="30" value="${esc(st.name)}"></label>
        <div class="field"><span>Görünürlük</span>${segH('isPublic', [true, false], (v) => (v ? 'Herkese açık' : 'Sadece kodla'))}</div>
        <div class="field"><span>Kişi sayısı</span>${segH('maxPlayers', [2, 3, 4, 5, 6], (v) => `${v} kişi`)}</div>
        <div class="field"><span>Başlangıç parası</span>${segH('startMoney', [1000, 1500, 2000, 2500].map((x) => x * K), money)}</div>
        <div class="field"><span>Tur sınırı</span>${segH('roundLimit', [20, 40, 60, 0], roundLabel)}</div>
        <div class="field"><span>Bot zorluğu</span>${segH('botLevel', LEVEL_KEYS, (v) => LEVEL_NAMES[LEVEL_KEYS.indexOf(v)])}</div>
        <p class="muted small">Giriş ücreti oda kurulduktan sonra değiştirilemez.</p>
        <button class="btn big primary" type="submit">Kaydet</button></form>`;
      $$('.seg[data-k]', el).forEach((sg) => $$('button', sg).forEach((b) => { b.onclick = () => {
        const k = sg.dataset.k, raw = b.dataset.v;
        st[k] = k === 'isPublic' ? raw === 'true' : k === 'botLevel' ? raw : +raw;
        $$('button', sg).forEach((x) => x.classList.toggle('sel', x === b));
      }; }));
      $('#lobbySetForm', el).onsubmit = (e) => { e.preventDefault(); st.name = $('#lsName', el).value; socket.emit('lobby:settings', st, (r) => { if (r && r.error) toast(r.error, 'err'); else { closeModal(); toast('Ayarlar kaydedildi'); } }); };
    });
  };
  $('#startBtn').onclick = () => socket.emit('lobby:start', handle);
  $('#leaveLobbyBtn').onclick = () => socket.emit('room:leave', () => clearSession());
  $('#copyLinkBtn').onclick = async () => {
    const url = `${location.origin}${location.pathname}?oda=${room.code}`;
    try { await navigator.clipboard.writeText(url); toast('Davet linki kopyalandı!'); } catch { prompt('Linki kopyala:', url); }
  };

  // ---------- sohbet ----------
  function renderChat(r) {
    const html = r.chat.map((m) => (m.from ? `<li><b>${esc(m.from)}:</b>${esc(m.text)}</li>` : `<li class="sys">${esc(m.text)}</li>`)).join('');
    ['#lobbyChat', '#gameChat'].forEach((id) => {
      const ul = $(id);
      const atBottom = ul.scrollHeight - ul.scrollTop - ul.clientHeight < 40;
      ul.innerHTML = html;
      if (atBottom) ul.scrollTop = ul.scrollHeight;
    });
    const last = r.chat.length ? r.chat[r.chat.length - 1].seq : 0;
    const chatBody = $('[data-body="chat"]');
    const inDrawer = $('#gameDrawerBody').contains(chatBody);
    const chatOpen = (!chatBody.classList.contains('hidden') && (!inDrawer || drawerOpen())) || r.status === 'lobby';
    if (chatOpen) seenChatSeq = last;
    const unread = r.chat.filter((m) => m.seq > seenChatSeq && m.from).length;
    $('#chatBadge').textContent = unread;
    $('#chatBadge').classList.toggle('hidden', !unread);
    unreadChat = unread; updateMenuBadge();
  }
  $$('[data-chat]').forEach((f) => {
    f.onsubmit = (e) => {
      e.preventDefault();
      const inp = $('input', f);
      if (inp.value.trim()) socket.emit('chat', inp.value);
      inp.value = '';
    };
  });
  $$('.tab[data-tab]').forEach((t) => {
    t.onclick = () => {
      $$('.tab[data-tab]').forEach((x) => x.classList.toggle('active', x === t));
      $$('.tab-body').forEach((b) => b.classList.toggle('hidden', b.dataset.body !== t.dataset.tab));
      if (t.dataset.tab === 'chat' && latest) { renderChat(latest); const ul = $('#gameChat'); ul.scrollTop = ul.scrollHeight; }
    };
  });

  // ---------- tahta ----------
  function gridPos(i) {
    if (i <= 10) return { r: 11, c: 11 - i, side: i % 10 === 0 ? 'corner' : 'bottom' };
    if (i <= 20) return { r: 11 - (i - 10), c: 1, side: i === 20 ? 'corner' : 'left' };
    if (i <= 30) return { r: 1, c: 1 + (i - 20), side: i === 30 ? 'corner' : 'top' };
    return { r: 1 + (i - 30), c: 11, side: 'right' };
  }
  // Türkçe heceye göre uzun kelimeleri ortadan bölünebilir yap (DİYAR-BAKIR, KASTA-MONU)
  function hyph(name) {
    const V = 'AEIİOÖUÜaeıioöuü';
    return name.split(' ').map((w) => {
      if (w.length < 7) return esc(w);
      let best = -1;
      for (let i = 3; i <= w.length - 3; i++) {
        if (!V.includes(w[i]) && V.includes(w[i + 1]) && (best < 0 || Math.abs(i - w.length / 2) < Math.abs(best - w.length / 2))) best = i;
      }
      return best < 0 ? esc(w) : `${esc(w.slice(0, best))}&shy;${esc(w.slice(best))}`;
    }).join(' ');
  }
  const nameCls = (n) => (n.length > 8 ? 'nm long' : 'nm');
  const icon = (k, cls = '') => `<div class="icon ${cls}">${ICON[k]}</div>`;
  function squareHTML(s) {
    switch (s.type) {
      case 'prop': return `<div class="band"></div><div class="ct art-ct"><div class="art">${ART[s.name] || ''}</div><div class="txt"><div class="${nameCls(s.name)}">${esc(s.name)}</div><div class="pr">${money(s.price)}</div><div class="prc">${moneyShort(s.price)}</div></div></div>`;
      case 'station': {
        const k = s.name.includes('Liman') ? 'ship' : s.name.includes('Havalimanı') ? 'plane' : 'train';
        return `<div class="ct"><div class="${nameCls(s.name)}">${esc(s.name)}</div>${icon(k)}<div class="pr">${money(s.price)}</div><div class="prc">${moneyShort(s.price)}</div></div>`;
      }
      case 'utility': return `<div class="ct"><div class="${nameCls(s.name)}">${esc(s.name)}</div>${icon(s.icon, s.icon)}<div class="pr">${money(s.price)}</div><div class="prc">${moneyShort(s.price)}</div></div>`;
      case 'chance': return '<div class="ct"><div class="nm">Şans</div><div class="q">?</div><div></div></div>';
      case 'chest': return `<div class="ct"><div class="nm">Kamu Fonu</div>${icon('chest')}<div></div></div>`;
      case 'tax': return `<div class="ct"><div class="${nameCls(s.name)}">${esc(s.name)}</div>${icon(s.icon)}<div class="pr">${money(s.amount)} öde</div><div class="prc">${moneyShort(s.amount)}</div></div>`;
      case 'go': return `<div class="corner-in"><div class="s">Her geçişte ${money(200 * K)} al</div><div class="t">BAŞLANGIÇ</div></div><div class="go-arrow">${ICON.arrow}</div>`;
      case 'jail': return '<div class="jail-cell"><div class="barsv"></div><div class="t">HAPİS</div></div><div class="visit v1"><span>SADECE</span></div><div class="visit v2">ZİYARET</div>';
      case 'parking': return `<div class="corner-in"><div class="t">ÜCRETSİZ</div>${icon('car')}<div class="t">OTOPARK</div></div>`;
      case 'gotojail': return `<div class="corner-in"><div class="t">HAPSE</div>${icon('cuffs')}<div class="t">GİR</div></div>`;
      default: return '';
    }
  }
  const LAKES = [
    [[42.3, 38.55], [42.6, 38.92], [43.2, 38.86], [43.6, 38.55], [43.2, 38.33], [42.8, 38.45]],
    [[33.2, 38.95], [33.55, 38.97], [33.62, 38.6], [33.35, 38.52], [33.22, 38.7]],
  ];
  function buildMap() {
    const pts = (arr) => arr.map((p) => PROJ(p).join(',')).join(' ');
    const land = `<polygon points="${pts(THRACE)}"/><polygon points="${pts(ANATOLIA)}"/>`;
    let side = '';
    for (let k = 22; k >= 2; k -= 2) side += `<g transform="translate(0 ${k})" fill="${k > 12 ? '#4e7a3c' : '#6a9a4e'}">${land}</g>`;
    let html = `<defs>
        <linearGradient id="landTop" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#eef6d2"/><stop offset=".55" stop-color="#c9e2a0"/><stop offset="1" stop-color="#9fc97a"/></linearGradient>
        <radialGradient id="seaGlow" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#5fb3dc" stop-opacity=".45"/><stop offset=".7" stop-color="#5fb3dc" stop-opacity=".15"/><stop offset="1" stop-color="#5fb3dc" stop-opacity="0"/></radialGradient>
        <filter id="mapShadow" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="26" stdDeviation="14" flood-color="#0d3550" flood-opacity=".35"/></filter>
        <filter id="pinShadow"><feGaussianBlur stdDeviation="2"/></filter>
      </defs>
      <ellipse cx="755" cy="330" rx="900" ry="420" fill="url(#seaGlow)"/>
      <text class="sea" x="760" y="-62">KARADENİZ</text><text class="sea" x="520" y="735">AKDENİZ</text><text class="sea" x="-20" y="470" transform="rotate(-70 -20 470)">EGE</text>
      <g filter="url(#mapShadow)">${side}<g class="land-top" fill="url(#landTop)" stroke="#fff7df" stroke-width="3" stroke-linejoin="round">${land}</g></g>
      <g fill="#6db7e2" stroke="#3f8fc0" stroke-width="2">${LAKES.map((l) => `<polygon points="${pts(l)}"/>`).join('')}</g>`;
    BOARD.squares.filter((s) => s.type === 'prop' && CITY[s.name]).forEach((s) => {
      const [x, y] = PROJ(CITY[s.name]);
      const [anchor, dx, dy] = LABEL[s.name] || ['middle', 0, -18];
      const hy = +y - 26;
      html += `<g class="city" data-city="${s.index}"><ellipse cx="${x}" cy="${y}" rx="9" ry="4" fill="#000" opacity=".3" filter="url(#pinShadow)"/><path d="M${x} ${y}V${hy}" stroke="#2a3f52" stroke-width="3.5" stroke-linecap="round"/><circle class="ring" cx="${x}" cy="${hy}" r="18"/><circle class="dot" cx="${x}" cy="${hy}" r="11" fill="${groupColor(s)}" stroke="#fff" stroke-width="3"/><circle cx="${+x - 3.5}" cy="${hy - 3.5}" r="3.5" fill="#fff" opacity=".6"/><text x="${+x + dx}" y="${hy + dy}" text-anchor="${anchor}">${esc(s.name)}</text></g>`;
    });
    $('#map').innerHTML = html;
  }
  function buildBoard() {
    const b = $('#board');
    $$('.sq', b).forEach((x) => x.remove());
    BOARD.squares.forEach((s, i) => {
      const { r, c, side } = gridPos(i);
      const d = document.createElement('div');
      d.className = `sq ${side} ${s.type}${side === 'corner' ? ' corner' : ''}`;
      d.style.gridRow = r; d.style.gridColumn = c;
      d.style.setProperty('--gc', groupColor(s));
      d.dataset.idx = i;
      d.innerHTML = squareHTML(s);
      d.title = s.name;
      d.onclick = () => openDeed(i);
      b.appendChild(d);
    });
    buildMap();
    $('#die1').innerHTML = cubeHTML(); $('#die2').innerHTML = cubeHTML();
    boardBuilt = true; load3D();
  }
  const sqEl = (i) => $(`.sq[data-idx="${i}"]`);

  function updateBoard(g, prev, fast) {
    BOARD.squares.forEach((s, i) => {
      const pr = g.props[i];
      if (!pr) return;
      const pp = prev && prev.props[i];
      const el = sqEl(i);
      el.classList.toggle('mortgaged', pr.mortgaged);
      let flag = $('.owner-flag', el);
      const owner = pr.owner && playerById(pr.owner);
      el.classList.toggle('owned', !!owner);
      const city = $(`.city[data-city="${i}"]`);
      if (city) {
        city.classList.toggle('owned', !!owner);
        $('.ring', city).setAttribute('stroke', owner ? owner.color : 'none');
      }
      if (owner) {
        el.style.setProperty('--oc', owner.color);
        if (!flag) { flag = document.createElement('div'); flag.className = 'owner-flag'; el.appendChild(flag); }
        flag.style.background = owner.color;
        flag.title = `Sahibi: ${owner.name}`;
        if (!fast && pp && pp.owner !== pr.owner) {
          stamp(i, owner.color, pp.owner ? 'DEVREDİLDİ' : 'SATILDI!');
          if (city) { city.classList.remove('flash'); void city.getBBox(); city.classList.add('flash'); }
        }
      } else if (flag) flag.remove();
      if (V3) V3.setProp(i, owner ? owner.color : null, s.type === 'prop' ? pr.houses : 0, pr.mortgaged);
      if (V3 && !fast && pp && s.type === 'prop' && pr.houses > pp.houses) { V3.popBuilding(i); V3.fx('build', i); }
      if (s.type === 'prop') {
        const band = $('.band', el);
        band.innerHTML = pr.houses === 5 ? '<i class="hotel"></i>' : pr.houses ? '<i class="house"></i>'.repeat(pr.houses) + `<b class="hcount">${pr.houses}</b>` : '';
        el.title = `${s.name}${pr.houses ? ` · ${pr.houses === 5 ? '1 otel' : `${pr.houses} ev`}` : ''}`;
        if (!fast && pp && pr.houses > pp.houses) { band.classList.remove('pop'); void band.offsetWidth; band.classList.add('pop'); stamp(i, '#18a04a', pr.houses === 5 ? 'OTEL!' : 'EV!'); }
      }
    });
  }
  function stamp(i, color, text) {
    if (V3) {   // 3D tahtada karenin üstünde damga
      const pt = V3.squareScreen(i), st = document.createElement('div');
      st.className = 'stamp3d'; st.style.setProperty('--sc', color); st.textContent = text;
      st.style.left = `${pt.x}px`; st.style.top = `${pt.y}px`;
      $('#fx').appendChild(st); setTimeout(() => st.remove(), 1900);
      return;
    }
    const st = document.createElement('div');
    st.className = 'stamp';
    st.style.setProperty('--sc', color);
    st.textContent = text;
    sqEl(i).appendChild(st);
    setTimeout(() => st.remove(), 1900);
  }
  function pulseSquare(i) {
    if (V3) V3.pulse(i);
    const el = sqEl(i); if (!el) return;
    el.classList.remove('highlight'); void el.offsetWidth; el.classList.add('highlight');
    setTimeout(() => el.classList.remove('highlight'), 1900);
  }

  // ---------- piyonlar ----------
  function ensurePawns(g) {
    g.players.forEach((p) => {
      if (!pawnEls[p.id]) {
        const d = document.createElement('div');
        d.className = 'pawn';
        d.innerHTML = `<div class="p-shadow"></div><div class="p-ring"></div><div class="p-fig">${pawnSVG(p.color, p.id)}</div>`;
        d.style.setProperty('--c', p.color);
        d.title = p.name;
        $('#tokenLayer').appendChild(d);
        pawnEls[p.id] = d;
      }
      if (V3) V3.ensurePawn(p.id, p.token, p.color);
      if (shownPos[p.id] === undefined) shownPos[p.id] = p.pos;
    });
  }
  function styleOfPawns(g) {
    g.players.forEach((p) => {
      const el = pawnEls[p.id]; if (!el) return;
      el.style.display = p.bankrupt ? 'none' : '';
      el.classList.toggle('cur', g.turn === p.id && g.phase !== 'gameover');
      if (V3) V3.setVisible(p.id, !p.bankrupt);
    });
    if (V3) V3.setTurn(g.phase !== 'gameover' ? g.turn : null);
  }
  function layoutPawns(animate = true) {
    const g = game(); if (!g || !boardBuilt) return;
    const groups = {};
    g.players.filter((p) => !p.bankrupt && pawnEls[p.id]).forEach((p) => {
      const pos = shownPos[p.id];
      const key = pos === 10 && p.inJail && p.pos === 10 ? 'jail' : String(pos);
      (groups[key] ||= []).push(p.id);
    });
    if (V3) V3.layout(groups, animate);
    for (const [key, ids] of Object.entries(groups)) {
      const el = sqEl(key === 'jail' ? 10 : key); if (!el) continue;
      let cx = el.offsetLeft + el.offsetWidth / 2, cy = el.offsetTop + el.offsetHeight / 2;
      let rad = Math.min(el.offsetWidth, el.offsetHeight) * 0.24;
      if (key === 'jail') { cx = el.offsetLeft + el.offsetWidth * 0.67; cy = el.offsetTop + el.offsetHeight * 0.3; rad *= 0.6; }
      else if (key === '10') { cx = el.offsetLeft + el.offsetWidth * 0.22; cy = el.offsetTop + el.offsetHeight * 0.8; rad *= 0.5; }
      if (ids.length === 1) rad = 0;
      ids.forEach((id, k) => {
        const a = (k / ids.length) * Math.PI * 2 - Math.PI / 2;
        const pe = pawnEls[id];
        if (!animate) pe.style.transition = 'none';
        pe.style.left = `${cx + Math.cos(a) * rad}px`;
        pe.style.top = `${cy + Math.sin(a) * rad}px`;
        pe.style.zIndex = String(Math.round(cy + Math.sin(a) * rad)); // önde duran piyon üstte görünsün
        if (!animate) { void pe.offsetWidth; pe.style.transition = ''; }
      });
    }
  }
  function setPawn(pid, pos, mode, dur) {
    shownPos[pid] = pos;
    const pe = pawnEls[pid]; if (!pe) return;
    // gidiş yönüne doğru eğilsin
    const from = sqEl(pe.dataset.at || pos), to = sqEl(pos);
    if (from && to) pe.style.setProperty('--lean', `${Math.sign(to.offsetLeft - from.offsetLeft) * 9 || Math.sign(from.offsetTop - to.offsetTop) * 4}deg`);
    pe.dataset.at = pos;
    if (V3) V3.step(pid, mode, dur);
    pe.classList.remove('hop', 'jump');
    if (mode === 'hop') { pe.style.transition = `left ${dur}ms ease, top ${dur}ms ease`; pe.style.setProperty('--hd', `${dur}ms`); void pe.offsetWidth; pe.classList.add('hop'); }
    else if (mode === 'jump') { pe.style.transition = ''; void pe.offsetWidth; pe.classList.add('jump'); }
    layoutPawns(mode !== 'none');
  }
  function pathOf(m) {
    const path = [];
    if (m.kind === 'back') { for (let p = m.from; p !== m.to;) { p = (p + 39) % 40; path.push(p); } }
    else { for (let p = m.from; p !== m.to;) { p = (p + 1) % 40; path.push(p); } }
    return path;
  }
  const stepFor = (len) => (len > 12 ? Math.max(70, Math.round(2400 / len)) : STEP_MS);
  const JAIL_MS = 2500;
  // Şans / Kamu Fonu karesine gelindiyse: önce kart gösterilsin, sonra kartın hareketi yapılsın
  const CARD_PAUSE = REDUCED ? 0 : 2600, CARD_PAUSE_END = REDUCED ? 0 : 1500;
  function cardStopIndex(moves, g, prev) {
    if (!g.card || !prev || (prev.card && prev.card.seq === g.card.seq)) return -1;
    return (moves || []).findIndex((m) => m.kind !== 'jail' && m.pid === g.card.player && ['chance', 'chest'].includes(sq(m.to).type));
  }
  const pauseFor = (moves, stop) => (stop < 0 ? 0 : stop < moves.length - 1 ? CARD_PAUSE : CARD_PAUSE_END);
  function movesDuration(moves, stop = -1) {
    return (moves || []).reduce((t, m) => t + (m.kind === 'jail' ? JAIL_MS : pathOf(m).length * stepFor(pathOf(m).length) + 80), 0) + pauseFor(moves || [], stop);
  }
  function animateMoves(moves, g, stop = -1, prev = null) {
    let t = 0;
    for (const [mi, m] of moves.entries()) {
      if (mi > 0 && mi === stop + 1) {
        // kartın götürdüğü yeri de kısaca göster
        const nm = m;
        after(t - 450, () => previewTarget([nm], 450));
      }
      if (m.kind === 'jail') {
        after(t, () => { jailFx(m.pid); sfx('jail'); after(600, () => setPawn(m.pid, 10, 'jump')); });
        t += JAIL_MS;
        continue;
      }
      const path = pathOf(m), step = stepFor(path.length);
      path.forEach((pos, k) => after(t + k * step, () => { if (pos === 0 && V3 && m.kind !== 'back') V3.fx('go', 0); setPawn(m.pid, pos, 'hop', step); sqEl(pos).classList.remove('path'); if (V3) V3.removeStep(pos); if (path.length <= 12) sfx('step'); }));
      t += path.length * step;
      const to = m.to;
      after(t, () => pulseSquare(to));
      t += 80;
      if (mi === stop) { after(t, () => showCard(g, prev)); t += pauseFor(moves, stop); }
    }
    after(t, () => snapTokens(g));
    return t;
  }
  // Piyon yola çıkmadan önce gideceği kare (ve yol) parlasın
  function previewTarget(moves, holdMs) {
    const m = moves.find((x) => x.kind !== 'jail') || moves[0];
    $$('.sq.target, .sq.path').forEach((x) => x.classList.remove('target', 'path'));
    if (!m) return;
    const to = m.kind === 'jail' ? 10 : m.to;
    if (m.kind !== 'jail') pathOf(m).slice(0, -1).forEach((i, k) => after(k * 40, () => sqEl(i).classList.add('path')));
    const el = sqEl(to); el.classList.add('target');
    if (V3) V3.preview(m.kind !== 'jail' ? pathOf(m).slice(0, -1) : [], to);
    const clear = holdMs ? holdMs + movesDuration(moves) + 150 : movesDuration(moves) + PREVIEW_MS + 200;
    setTimeout(() => { $$('.sq.target, .sq.path').forEach((x) => x.classList.remove('target', 'path')); if (V3) V3.clearPreview(); }, clear);
  }
  function snapTokens(g) {
    g.players.forEach((p) => { shownPos[p.id] = p.pos; });
    layoutPawns(true);
  }

  // ---------- 3D zar ----------
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const FACE_ROT = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };
  const spin = [[0, 0], [0, 0]];
  function cubeHTML() {
    return `<div class="cube">${[1, 2, 3, 4, 5, 6].map((n) => `<div class="face f${n}">${Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[n].includes(i) ? 'on' : ''}"></i>`).join('')}</div>`).join('')}</div>`;
  }
  function setDice([a, b], roll) {
    if (V3) V3.setDice([a, b], roll, DICE_MS || 1000);
    [a, b].forEach((n, i) => {
      const die = $(`#die${i + 1}`), cube = $('.cube', die);
      if (!cube) return;
      if (roll) {
        spin[i][0] += 720 + 360 * Math.floor(Math.random() * 2);
        spin[i][1] += 720 + 360 * Math.floor(Math.random() * 2);
        cube.style.transition = `transform ${DICE_MS - 100}ms cubic-bezier(.12,.75,.28,1)`;
        die.classList.remove('tumble'); void die.offsetWidth; die.classList.add('tumble');
      } else cube.style.transition = 'none';
      const [fx, fy] = FACE_ROT[n];
      cube.style.transform = `rotateX(${spin[i][0] + fx}deg) rotateY(${spin[i][1] + fy}deg)`;
    });
  }

  // ---------- efektler ----------
  function banner(text, color) {
    const b = $('#banner');
    b.className = 'banner';
    if (color) b.style.setProperty('--bc', color); else b.style.removeProperty('--bc');
    b.textContent = text;
    clearTimeout(banner.t);
    banner.t = setTimeout(() => b.classList.add('hidden'), 1750);
  }
  function burst(text, x = '50%', y = '30%') {
    const el = document.createElement('div');
    el.className = 'burst';
    el.textContent = text;
    el.style.left = x; el.style.top = y;
    $('#center').appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }
  function announce(p, idx, label, price) {
    const s = sq(idx), el = $('#announce');
    el.className = 'announce';
    el.style.setProperty('--ac', p.color);
    el.innerHTML = `<div class="ann-deed"><div class="mh" style="background:${groupColor(s)}"><small>TAPU SENEDİ</small>${esc(s.name)}</div><div class="mb">${money(price)}</div></div>
      <div class="ann-text">${esc(p.name)}<small>${label}</small></div>`;
    clearTimeout(announce.t);
    announce.t = setTimeout(() => el.classList.add('hidden'), 2300);
  }
  function jailFx(pid) {
    const p = playerById(pid);
    const fx = $('#jailFx');
    fx.classList.add('hidden'); void fx.offsetWidth;
    $('#jailText').innerHTML = `${esc(p ? p.name : '')}<small>HAPSE GİRDİ!</small>`;
    fx.classList.remove('hidden');
    const frame = $('.board-frame');
    after(550, () => { if (V3) V3.shake(); frame.classList.remove('shake'); void frame.offsetWidth; frame.classList.add('shake'); });
    after(1400, () => { const j = sqEl(10); j.classList.remove('slam'); void j.offsetWidth; j.classList.add('slam'); });
    clearTimeout(jailFx.t);
    jailFx.t = setTimeout(() => fx.classList.add('hidden'), 2450);
  }
  const centerOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  function rowPoint(pid) { const li = $(`#playerList li[data-pid="${pid}"]`); return li ? centerOf($('.cash', li) || li) : null; }
  function pawnPoint(pid) { if (V3) return V3.pawnScreen(pid); const pe = pawnEls[pid]; return pe && pe.style.display !== 'none' ? centerOf(pe) : null; }
  const bankPoint = () => (V3 ? V3.centerScreen() : centerOf($('#diceRow')));
  function flyNotes(from, to, amount) {
    if (!from || !to || REDUCED) return;
    const count = Math.min(5, 1 + Math.floor(Math.log10(Math.max(1, amount / K)) * 1.4));
    const d = noteFor(amount);
    for (let k = 0; k < count; k++) {
      const el = document.createElement('div');
      el.className = 'fly-note';
      el.innerHTML = noteSVG(d);
      el.style.left = `${from.x}px`; el.style.top = `${from.y}px`;
      $('#fx').appendChild(el);
      const dx = to.x - from.x, dy = to.y - from.y;
      const lift = -Math.min(160, 60 + Math.hypot(dx, dy) * 0.25);
      const rot = (Math.random() * 2 - 1) * 200;
      el.animate([
        { transform: 'translate(0,0) rotate(0) scale(.4)', opacity: 0 },
        { transform: `translate(${dx * 0.15}px,${dy * 0.15 + lift * 0.5}px) rotate(${rot * 0.2}deg) scale(1)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${dx * 0.55}px,${dy * 0.55 + lift}px) rotate(${rot * 0.6}deg) scale(1.05)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg) scale(.5)`, opacity: 0 },
      ], { duration: 1000, delay: k * 110, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'both' }).onfinish = () => el.remove();
    }
  }
  function floatText(pt, html, cls) {
    if (!pt) return;
    const el = document.createElement('div');
    el.className = `float-txt ${cls}`;
    el.innerHTML = html;
    el.style.left = `${pt.x}px`; el.style.top = `${pt.y}px`;
    $('#fx').appendChild(el);
    const b = $('#game').classList.contains('hidden') ? null : $('#gl3d').getBoundingClientRect();
    const w = el.offsetWidth / 2 + 4, inBoard = b && pt.x >= b.left && pt.x <= b.right && pt.y >= b.top && pt.y <= b.bottom;
    const lo = inBoard ? b.left + w : w, hi = inBoard ? b.right - w : window.innerWidth - w;
    if (hi > lo) el.style.left = `${Math.min(hi, Math.max(lo, pt.x))}px`;
    el.animate([
      { transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 },
      { transform: 'translate(-50%,-90%) scale(1.2)', opacity: 1, offset: 0.2 },
      { transform: 'translate(-50%,-250%) scale(1)', opacity: 0 },
    ], { duration: 1500, easing: 'ease-out', fill: 'both' }).onfinish = () => el.remove();
  }
  function flashRow(pid, cls) {
    const li = $(`#playerList li[data-pid="${pid}"]`); if (!li) return;
    li.classList.remove('gain', 'loss'); void li.offsetWidth; li.classList.add(cls);
  }
  const potPoint = () => { if (V3) return V3.potScreen(); const el = $('#pot'); return el && !el.classList.contains('hidden') ? centerOf(el) : centerOf($('#center')); };
  function renderPot(g, prev, fast) {
    const el = $('#pot'), pot = g.pot || 0;
    if (!pot) { if (!el.classList.contains('hidden') && prev && prev.pot && !fast) { el.classList.add('emptying'); setTimeout(() => { el.classList.add('hidden'); el.classList.remove('emptying'); }, 700); } else el.classList.add('hidden'); return; }
    el.classList.remove('hidden', 'emptying');
    // yığındaki banknot sayısı tutarla büyür
    const n = Math.min(12, 2 + Math.floor(Math.log2(pot / (25 * K)) * 1.6));
    const dens = [500, 100, 50, 100, 20, 500, 50, 100, 10, 1000, 50, 100].map((d) => d * K);
    $('#potNotes').innerHTML = Array.from({ length: Math.max(1, n) }, (_, k) => {
      const r = ((k * 47) % 50) - 25, x = ((k * 29) % 36) - 18, y = -k * 2.2;
      return `<div class="pn" style="transform:translate(${x}%, ${y}%) rotate(${r}deg)">${noteSVG(dens[k % dens.length])}</div>`;
    }).join('');
    $('#potAmount').innerHTML = money(pot);
    if (prev && pot > (prev.pot || 0) && !fast) { el.classList.remove('grow'); void el.offsetWidth; el.classList.add('grow'); }
  }
  function moneyFx(prev, g) {
    const potDelta = (g.pot || 0) - (prev.pot || 0);
    const meId = session && session.pid;
    const deltas = g.players.map((p) => {
      const o = prev.players.find((x) => x.id === p.id);
      return { id: p.id, d: o ? p.cash - o.cash : 0 };
    }).filter((x) => x.d !== 0);
    const pos = deltas.filter((x) => x.d > 0), neg = deltas.filter((x) => x.d < 0);
    neg.forEach((n) => {
      const mi = pos.findIndex((p) => p.d === -n.d);
      if (mi >= 0) {
        const p = pos.splice(mi, 1)[0];
        flyNotes(pawnPoint(n.id) || rowPoint(n.id), rowPoint(p.id), -n.d);
        after(700, () => { floatText(rowPoint(p.id), `+${money(p.d)}`, 'plus'); flashRow(p.id, 'gain'); });
      } else flyNotes(pawnPoint(n.id) || rowPoint(n.id), potDelta > 0 ? potPoint() : bankPoint(), -n.d);
      if (n.id === meId) sfx('pay');
      floatText(pawnPoint(n.id) || rowPoint(n.id), money(n.d), 'minus');
      flashRow(n.id, 'loss');
    });
    pos.forEach((p) => {
      const jackpot = potDelta < 0 && p.d >= -potDelta;
      if (jackpot) {
        const who = playerById(p.id);
        banner(`${who ? who.name : ''} KASAYI KAPTI!`, '#1f9d55');
        if (V3) V3.fx('jackpot', 20);
        sfx('jackpot');
        for (let k = 0; k < 3; k++) after(k * 220, () => flyNotes(potPoint(), pawnPoint(p.id) || rowPoint(p.id), -potDelta));
        after(900, () => { floatText(pawnPoint(p.id) || rowPoint(p.id), `+${money(p.d)}`, 'plus'); flashRow(p.id, 'gain'); });
        return;
      }
      if (p.id === meId) sfx('coin');
      flyNotes(bankPoint(), rowPoint(p.id), p.d);
      after(650, () => { floatText(rowPoint(p.id), `+${money(p.d)}`, 'plus'); flashRow(p.id, 'gain'); });
    });
  }
  function tweenCash(pid, to, fast) {
    const from = cashShown[pid] === undefined ? to : cashShown[pid];
    if (fast || from === to) { cashShown[pid] = to; cashTweens[pid] = null; return; }
    cashTweens[pid] = { from, to, start: performance.now(), dur: 900 };
    requestAnimationFrame(tickCash);
  }
  function tickCash(t) {
    let more = false;
    for (const [pid, tw] of Object.entries(cashTweens)) {
      if (!tw) continue;
      const k = Math.min(1, (t - tw.start) / tw.dur);
      const v = tw.from + (tw.to - tw.from) * (1 - (1 - k) ** 3);
      cashShown[pid] = k === 1 ? tw.to : Math.round(v / 1000) * 1000;
      const el = $(`.cash[data-cash="${pid}"]`);
      if (el && !el.dataset.dead) { el.innerHTML = money(cashShown[pid]); el.classList.toggle('neg', cashShown[pid] < 0); }
      if (k < 1) more = true; else cashTweens[pid] = null;
    }
    if (more) requestAnimationFrame(tickCash);
  }

  let cardHide = null;
  let shownCardSeq = 0;
  function showCard(g, prev) {
    if (!g.card || !prev || (prev.card && prev.card.seq === g.card.seq)) return;
    if (shownCardSeq === g.card.seq) return;   // hareket sırasında zaten gösterildi
    shownCardSeq = g.card.seq;
    const p = playerById(g.card.player);
    const el = $('#cardPop');
    const ch = g.card.deck === 'chance';
    const deck = ch ? $('#deckChance') : $('#deckChest');
    sfx('card');
    deck.classList.remove('draw'); void deck.offsetWidth; deck.classList.add('draw');
    if (V3) V3.drawDeck(g.card.deck);
    el.className = `card-pop ${g.card.deck}`;
    el.style.setProperty('--ox', ch ? '34cqw' : '-34cqw');
    el.style.setProperty('--oy', '-24cqw');
    el.style.setProperty('--or', ch ? '11deg' : '-11deg');
    el.innerHTML = `<div class="ci"><div class="cf"><h4>${ch ? 'ŞANS' : 'KAMU FONU'}</h4><div>${fmtText(g.card.text)}</div><small class="muted">${esc(p ? p.name : '')}</small></div><div class="cb">${ch ? '?' : '<span class="cur">B</span>'}</div></div>`;
    clearTimeout(cardHide);
    const hide = () => { el.classList.add('out'); setTimeout(() => el.classList.add('hidden'), 400); };
    cardHide = setTimeout(hide, 4800);
    el.onclick = hide;
  }

  function confetti() {
    if (REDUCED) return;
    const cv = $('#confetti'), ctx = cv.getContext('2d');
    cv.width = innerWidth; cv.height = innerHeight;
    const cols = ['#d7263d', '#f2b632', '#1d5fd0', '#1f9d55', '#ff4fa3', '#9b5de5'];
    const parts = Array.from({ length: 220 }, () => ({
      x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * 0.5, vx: Math.random() * 4 - 2, vy: 2 + Math.random() * 4,
      w: 6 + Math.random() * 8, h: 8 + Math.random() * 10, r: Math.random() * 6, vr: Math.random() * 0.3 - 0.15, c: cols[Math.floor(Math.random() * cols.length)],
    }));
    const t0 = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      parts.forEach((p) => {
        p.x += p.vx + Math.sin((t + p.y) / 300); p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      });
      if (t - t0 < 6000) requestAnimationFrame(frame); else ctx.clearRect(0, 0, cv.width, cv.height);
    })(t0);
  }

  // ---------- oyun ekranı ----------
  // oyun başlarken 3-2-1
  let countFor = null;
  function countdown(g) {
    const left = (g.startsAt || 0) - now();
    if (left <= 150 || countFor === g.startsAt) return;
    countFor = g.startsAt;
    const el = $('#countdown'), num = $('#countNum');
    el.classList.remove('hidden');
    const tick = () => {
      const ms = g.startsAt - now();
      const n = Math.ceil(ms / 1000);
      if (ms <= 0) { num.textContent = 'BAŞLA!'; num.className = 'go'; sfx('turn'); setTimeout(() => el.classList.add('hidden'), 700); return; }
      if (num.textContent !== String(Math.min(3, n))) { num.textContent = String(Math.min(3, n)); num.className = ''; void num.offsetWidth; num.className = 'pop'; sfx('step'); }
      setTimeout(tick, Math.min(250, ms));
    };
    tick();
  }
  let gameKey = null;
  function applyGame(s, fast) {
    room = s;
    const g = s.game;
    const key = `${s.code}:${g.startsAt}`;
    if (key !== gameKey) {          // yeni oyun: önceki oyunun piyonları/binaları kalmasın
      gameKey = key;
      if (V3) V3.reset();
      [shownPos, pawnEls, cashShown].forEach((o) => Object.keys(o).forEach((k) => delete o[k]));
      $('#tokenLayer').innerHTML = '';
      if (prevGame && prevGame.startsAt !== g.startsAt) { prevGame = null; fast = true; }
    }
    countdown(g);
    const prev = prevGame;
    prevGame = g;
    showScreen('game');
    if (!boardBuilt) { fitLayout(); buildBoard(); fast = true; }
    $('#gameRoomName').textContent = s.name;
    $('#gameCode').textContent = s.code;
    ensurePawns(g);
    styleOfPawns(g);
    if (fast) { snapTokens(g); layoutPawns(false); }

    const rolled = prev && g.rollId !== prev.rollId;
    const animate = !fast && rolled;
    const diceT = animate ? DICE_MS : 0;
    const hasMoves = animate && g.moves && g.moves.length;
    const stop = hasMoves ? cardStopIndex(g.moves, g, prev) : -1;
    const moveT = hasMoves ? PREVIEW_MS + movesDuration(g.moves, stop) : 0;
    if (animate) sfx('dice');
    setDice(g.dice, animate);
    if (animate && g.dice[0] === g.dice[1]) after(diceT - 150, () => burst('ÇİFT!', '50%', '28%'));
    const ds = $('#diceSum');
    if (g.rollId) { after(animate ? diceT - 250 : 0, () => { ds.textContent = `= ${g.dice[0] + g.dice[1]}`; ds.classList.remove('hidden', 'pop'); void ds.offsetWidth; if (animate) ds.classList.add('pop'); }); }
    else ds.classList.add('hidden');
    after(diceT, () => {
      if (hasMoves) { previewTarget(g.moves); after(PREVIEW_MS, () => animateMoves(g.moves, g, stop, prev)); }
      else snapTokens(g);
      after(moveT, () => renderMain(g, prev, fast));
    });
    return diceT + moveT + (fast ? 0 : 120);
  }

  function renderMain(g, prev, fast) {
    updateBoard(g, prev, fast);
    styleOfPawns(g);
    layoutPawns(true);
    renderPlayers(g, fast);
    if (!fast && prev) moneyFx(prev, g);
    renderPot(g, prev, fast);
    if (V3) { V3.setBank(g.housesLeft, g.hotelsLeft); V3.setPot(g.pot || 0); }
    const bs = $('#bankStock');
    bs.innerHTML = `<span class="bs-l">BANKA</span><span class="bs-i ${g.housesLeft <= 6 ? 'low' : ''}" title="Kalan ev"><i class="bs-house"></i>${g.housesLeft}</span><span class="bs-i ${g.hotelsLeft <= 3 ? 'low' : ''}" title="Kalan otel"><i class="bs-hotel"></i>${g.hotelsLeft}</span>`;
    sqEl(20).classList.toggle('has-pot', (g.pot || 0) > 0);
    renderCenter(g);
    renderLog(g);
    renderTrades(g);
    if (!fast && prev) {
      // satın alma duyurusu
      const bought = Object.keys(g.props).filter((i) => g.props[i].owner && !prev.props[i].owner);
      if (bought.length === 1) {
        const i = +bought[0], p = playerById(g.props[i].owner);
        const viaAuction = prev.phase === 'auction' && prev.auction;
        const o = prev.players.find((x) => x.id === p.id);
        const paid = o ? o.cash - p.cash : sq(i).price;
        announce(p, i, viaAuction ? 'AÇIK ARTIRMADA ALDI!' : 'SATIN ALDI!', paid > 0 ? paid : sq(i).price);
        if (V3) V3.fx('buy', i, p.color);
        sfx('buy');
      }
      showCard(g, prev);
      const m = me();
      if (prev.turn !== g.turn && m && g.turn === m.id && g.phase !== 'gameover') after(bought.length ? 2300 : 0, () => { banner('SIRA SENDE!', m.color); sfx('turn'); });
      g.players.forEach((p) => {
        const o = prev.players.find((x) => x.id === p.id);
        if (o && !o.bankrupt && p.bankrupt) banner(`${p.name} İFLAS ETTİ!`, '#333');
      });
    }
    if (modalRender) { const body = $('#modalBody'); const st = body.parentElement.scrollTop; body.innerHTML = ''; modalRender(body); body.parentElement.scrollTop = st; }
    renderGameOver(g);
  }

  function renderPlayers(g, fast) {
    if ($('#game').classList.contains('many') !== g.players.length > 4) { $('#game').classList.toggle('many', g.players.length > 4); fitLayout(); }
    $('#playerList').innerHTML = g.players.map((p) => {
      const owned = Object.entries(g.props).filter(([, pr]) => pr.owner === p.id).map(([i]) => +i).sort((a, b) => a - b);
      const mini = owned.map((i) => `<i style="background:${groupColor(sq(i))};${g.props[i].mortgaged ? 'opacity:.3' : ''}" title="${esc(sq(i).name)}"></i>`).join('');
      const shown = cashShown[p.id] === undefined ? p.cash : cashShown[p.id];
      return `<li class="${g.turn === p.id ? 'turn' : ''} ${p.bankrupt ? 'dead' : ''}" data-pid="${p.id}" style="--c:${p.color}">
        ${chip(p)}
        <div style="flex:1;min-width:0">
          <div class="pname" title="${esc(p.name)}">${p.id === session.pid ? '<b style="color:var(--red)">●</b> ' : ''}<span class="pn">${esc(p.name)}</span>
            ${p.inJail ? '<span class="badge-s jail">hapiste</span>' : ''}
            ${p.inDebt ? '<span class="badge-s debt">borçlu</span>' : ''}
            ${!p.connected && !p.bankrupt ? '<span class="badge-s off">çevrimdışı</span>' : ''}
            ${p.jailCards.length ? `<span class="badge-s" title="Hapisten çıkış kartı">Kart×${p.jailCards.length}</span>` : ''}
          </div>
          <div class="mini">${mini}</div>
        </div>
        <span class="cash ${shown < 0 ? 'neg' : ''}" data-cash="${p.id}" ${p.bankrupt ? 'data-dead="1"' : ''}>${p.bankrupt ? 'İFLAS' : money(shown)}</span>
      </li>`;
    }).join('');
    $$('#playerList li').forEach((li) => { li.onclick = () => openProps(li.dataset.pid); });
    g.players.forEach((p) => tweenCash(p.id, p.cash, fast));
  }

  const phaseText = { roll: 'zar atacak', buy: 'satın alma kararı veriyor', auction: 'açık artırma sürüyor', end: 'turunu bitirecek', gameover: 'oyun bitti' };
  const rentLabel = (s) => (s.type === 'prop' ? money(s.rent[0]) : s.type === 'station' ? money(25 * K) : `zar × ${money(4 * K)}`);
  function miniDeed(i) {
    const s = sq(i);
    return `<div class="mini-deed"><div class="mh" style="background:${groupColor(s)}">${esc(s.name)}</div><div class="mb"><span>Fiyat <b>${money(s.price)}</b></span><span>Kira <b>${rentLabel(s)}</b></span></div></div>`;
  }
  // Zar sonrası nereye gelindiğini ve neler olduğunu gösteren panel
  function renderLanding(g) {
    const el = $('#landing');
    const mv = g.moves && g.moves.length ? g.moves[g.moves.length - 1] : null;
    $$('.sq.landed').forEach((x) => x.classList.remove('landed'));
    if (V3) V3.landed(mv && g.phase !== 'gameover' ? mv.to : null);
    if (!mv || g.phase === 'gameover') { el.classList.add('hidden'); return; }
    const p = playerById(mv.pid), s = sq(mv.to);
    sqEl(mv.to).classList.add('landed');
    const evs = g.log.filter((l) => l.seq > g.rollLogSeq + 1 && !/zar attı|Sıra .* oyuncusunda/.test(l.text)).slice(0, 3);
    const pic = s.type === 'prop' ? (ART[s.name] || '') : s.type === 'chance' ? '<b class="q">?</b>' : ICON[{ station: s.name.includes('Liman') ? 'ship' : s.name.includes('Havalimanı') ? 'plane' : 'train', utility: s.icon, tax: s.icon, chest: 'chest', gotojail: 'cuffs', parking: 'car', go: 'arrow', jail: 'cuffs' }[s.type]] || '';
    const isMe = m0() && p && p.id === m0().id;
    el.classList.remove('hidden');
    el.style.setProperty('--gc', groupColor(s));
    el.innerHTML = `<div class="l-pic">${pic}</div><div class="l-txt"><div class="l-title">${p ? `${isMe ? 'Sen' : esc(p.name)} <span class="muted">→</span> ` : ''}<b>${esc(s.name)}</b> <span class="l-dice">(${g.dice[0]}+${g.dice[1]})</span></div>
      ${evs.length ? `<ul>${evs.map((l) => `<li>${fmtText(l.text)}</li>`).join('')}</ul>` : ''}</div>`;
  }
  const m0 = () => me();

  function renderCenter(g) {
    const cur = playerById(g.turn), m = me();
    const myTurn = m && cur && m.id === cur.id && !m.bankrupt;
    const JAIL = 50 * K;
    let info = `<span class="who" style="background:${cur.color}">${tokenSVG(cur.token)} ${esc(cur.name)}</span> <span class="${g.phase === 'gameover' ? '' : 'dots'}">${phaseText[g.phase] || ''}</span>`;
    if (myTurn && g.phase === 'roll') info = m.inJail ? `Hapistesin (${m.jailTurns + 1}. deneme)` : (g.extraRoll ? 'Çift attın, tekrar at!' : 'Sıra sende!');
    const rt = $('#roundTop');
    rt.textContent = g.roundLimit ? `Tur ${Math.min(g.round, g.roundLimit)} / ${g.roundLimit}` : `Tur ${g.round || 1}`;
    rt.classList.remove('hidden');
    $('#turnInfo').innerHTML = info;
    renderLanding(g);
    const deedSlot = g.phase === 'buy' && g.pendingBuy !== null ? miniDeed(g.pendingBuy) : '';

    const A = [];
    if (myTurn && m.cash >= 0) {
      if (g.phase === 'roll') {
        if (m.inJail) {
          A.push(['roll', `${ICON.dice} Çift Dene`, 'primary']);
          A.push(['payJail', `Kefalet Öde ${money(JAIL)}`, 'gold', m.cash < JAIL]);
          if (m.jailCards.length) A.push(['useJailCard', 'Kartı Kullan', 'green']);
        } else A.push(['roll', `${ICON.dice} ${g.extraRoll ? 'Tekrar Zar At' : 'Zar At'}`, 'primary']);
      } else if (g.phase === 'buy') {
        const s = sq(g.pendingBuy);
        A.push(['buy', `Satın Al ${money(s.price)}`, 'green', m.cash < s.price]);
        A.push(['decline', 'Açık Artırma', 'gold']);
      } else if (g.phase === 'end') A.push(['endTurn', 'Turu Bitir →', 'primary']);
    }
    $('#actions').innerHTML = deedSlot + (deedSlot ? '<div style="flex-basis:100%"></div>' : '') + A.map(([t, l, c, dis]) => `<button class="btn ${c}" data-a="${t}" ${dis ? 'disabled' : ''}>${l}</button>`).join('');
    const md = $('#actions .mini-deed');   // tapu kartına dokununca tapunun tamamı açılır
    if (md) { md.title = 'Tapunun tamamı için dokun'; md.style.cursor = 'pointer'; md.onclick = () => openDeed(g.pendingBuy); }
    $$('#actions [data-a]').forEach((b) => {
      b.onclick = () => {
        if (b.dataset.a === 'deed') return openDeed(g.pendingBuy);
        $$('#actions button').forEach((x) => { x.disabled = true; });
        act(b.dataset.a);
      };
    });

    const db = $('#debtBox');
    if (m && m.inDebt && !m.bankrupt) {
      db.classList.remove('hidden');
      db.innerHTML = `<b>${money(-m.cash)} borcun var!</b><span>Ev sat veya mülk ipotek et. Kapatamazsan iflas edersin.</span>
        <div class="actions"><button class="btn gold" id="debtProps">Mülklerim</button><button class="btn primary" id="debtBk">İflas Et</button></div><small id="debtTimer" class="muted"></small>`;
      $('#debtProps').onclick = () => openProps(m.id);
      $('#debtBk').onclick = () => confirmBox('İflas etmek istediğine emin misin?', 'İflas Et', () => act('bankrupt'));
    } else db.classList.add('hidden');

    renderAuction(g);
  }

  let lastBid = null;
  function renderAuction(g) {
    const box = $('#auctionBox');
    if (g.phase !== 'auction' || !g.auction) { box.classList.add('hidden'); lastBid = null; return; }
    box.classList.remove('hidden');
    const au = g.auction, s = sq(au.idx), m = me();
    const bidder = au.bidder && playerById(au.bidder);
    const canBid = m && !m.bankrupt && !au.passed.includes(m.id);
    const iLead = m && au.bidder === m.id;
    const changed = lastBid !== null && au.bid !== lastBid;
    lastBid = au.bid;
    const incs = [1, 10, 50, 100].map((x) => x * K);
    box.innerHTML = `<h4><span class="gavel ${changed ? 'bang' : ''}">${ICON.gavel}</span> Açık Artırma: <span style="color:${groupColor(s)}">${esc(s.name)}</span></h4>
      <div class="bid ${changed ? 'bump' : ''}">${au.bid ? money(au.bid) : 'Teklif yok'}</div>
      <div>${bidder ? `En yüksek: <b>${esc(bidder.name)}</b>` : 'İlk teklifi ver!'} · <span id="auTimer"></span></div>
      ${canBid && !iLead ? `<div class="row-btns">
          ${incs.map((inc) => `<button class="btn sm" data-inc="${inc}" ${au.bid + inc > m.cash ? 'disabled' : ''}>+${num(inc)}</button>`).join('')}
          <input id="bidInput" type="number" min="${au.bid + 1}" max="${m.cash}" step="1000" placeholder="${num(au.bid + K)}">
          <button class="btn sm green" id="bidBtn">Teklif</button>
          <button class="btn sm ghost" id="passBtn">Çekil</button></div>` : ''}
      ${iLead ? '<b style="color:var(--green)">En yüksek teklif sende!</b>' : ''}
      ${m && !canBid && !iLead ? '<span class="muted">Bu artırmadan çekildin.</span>' : ''}`;
    $$('[data-inc]', box).forEach((b) => { b.onclick = () => act('bid', { amount: au.bid + +b.dataset.inc }); });
    if ($('#bidBtn', box)) {
      $('#bidBtn', box).onclick = () => { const v = parseInt($('#bidInput').value, 10); if (v) act('bid', { amount: v }); };
      $('#passBtn', box).onclick = () => act('pass');
    }
  }

  setInterval(() => {
    const r = latest;
    if (r && r.status === 'lobby') {
      const el = $('#autoStartInfo');
      if (r.autoStartAt) { el.classList.remove('hidden'); el.textContent = `Oyun ${Math.max(0, Math.ceil((r.autoStartAt - now()) / 1000))} sn içinde otomatik başlayacak`; }
      else el.classList.add('hidden');
    }
    const g = game();
    if (!g || g.phase === 'gameover') return;
    const cur = playerById(g.turn);
    const total = cur && cur.connected ? g.timing.TURN_MS : g.timing.OFFLINE_TURN_MS;
    const left = Math.max(0, g.deadline - now());
    const bar = $('#timerBar');
    bar.style.width = `${g.phase === 'auction' ? 100 : Math.min(100, (left / total) * 100)}%`;
    bar.classList.toggle('warn', left < 10000);
    const at = $('#auTimer');
    if (at && g.auction) at.textContent = `${Math.max(0, Math.ceil((g.auction.endsAt - now()) / 1000))} sn`;
    const dt = $('#debtTimer'), m = me();
    if (dt && m && m.debtSince) dt.textContent = `Kalan süre: ${Math.max(0, Math.ceil((m.debtSince + g.timing.DEBT_MS - now()) / 1000))} sn`;
  }, 250);

  function renderLog(g) {
    const newest = g.log.length ? g.log[g.log.length - 1].seq : 0;
    if (newest === lastLogSeq) return;
    const prevSeq = lastLogSeq;
    lastLogSeq = newest;
    $('#logList').innerHTML = g.log.slice().reverse().map((l) => `<li class="${prevSeq && l.seq > prevSeq ? 'new' : ''}">${fmtText(l.text)}</li>`).join('');
  }

  // ---------- tapu ----------
  function deedHTML(i) {
    const s = sq(i), g = game(), pr = g.props[i];
    const owner = pr && pr.owner && playerById(pr.owner);
    const head = `<div class="dh" style="background:${groupColor(s)}"><small>TAPU SENEDİ</small>${esc(s.name)}</div>`;
    let rows = '';
    if (s.type === 'prop') {
      const labels = ['Kira', '1 ev ile', '2 ev ile', '3 ev ile', '4 ev ile', 'Otel ile'];
      rows = s.rent.map((r, k) => `<tr class="${pr.houses === k && pr.owner ? 'cur' : ''}"><td>${labels[k]}</td><td>${money(r)}</td></tr>`).join('')
        + '<tr><td colspan="2" class="muted" style="font-size:13px">Renk grubunun tamamına sahipsen boş arsa kirası 2 kat</td></tr>'
        + `<tr><td>Ev başına</td><td>${money(BOARD.groups[s.group].house)}</td></tr>`
        + `<tr><td>Otel (4 ev varken)</td><td>${money(BOARD.groups[s.group].hotelCost)}</td></tr>`
        + `<tr><td colspan="2" class="muted" style="font-size:13px">Otel bedeli: 4 × ${money(BOARD.groups[s.group].house)} + ${money(BOARD.groups[s.group].hotel)} = <b>${money(BOARD.groups[s.group].hotelCost)}</b></td></tr>`;
    } else if (s.type === 'station') {
      rows = [1, 2, 3, 4].map((n) => `<tr><td>${n} ulaşım noktası</td><td>${money(25 * K * 2 ** (n - 1))}</td></tr>`).join('');
    } else if (s.type === 'utility') {
      rows = `<tr><td>1 idare</td><td>zar × ${money(4 * K)}</td></tr><tr><td>2 idare</td><td>zar × ${money(10 * K)}</td></tr>`;
    } else {
      return `<div class="deed">${head}<div class="df">${s.type === 'tax' ? `${money(s.amount)} vergi ödenir.` : 'Bu kare satın alınamaz.'}</div></div>`;
    }
    return `<div class="deed">${head}<table><tr><td>Fiyat</td><td>${money(s.price)}</td></tr>${rows}<tr><td>İpotek değeri</td><td>${money(s.mortgage)}</td></tr></table>
      <div class="df">Sahibi: <b>${owner ? esc(owner.name) : 'Banka'}</b>${pr.mortgaged ? ' · <b style="color:var(--red)">İPOTEKLİ</b>' : ''}${s.type === 'prop' && pr.houses ? ` · ${pr.houses === 5 ? '1 otel' : `${pr.houses} ev`}` : ''}</div></div>`;
  }
  function propButtons(i) {
    const s = sq(i), g = game(), pr = g.props[i], m = me();
    if (!m || !pr || pr.owner !== m.id || m.bankrupt) return '';
    const b = [];
    if (s.type === 'prop') {
      const gr = BOARD.groups[s.group], h = gr.house;
      const myTurn = g.turn === m.id && (g.phase === 'roll' || g.phase === 'end');
      const left = myTurn ? Math.max(0, (g.buildLimit || 3) - (m.builds || 0)) : 0;
      const full = BOARD.squares.filter((x) => x.group === s.group).every((x) => g.props[x.index].owner === m.id);
      if (pr.houses < 5 && full) b.push(`<button class="btn sm green" data-pa="build" data-i="${i}" ${left ? '' : 'disabled'} title="${myTurn ? `Bu tur kalan inşaat hakkın: ${left}/${g.buildLimit || 3}` : 'Yalnızca kendi sıranda inşaat yapabilirsin'}">${pr.houses === 4 ? 'Otel' : 'Ev'} kur ${money(pr.houses === 4 ? gr.hotelCost : h)} <small>(${myTurn ? `${left} hak` : 'sıranı bekle'})</small></button>`);
      if (pr.houses) b.push(`<button class="btn sm" data-pa="sell" data-i="${i}">${pr.houses === 5 ? 'Oteli' : 'Ev'} sat +${money((pr.houses === 5 ? gr.hotelCost + h * 4 : h) / 2)}</button>`);
    }
    if (!pr.mortgaged) b.push(`<button class="btn sm gold" data-pa="mortgage" data-i="${i}">İpotek +${money(s.mortgage)}</button>`);
    else b.push(`<button class="btn sm" data-pa="unmortgage" data-i="${i}">İpoteği kaldır ${money(Math.ceil(s.mortgage * 1.1))}</button>`);
    return b.join('');
  }
  function bindPropButtons(el) { $$('[data-pa]', el).forEach((b) => { b.onclick = () => act(b.dataset.pa, { idx: +b.dataset.i }); }); }
  function openDeed(i) {
    if (!game()) return;
    openModal((el) => {
      el.innerHTML = deedHTML(i) + `<div class="modal-actions">${propButtons(i)}</div>`;
      bindPropButtons(el);
    });
  }

  // ---------- mülk listesi + cüzdan ----------
  function openProps(pid) {
    openModal((el) => {
      const g = game(); const p = playerById(pid);
      if (!g || !p) return;
      const owned = Object.entries(g.props).filter(([, pr]) => pr.owner === p.id).map(([i]) => +i);
      const order = (i) => { const s = sq(i); return s.group ? GROUP_ORDER.indexOf(s.group) : s.type === 'station' ? 8 : 9; };
      owned.sort((a, b) => order(a) - order(b) || a - b);
      const worth = owned.reduce((t, i) => t + (g.props[i].mortgaged ? 0 : sq(i).mortgage) + (sq(i).type === 'prop' ? (g.props[i].houses === 5 ? BOARD.groups[sq(i).group].house * 4 + BOARD.groups[sq(i).group].hotelCost : g.props[i].houses * BOARD.groups[sq(i).group].house) / 2 : 0), 0);
      const wallet = breakdown(p.cash).map(([n, c], k) => `<div class="wn" style="animation-delay:${k * 60}ms">${noteSVG(n)}<b>×${c}</b></div>`).join('');
      el.innerHTML = `<h3 style="display:flex;align-items:center;gap:8px">${chip(p)} ${esc(p.name)} — ${money(p.cash)}</h3>
        <div class="wallet">${wallet || '<span class="muted">Cüzdan boş.</span>'}</div>
        <p class="muted">${owned.length} mülk · Tasfiye değeri (ipotek + bina satışı): ${money(worth)}</p>
        <div class="prop-groups">${owned.length ? owned.map((i) => {
          const s = sq(i), pr = g.props[i];
          const st = [pr.mortgaged ? 'ipotekli' : '', s.type === 'prop' && pr.houses ? (pr.houses === 5 ? 'otel' : `${pr.houses} ev`) : ''].filter(Boolean).join(', ');
          return `<div class="prop-row" style="--gc:${groupColor(s)}"><span class="n" data-deed="${i}" style="cursor:pointer">${esc(s.name)} <small>${st}</small></span>${propButtons(i)}</div>`;
        }).join('') : '<p class="muted">Henüz mülk yok.</p>'}</div>`;
      bindPropButtons(el);
      $$('[data-deed]', el).forEach((n) => { n.onclick = () => openDeed(+n.dataset.deed); });
    });
  }
  $('#myPropsBtn').onclick = () => { closeDrawer(); if (session) openProps(session.pid); };

  // ---------- takas ----------
  function tradeSummary(t) {
    const list = (props, cash, jail) => {
      const parts = props.map((i) => `<div style="border-left:5px solid ${groupColor(sq(i))};padding-left:5px">${esc(sq(i).name)}</div>`);
      if (cash) parts.push(`<div><b>${money(cash)}</b></div>`);
      if (jail) parts.push(`<div>${jail} hapisten çıkış kartı</div>`);
      return parts.join('') || '<div class="muted">—</div>';
    };
    return `<div class="cols"><div><small class="muted">${esc(playerById(t.from).name)} verir:</small>${list(t.giveProps, t.giveCash, t.giveJail)}</div>
      <div><small class="muted">${esc(playerById(t.to).name)} verir:</small>${list(t.getProps, t.getCash, t.getJail)}</div></div>`;
  }
  function renderTrades(g) {
    const mine = g.trades.filter((t) => t.to === session.pid || t.from === session.pid);
    const incoming = mine.filter((t) => t.to === session.pid).length;
    $('#tradeBadge').textContent = incoming;
    $('#tradeBadge').classList.toggle('hidden', !incoming);
    incomingTrades = incoming; updateMenuBadge();
    if (incoming > (renderTrades.prev || 0)) toast('Yeni takas teklifin var! (Teklifler sekmesi)');
    renderTrades.prev = incoming;
    $('#tradeList').innerHTML = mine.length ? mine.map((t) => `<li><b>${t.to === session.pid ? `${esc(playerById(t.from).name)} sana teklif etti` : `${esc(playerById(t.to).name)} oyuncusuna teklifin`}</b>
      ${tradeSummary(t)}
      <div class="btns">${t.to === session.pid ? `<button class="btn sm green" data-ta="tradeAccept" data-id="${t.id}">Kabul</button><button class="btn sm" data-ta="tradeReject" data-id="${t.id}">Reddet</button>` : `<button class="btn sm" data-ta="tradeCancel" data-id="${t.id}">Geri çek</button>`}</div></li>`).join('')
      : '<li class="muted" style="border:none;background:none">Açık takas teklifi yok. "Takas" ile teklif yapabilirsin.</li>';
    $$('[data-ta]').forEach((b) => { b.onclick = () => act(b.dataset.ta, { id: +b.dataset.id }); });
  }
  $('#tradeBtn').onclick = () => {
    closeDrawer();
    const g = game(), m = me();
    if (!g || !m || m.bankrupt) return;
    const others = g.players.filter((p) => !p.bankrupt && p.id !== m.id);
    if (!others.length) return;
    let target = others[0].id;
    const hasBuild = (i) => sq(i).type === 'prop' && BOARD.squares.some((x) => x.group === sq(i).group && g.props[x.index].houses > 0);
    const checks = (pid, name) => Object.entries(g.props).filter(([, pr]) => pr.owner === pid).map(([i]) => +i).sort((a, b) => a - b)
      .map((i) => `<label class="${hasBuild(i) ? 'dis' : ''}" style="--gc:${groupColor(sq(i))}"><input type="checkbox" name="${name}" value="${i}" ${hasBuild(i) ? 'disabled title="Grupta bina var"' : ''}> ${esc(sq(i).name)}${g.props[i].mortgaged ? ' <small class="muted">(ipotekli)</small>' : ''}</label>`).join('') || '<span class="muted">Mülk yok</span>';
    modalRender = null;
    const el = $('#modalBody');
    el.innerHTML = '';
    const draw = () => {
      const t = playerById(target);
      el.innerHTML = `<h3>Takas Teklifi</h3>
        <div class="field"><span>Kiminle?</span><div class="pick-list">${others.map((p) => `<button type="button" data-tt="${p.id}" class="${p.id === target ? 'sel' : ''}">${chip(p)} ${esc(p.name)} <span class="muted">${money(p.cash)}</span></button>`).join('')}</div></div>
        <div class="trade-grid">
          <div><h4>Sen verirsin</h4><div class="check-list">${checks(m.id, 'give')}</div>
            <label class="field"><span>Baron Doları (en fazla ${money(Math.max(0, m.cash))})</span><input id="trGiveCash" type="number" min="0" step="1000" max="${Math.max(0, m.cash)}" value="0"></label>
            ${m.jailCards.length ? `<label class="field"><span>Hapis kartı</span><input id="trGiveJail" type="number" min="0" max="${m.jailCards.length}" value="0"></label>` : ''}</div>
          <div><h4>${esc(t.name)} verir</h4><div class="check-list">${checks(t.id, 'get')}</div>
            <label class="field"><span>Baron Doları (en fazla ${money(Math.max(0, t.cash))})</span><input id="trGetCash" type="number" min="0" step="1000" max="${Math.max(0, t.cash)}" value="0"></label>
            ${t.jailCards.length ? `<label class="field"><span>Hapis kartı</span><input id="trGetJail" type="number" min="0" max="${t.jailCards.length}" value="0"></label>` : ''}</div>
        </div>
        <div class="modal-actions" style="margin-top:14px"><button class="btn primary" id="trSend">Teklifi Gönder</button></div>`;
      $$('[data-tt]', el).forEach((b) => { b.onclick = () => { target = b.dataset.tt; draw(); }; });
      $('#trSend', el).onclick = () => {
        const val = (id) => parseInt(($(`#${id}`, el) || {}).value, 10) || 0;
        socket.emit('game:act', {
          type: 'tradePropose', to: target,
          giveProps: $$('input[name="give"]:checked', el).map((c) => +c.value),
          getProps: $$('input[name="get"]:checked', el).map((c) => +c.value),
          giveCash: val('trGiveCash'), getCash: val('trGetCash'), giveJail: val('trGiveJail'), getJail: val('trGetJail'),
        }, (res) => { if (res.error) toast(res.error, 'err'); else { toast('Teklif gönderildi.'); closeModal(); } });
      };
    };
    draw();
    $('#modal').classList.remove('hidden');
  };

  // ---------- çıkış & oyun sonu ----------
  $('#leaveGameBtn').onclick = () => {
    const g = game(), m = me();
    const playing = g && g.phase !== 'gameover' && m && !m.bankrupt;
    if (!playing) return socket.emit('room:leave', () => clearSession());
    confirmBox('Oyundan çıkarsan iflas etmiş sayılırsın. Emin misin?', 'Çık', () => socket.emit('room:leave', () => clearSession()));
  };
  // oyun sonu istatistikleri: öne çıkanlar + tablo
  function statsHTML(g) {
    const S = g.stats; if (!S) return '';
    const ps = g.players.filter((p) => S[p.id]);
    const best = (key) => { const p = ps.slice().sort((a, b) => S[b.id][key] - S[a.id][key])[0]; return p && S[p.id][key] > 0 ? p : null; };
    const hl = [
      ['💰', 'En çok kira toplayan', 'rentGot', (v) => money(v)],
      ['🏠', 'Müteahhit (en çok bina)', 'built', (v) => `${v} bina`],
      ['🗺', 'Emlak kralı (en çok mülk alan)', 'bought', (v) => `${v} mülk`],
      ['🅿', 'Otopark şanslısı', 'potWon', (v) => money(v)],
      ['🎲', 'Çift ustası', 'doubles', (v) => `${v} çift`],
      ['🚔', 'Hapishane müdavimi', 'jail', (v) => `${v} kez`],
    ].map(([ic, label, key, f]) => { const p = best(key); return p ? `<div class="hl"><span>${ic}</span><small>${label}</small><b>${chip(p)} ${esc(p.name)}</b><em>${f(S[p.id][key])}</em></div>` : ''; }).join('');
    const rows = ps.map((p) => { const s = S[p.id]; return `<tr><td>${chip(p)} ${esc(p.name)}</td><td>${money(s.rentGot)}</td><td>${money(s.rentPaid)}</td><td>${s.bought}</td><td>${s.built}</td><td>${money(s.peak)}</td></tr>`; }).join('');
    return `<details class="stats" open><summary>Oyun istatistikleri</summary><div class="hls">${hl}</div>
      <div class="stats-tbl"><table><thead><tr><th>Oyuncu</th><th>Kira aldı</th><th>Kira ödedi</th><th>Mülk</th><th>Bina</th><th>En yüksek servet</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
  }
  function renderGameOver(g) {
    const ov = $('#overlay');
    if (g.phase !== 'gameover') { ov.classList.add('hidden'); return; }
    if (renderGameOver.done && (renderGameOver.res || !room.result)) return;
    const firstShow = !renderGameOver.done;
    if (firstShow && V3) V3.fx('win');
    renderGameOver.done = true;
    renderGameOver.res = !!room.result;
    const w = playerById(g.winner);
    const res = room.result;
    const d = res && res.deltas ? res.deltas[session.pid] : undefined;
    const order = g.players.slice().sort((a, b) => (b.id === g.winner) - (a.id === g.winner) || (g.worth[b.id] || 0) - (g.worth[a.id] || 0));
    ov.innerHTML = `<div class="win-box"><div class="trophy">${TOKENS.sapka}</div><h2>${w ? `${esc(w.name)} yeni Baron!` : 'Oyun bitti'}</h2>
      ${w && w.id === session.pid ? '<p>Tebrikler, Türkiye senin!</p>' : '<p>Bir dahaki sefere!</p>'}
      ${d !== undefined ? `<div class="chip-result ${d > 0 ? 'plus' : d < 0 ? 'minus' : ''}">${d > 0 ? '+' : d < 0 ? '−' : ''}${chips(Math.abs(d))}</div>` : ''}
      <ol class="standings">${order.map((p) => `<li>${chip(p)} <b>${esc(p.name)}</b> <span class="muted">${p.bankrupt ? 'iflas' : money(g.worth[p.id] || 0)}</span></li>`).join('')}</ol>
      ${statsHTML(g)}
      <div class="modal-actions">${room.botGame ? '<button class="btn primary" id="againBtn">🔁 Tekrar Oyna</button>' : '<button class="btn primary" id="againBtn">⚡ Yeni Eşleşme</button>'}<button class="btn" id="homeBtn">Ana Menü</button><button class="btn" id="stayBtn">Tahtaya Bak</button></div></div>`;
    ov.classList.remove('hidden');
    if (firstShow) confetti();
    if (d > 0) after(400, () => chipBurst(centerOf($('.chip-result')), { x: innerWidth / 2, y: -40 }, d));
    $('#homeBtn').onclick = () => socket.emit('room:leave', () => clearSession());
    const wasBot = room.botGame, lvl = g.botLevel, nBots = g.players.filter((p) => p.isBot).length, rounds = g.roundLimit;
    $('#againBtn').onclick = () => socket.emit('room:leave', () => {
      clearSession();
      if (wasBot) socket.emit('room:bots', { bots: nBots, roundLimit: rounds, startMoney: 1500 * K, icon: look.icon, color: look.color, level: lvl }, handle);
      else socket.emit('room:quick', {}, handle);
    });
    $('#stayBtn').onclick = () => ov.classList.add('hidden');
  }

  // ---------- nasıl oynanır ----------
  function openRules() {
    const k = (n) => money(n * K);
    const sec = (t, items) => `<details class="rule"${t.open ? ' open' : ''}><summary>${t.title}</summary><ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul></details>`;
    openModal((el) => {
      el.innerHTML = `<h3>Nasıl Oynanır?</h3><div class="rules">
        ${sec({ title: '🎯 Amaç', open: true }, ['Herkes ' + k(1500) + ' ile başlar. İlleri satın al, ev ve otel dik, kira topla.', 'Diğer herkesi iflas ettiren ya da tur sınırı dolduğunda <b>en zengin</b> olan (para + mülk + bina) kazanır.'])}
        ${sec({ title: '🎲 Sıran gelince' }, ['<b>Zar At</b>: zarların toplamı kadar ilerlersin. Gideceğin kare önceden parlar.', 'Çift atarsan bir kez daha atarsın; üst üste <b>3 çift</b> atan hapse girer.', 'Her turun için <b>60 saniye</b> süren var; süre biterse oyun senin yerine en güvenli hamleyi yapar.', 'BAŞLANGIÇ\'tan her geçişte ' + k(200) + ' alırsın.'])}
        ${sec({ title: '🏠 Mülk, ev ve otel' }, ['Sahipsiz bir ile gelince <b>Satın Al</b> ya da <b>Açık Artırma</b> seçersin; açık artırmaya herkes katılabilir.', 'Bir renk grubunun <b>tamamı</b> sendeyse boş arsa kirası 2 katına çıkar ve ev dikebilirsin.', 'Evler gruba <b>eşit</b> dağıtılır. Ev ve otel yalnızca <b>kendi sıranda</b> ve sıra başına en fazla <b>3 bina</b> dikilir.', 'Her bölgenin ev fiyatı farklıdır. <b>Otel</b> = 4 ev bedeli + otel bedeli (örn. ev ' + k(100) + ' ise otel ' + k(600) + ').', 'Bankadaki ev ve otel sayısı sınırlıdır (32 ev, 12 otel); tahtadaki BANKA tabelasında görünür.', 'Binaları yarı fiyatına bankaya satabilir, mülkü ipotek edip değerinin yarısını alabilirsin (ipoteği kaldırmak %10 fazlaya mal olur).'])}
        ${sec({ title: '💰 Otopark kasası' }, ['Vergiler, kart cezaları ve hapis ücretleri bankaya değil <b>tahtadaki Otopark kasasına</b> gider.', '<b>Ücretsiz Otopark</b> karesine gelen kasadaki paranın tamamını alır!'])}
        ${sec({ title: '🚔 Hapis' }, ['"Hapse Gir" karesi, bazı kartlar ya da 3 çift seni hapse yollar.', 'Çıkmak için: çift atmayı dene, ' + k(50) + ' kefalet öde ya da Hapisten Çıkış Kartı kullan. 3. denemede de çift gelmezse kefaleti ödeyip çıkarsın.'])}
        ${sec({ title: '🤝 Takas ve borç' }, ['<b>Takas</b> düğmesiyle diğer oyunculara mülk, para ve hapis kartı teklif edebilirsin; botlar da teklif yapar.', 'Paran eksiye düşerse borçlu olursun: ev sat, ipotek et ya da takas yap. 90 saniyede kapatamazsan varlıkların satılır, yetmezse iflas edersin.'])}
        ${sec({ title: '🎰 Çipler' }, ['Çipler hesabında kalıcıdır. Yeni hesaplar 1.000 çiple başlar.', 'Odaların giriş ücreti olabilir; masadaki toplam çipi kazanan alır.', 'Botlara karşı giriş ücreti yoktur; kazanırsan zorluğa göre bot başına çip kazanırsın (Kolay 15, Normal 25, Zor 40).', 'Her gün <b>Günlük Ödül</b> al; seri yaptıkça ödül büyür.'])}
        ${sec({ title: '📱 Kontroller' }, ['Bir kareye dokun: tapusu açılır. Oyuncu kartına dokun: o oyuncunun mülkleri açılır.', 'İki parmakla yakınlaştır, tek parmakla kaydır. 🔍 düğmesi sırası geleni yakından izler, 🗺 tüm tahtayı gösterir.', 'En iyi deneyim için telefonu yan çevir ya da siteyi "Ana Ekrana Ekle" ile aç.'])}
      </div>`;
    });
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-rules]'); if (b) { e.preventDefault(); $('#tbMore') && $('#tbMore').classList.add('hidden'); $('#homeSide') && $('#home2').classList.remove('drawer-open'); openRules(); } });

  // ---------- başlat ----------
  fetch('/api/board').then((r) => r.json()).then((b) => {
    BOARD = b; K = b.K || 1000; opt.startMoney = 1500 * K; renderSegs(); notesBackground(); pump();
    // 3D tahtayı oyuna girmeden önce hazırla: oyun ekranı beklemeden açılsın
    (window.requestIdleCallback || ((f) => setTimeout(f, 300)))(() => load3D(), { timeout: 1500 });
  });
  // ana sayfa vitrin: 3D piyonlar ve dönen zarlar
  // ana sayfa vitrini: oyundaki 3D karakterler ve zarlar
  (function heroArt() {
    const cv = $('#heroGl'); if (!cv) return;
    const vis = () => !$('#home').classList.contains('hidden') && cv.offsetParent !== null && !document.hidden;
    const start = () => import('/3d/hero.js').then((m) => m.createHero(cv, vis)).catch((e) => console.error(e));
    if (matchMedia('(max-width: 920px)').matches) matchMedia('(max-width: 920px)').addEventListener('change', (e) => { if (!e.matches && !start.done) { start.done = true; start(); } });
    else { start.done = true; start(); }
  })();

  (async () => {
    if (!token) return showScreen('auth');
    let r = null;
    for (let k = 0; k < 6 && !(r && (r.ok || r.status === 401)); k++) {
      if (k) { $('#loadingSub').textContent = 'Sunucu uyanıyor, birkaç saniye…'; await new Promise((ok) => setTimeout(ok, 2500)); }
      r = await api('/api/me').catch(() => null);
    }
    if (!r || !r.ok) {
      if (r && r.status === 401) return logout();
      $('#loadingText').textContent = 'Sunucuya ulaşılamadı';
      $('#loadingSub').textContent = (r && r.error) || 'Biraz bekleyip yeniden dene.';
      $('#retryBtn').classList.remove('hidden');
      return;
    }
    setUser(r.user);
    startSocket();
  })();
})();
