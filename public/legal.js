// Yasal sayfalarda iletişim adresi ve geliştirici adı sunucudan gelir (Render: CONTACT_EMAIL, DEVELOPER_NAME)
fetch('/api/site-info').then((r) => r.json()).then((i) => {
  document.querySelectorAll('[data-contact]').forEach((a) => {
    if (i.contact) { a.textContent = i.contact; a.href = `mailto:${i.contact}`; }
    else { a.textContent = '(iletişim e-postası henüz ayarlanmadı)'; a.removeAttribute('href'); }
  });
  if (i.developer) document.querySelectorAll('[data-dev]').forEach((b) => { b.textContent = i.developer; });
  if (i.updated) document.querySelectorAll('[data-updated]').forEach((b) => { b.textContent = i.updated; });
}).catch(() => {});
