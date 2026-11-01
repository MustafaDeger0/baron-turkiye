// Oyundaki SVG çizimleri (public/app.js içinden) — 3D önizleme için
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
export { TOKENS, ICON, ART };
