(function(){
  'use strict';
  const PASSWORD = 'wallprint2026';
  const SESSION_KEY = 'mwp_admin_session_v1';
  let currentImage = '';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const M = window.MWP;

  function escapeHTML(v){ return M.escapeHTML(v); }
  function toast(v){ M.toast(v); }
  function getStoredPosts(){
    const raw = localStorage.getItem(M.STORAGE_POSTS);
    try { return raw ? JSON.parse(raw) : []; } catch { return []; }
  }
  function getPostsForAdmin(){
    const stored = getStoredPosts();
    return stored.length ? stored : M.defaultPosts;
  }
  function savePosts(posts){
    localStorage.setItem(M.STORAGE_POSTS, JSON.stringify(posts));
  }
  function uid(prefix='post'){return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;}
  function today(){return new Date().toISOString().slice(0,10);}

  function initLogin(){
    const login = $('#loginCard');
    const dash = $('#dashboard');
    const form = $('#loginForm');
    const input = $('#passwordInput');
    const logout = $('#logoutBtn');
    function showDashboard(){
      login.classList.add('hidden'); dash.classList.remove('hidden'); renderAll();
    }
    function showLogin(){
      login.classList.remove('hidden'); dash.classList.add('hidden');
    }
    if(localStorage.getItem(SESSION_KEY) === 'ok') showDashboard(); else showLogin();
    form?.addEventListener('submit', e => {
      e.preventDefault();
      if(input.value === PASSWORD){ localStorage.setItem(SESSION_KEY,'ok'); showDashboard(); toast('Dashboard geöffnet.'); }
      else toast('Falsches Passwort.');
    });
    logout?.addEventListener('click', () => { localStorage.removeItem(SESSION_KEY); showLogin(); toast('Logout abgeschlossen.'); });
  }

  function updateStats(){
    const posts = getPostsForAdmin();
    const inquiries = M.getInquiries();
    $('#postCount').textContent = posts.length;
    $('#publishedCount').textContent = posts.filter(p=>p.status==='published').length;
    $('#draftCount').textContent = posts.filter(p=>p.status!=='published').length;
    const normalized = inquiries.map(i => M.normalizeInquiry ? M.normalizeInquiry(i) : i);
    $('#inquiryCount').textContent = normalized.length;
    if($('#activeOrderCount')) $('#activeOrderCount').textContent = normalized.filter(i => !['completed','cancelled'].includes(i.status || 'new')).length;
    if($('#completedOrderCount')) $('#completedOrderCount').textContent = normalized.filter(i => i.status === 'completed').length;
  }

  function renderPosts(){
    const box = $('#postAdminList'); if(!box) return;
    const posts = getPostsForAdmin().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    if(!posts.length){
      box.innerHTML = '<div class="empty-state">Noch keine Posts. Erstelle den ersten Post links.</div>';
      return;
    }
    box.innerHTML = posts.map(p => `
      <article class="admin-item" data-id="${escapeHTML(p.id)}">
        <div class="admin-item-head">
          <div>
            <div class="admin-meta">${escapeHTML(p.category || 'Post')} · ${escapeHTML(p.date || '')} <span class="badge">${escapeHTML(p.status || 'draft')}</span></div>
            <h3>${escapeHTML(p.title)}</h3>
            <p>${escapeHTML(p.excerpt || p.body || '')}</p>
          </div>
          ${p.image ? `<img src="${p.image}" alt="" style="width:130px;height:90px;object-fit:cover;border:1px solid var(--line)">` : ''}
        </div>
        <div class="item-actions">
          <button class="tiny-btn" data-action="edit">Bearbeiten</button>
          <button class="tiny-btn" data-action="toggle">${p.status === 'published' ? 'Als Entwurf' : 'Veröffentlichen'}</button>
          <button class="tiny-btn danger" data-action="delete">Löschen</button>
        </div>
      </article>`).join('');
  }

  function renderInquiries(){
    const box = $('#inquiryList'); if(!box) return;
    const inquiries = M.getInquiries().map(item => M.normalizeInquiry ? M.normalizeInquiry(item) : item);
    M.saveInquiries(inquiries);
    if(!inquiries.length){
      box.innerHTML = '<div class="empty-state">Noch keine Anfragen. Teste das Kontaktformular oder den Konfigurator auf der Website.</div>';
      return;
    }
    box.innerHTML = inquiries.map(item => {
      const files = Array.isArray(item.files) ? item.files : [];
      return `<article class="admin-item" data-id="${escapeHTML(item.id)}">
        <div class="admin-item-head">
          <div>
            <div class="admin-meta">${escapeHTML(item.type || 'Anfrage')} · ${new Date(item.createdAt).toLocaleString('de-DE')}</div>
            <h3>${escapeHTML(item.name || item.email || item.contentType || 'Neue Anfrage')}</h3>
            <div class="admin-tracking-line"><strong>${escapeHTML(item.trackingId || 'Keine Tracking-ID')}</strong> · ${escapeHTML(M.statusLabel ? M.statusLabel(item.status) : (item.status || 'Neu'))}</div>
          </div>
          <button class="tiny-btn danger" data-action="delete-inquiry">Löschen</button>
        </div>
        <p class="inquiry-body">${renderInquiryText(item)}</p>
        ${files.length ? `<div class="file-downloads">${files.map((f,idx)=>`<a href="${f.dataUrl}" download="${escapeHTML(f.name || 'file')}">${escapeHTML(f.name || ('Datei '+(idx+1)))}</a>`).join('')}</div>` : ''}
        ${item.skippedFiles?.length ? `<p class="form-note">Nicht gespeichert, weil zu groß: ${item.skippedFiles.map(f=>escapeHTML(f.name)).join(', ')}</p>` : ''}
      </article>`;
    }).join('');
  }

  function renderInquiryText(item){
    if(item.type === 'configurator'){
      return escapeHTML([
        `Inhalt: ${item.contentType || '-'}`,
        `Design: ${item.designState || '-'}`,
        `Größe: ${item.unknownSize ? 'Unbekannt' : `${item.width || '?'}m × ${item.height || '?'}m`}`,
        `Kontakt: ${item.name || '-'} · ${item.email || '-'}`,
        `Notizen: ${item.notes || '-'}`
      ].join('\n'));
    }
    return escapeHTML([
      `Formular: ${item.formName || item.type || 'Kontakt'}`,
      `Name: ${item.name || '-'}`,
      `E-Mail: ${item.email || '-'}`,
      `Telefon: ${item.phone || '-'}`,
      `Stadt / PLZ: ${item.city || '-'}`,
      `Projektart: ${item.projectType || '-'}`,
      `Designzustand: ${item.designState || '-'}`,
      `Maße: ${item.width || '?'} m × ${item.height || '?'} m`,
      `Wandzustand: ${item.surface || '-'}`,
      '',
      item.message || '-'
    ].join('\n'));
  }

  function renderAll(){ updateStats(); renderPosts(); renderInquiries(); renderOrders(); renderOrderEditor(); setDefaultDate(); }
  function setDefaultDate(){ const d = $('#postDate'); if(d && !d.value) d.value = today(); }

  function resetForm(){
    $('#postForm').reset(); $('#postId').value=''; currentImage=''; setDefaultDate();
    $('#postImagePreview').innerHTML='Kein Bild';
  }

  function fillForm(post){
    $('#postId').value = post.id || '';
    $('#postTitle').value = post.title || '';
    $('#postCategory').value = post.category || '';
    $('#postDate').value = post.date || today();
    $('#postStatus').value = post.status || 'draft';
    $('#postExcerpt').value = post.excerpt || '';
    $('#postBody').value = post.body || '';
    currentImage = post.image || '';
    $('#postImagePreview').innerHTML = currentImage ? `<img src="${currentImage}" alt="Preview">` : 'Kein Bild';
    window.scrollTo({top:$('#postsAdmin').offsetTop-70,behavior:'smooth'});
  }

  function initPostsAdmin(){
    const form = $('#postForm'); if(!form) return;
    $('#postDate').value = today();
    $('#postImage')?.addEventListener('change', async e => {
      const file = e.currentTarget.files && e.currentTarget.files[0];
      if(!file) return;
      if(file.size > 1400 * 1024){ toast('Bild ist zu groß für diese Static-Demo. Bitte unter 1.4MB nutzen.'); return; }
      const read = await M.readFile(file);
      currentImage = read?.dataUrl || '';
      $('#postImagePreview').innerHTML = currentImage ? `<img src="${currentImage}" alt="Preview">` : 'Kein Bild';
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const stored = getStoredPosts();
      let posts = stored.length ? stored : getPostsForAdmin();
      const id = $('#postId').value || uid('post');
      const next = {
        id,
        title:$('#postTitle').value.trim(), category:$('#postCategory').value.trim() || 'Post', date:$('#postDate').value || today(),
        status:$('#postStatus').value, excerpt:$('#postExcerpt').value.trim(), body:$('#postBody').value.trim(), image:currentImage
      };
      posts = posts.filter(p=>p.id !== id);
      posts.unshift(next);
      savePosts(posts);
      resetForm(); renderAll(); toast('Post gespeichert.');
    });
    $('#resetPostForm')?.addEventListener('click', resetForm);
    $('#postAdminList')?.addEventListener('click', e => {
      const btn = e.target.closest('button[data-action]'); if(!btn) return;
      const card = e.target.closest('[data-id]'); const id = card?.dataset.id; if(!id) return;
      let posts = getPostsForAdmin(); const post = posts.find(p=>p.id === id); if(!post) return;
      const action = btn.dataset.action;
      if(action === 'edit') fillForm(post);
      if(action === 'toggle'){
        posts = posts.map(p => p.id === id ? {...p, status:p.status === 'published' ? 'draft' : 'published'} : p);
        savePosts(posts); renderAll(); toast('Status geändert.');
      }
      if(action === 'delete'){
        if(confirm('Diesen Post wirklich löschen?')){ savePosts(posts.filter(p=>p.id !== id)); renderAll(); toast('Post gelöscht.'); }
      }
    });
    $('#seedPostsBtn')?.addEventListener('click', () => { savePosts(M.defaultPosts); renderAll(); toast('Demo-Posts gespeichert.'); });
    $('#exportPostsBtn')?.addEventListener('click', () => M.downloadJSON('main-wallprint-posts.json', getPostsForAdmin()));
    $('#importPostsInput')?.addEventListener('change', async e => {
      const file = e.currentTarget.files && e.currentTarget.files[0]; if(!file) return;
      const text = await file.text();
      try{
        const data = JSON.parse(text);
        if(!Array.isArray(data)) throw new Error('JSON must be an array');
        savePosts(data); renderAll(); toast('Posts importiert.');
      } catch(err){ toast('Import fehlgeschlagen: ungültige JSON-Datei.'); }
      e.currentTarget.value='';
    });
  }


  let selectedOrderId = '';

  function getOrders(){
    const list = M.getInquiries().map(item => M.normalizeInquiry ? M.normalizeInquiry(item) : item);
    M.saveInquiries(list);
    return list;
  }

  function saveOrder(next){
    const list = getOrders().map(item => item.id === next.id ? next : item);
    M.saveInquiries(list);
  }

  function orderTitle(item){
    return item.name || item.email || item.contentType || item.projectType || 'Neue Anfrage';
  }

  function renderOrders(){
    const box = $('#orderList'); if(!box) return;
    const filter = $('#orderStatusFilter')?.value || 'all';
    const q = ($('#orderSearch')?.value || '').trim().toLowerCase();
    let orders = getOrders().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    if(filter !== 'all') orders = orders.filter(item => (item.status || 'new') === filter);
    if(q){
      orders = orders.filter(item => [item.trackingId, item.name, item.email, item.projectType, item.contentType].join(' ').toLowerCase().includes(q));
    }
    if(!orders.length){
      box.innerHTML = '<div class="empty-state">Keine Aufträge für diese Filter.</div>';
      return;
    }
    box.innerHTML = orders.map(item => `
      <article class="order-row ${item.id === selectedOrderId ? 'selected' : ''}" data-order-id="${escapeHTML(item.id)}">
        <div>
          <strong>${escapeHTML(orderTitle(item))}</strong>
          <span>${escapeHTML(item.email || '—')}</span>
          <code>${escapeHTML(item.trackingId || '—')}</code>
        </div>
        <em class="order-status status-${escapeHTML(item.status || 'new')}">${escapeHTML(M.statusLabel ? M.statusLabel(item.status) : item.status || 'Neu')}</em>
      </article>`).join('');
  }

  function renderOrderEditor(){
    const editor = $('#orderEditor'); if(!editor) return;
    const order = getOrders().find(item => item.id === selectedOrderId);
    if(!order){
      editor.innerHTML = `<p class="eyebrow">Ausgewählter Auftrag</p><h3>Noch kein Auftrag gewählt</h3><p class="muted">Wähle links eine Anfrage aus, um Status und Notizen zu bearbeiten.</p>`;
      return;
    }
    const fallbackStatuses = {
      new:'Neu', review:'In Prüfung', design:'Design / Vorbereitung', awaiting_approval:'Warten auf Freigabe', scheduled:'Termin geplant', printing:'In Produktion', completed:'Abgeschlossen', cancelled:'Storniert'
    };
    const statusOptions = Object.entries(M.ORDER_STATUSES || fallbackStatuses).map(([value,label]) => `<option value="${value}" ${order.status === value ? 'selected' : ''}>${escapeHTML(label)}</option>`).join('');
    const history = (order.statusHistory || []).slice().reverse().map(h => `
      <li><strong>${escapeHTML(M.statusLabel ? M.statusLabel(h.status) : h.status)}</strong><span>${new Date(h.date).toLocaleString('de-DE')}</span>${h.note ? `<p>${escapeHTML(h.note)}</p>` : ''}</li>`
    ).join('');
    editor.innerHTML = `
      <p class="eyebrow">Tracking-ID</p>
      <h3>${escapeHTML(order.trackingId || '—')}</h3>
      <div class="admin-order-meta">
        <div><strong>Kunde</strong><span>${escapeHTML(order.name || '—')}</span></div>
        <div><strong>E-Mail</strong><span>${escapeHTML(order.email || '—')}</span></div>
        <div><strong>Projekt</strong><span>${escapeHTML(order.projectType || order.contentType || '—')}</span></div>
        <div><strong>Datum</strong><span>${new Date(order.createdAt).toLocaleString('de-DE')}</span></div>
      </div>
      <label>Status ändern
        <select id="selectedOrderStatus">${statusOptions}</select>
      </label>
      <label>Notiz für Kunden
        <textarea id="selectedOrderNote" rows="4" placeholder="Diese Notiz erscheint im Tracking-Bereich für den Kunden.">${escapeHTML(order.adminNote || '')}</textarea>
      </label>
      <label>Interne Statusnotiz
        <input id="selectedOrderHistoryNote" type="text" placeholder="z. B. Kunde telefonisch informiert">
      </label>
      <div class="item-actions">
        <button class="tiny-btn" id="saveOrderBtn" type="button">Status speichern</button>
        <button class="tiny-btn" id="copyTrackingBtn" type="button">Tracking kopieren</button>
        <button class="tiny-btn danger" id="deleteOrderBtn" type="button">Anfrage löschen</button>
      </div>
      <ol class="admin-status-history">${history}</ol>
    `;
    $('#saveOrderBtn')?.addEventListener('click', () => {
      const nextStatus = $('#selectedOrderStatus').value;
      const note = $('#selectedOrderNote').value.trim();
      const historyNote = $('#selectedOrderHistoryNote').value.trim();
      const updated = {...order, status:nextStatus, adminNote:note};
      const last = (updated.statusHistory || [])[updated.statusHistory.length - 1];
      if(!last || last.status !== nextStatus || historyNote){
        updated.statusHistory = [...(updated.statusHistory || []), {status:nextStatus, date:new Date().toISOString(), note:historyNote || `Status geändert zu: ${M.statusLabel ? M.statusLabel(nextStatus) : nextStatus}`}];
      }
      saveOrder(updated); renderAll(); selectedOrderId = updated.id; renderOrders(); renderOrderEditor(); toast('Auftrag aktualisiert.');
    });
    $('#copyTrackingBtn')?.addEventListener('click', async () => {
      const txt = `Tracking-ID: ${order.trackingId}\nE-Mail: ${order.email}\nStatus-Link: ${location.origin}${location.pathname.replace('admin.html','index.html')}#tracking`;
      try { await navigator.clipboard.writeText(txt); toast('Tracking-Daten kopiert.'); }
      catch { M.downloadJSON('main-wallprint-tracking.json', {trackingId:order.trackingId, email:order.email}); toast('Clipboard nicht verfügbar, JSON wurde heruntergeladen.'); }
    });
    $('#deleteOrderBtn')?.addEventListener('click', () => {
      if(confirm('Diese Anfrage wirklich löschen?')){
        M.saveInquiries(getOrders().filter(i => i.id !== order.id));
        selectedOrderId = '';
        renderAll();
        toast('Anfrage gelöscht.');
      }
    });
  }

  function initTrackingAdmin(){
    $('#orderList')?.addEventListener('click', e => {
      const row = e.target.closest('[data-order-id]'); if(!row) return;
      selectedOrderId = row.dataset.orderId;
      renderOrders(); renderOrderEditor();
    });
    $('#orderStatusFilter')?.addEventListener('change', () => { renderOrders(); renderOrderEditor(); });
    $('#orderSearch')?.addEventListener('input', renderOrders);
  }


  function initInquiryAdmin(){
    $('#exportInquiriesBtn')?.addEventListener('click', () => M.downloadJSON('main-wallprint-inquiries.json', M.getInquiries()));
    $('#clearInquiriesBtn')?.addEventListener('click', () => {
      if(confirm('Alle Anfragen löschen?')){ M.saveInquiries([]); selectedOrderId=''; renderAll(); toast('Anfragen gelöscht.'); }
    });
    $('#inquiryList')?.addEventListener('click', e => {
      const btn = e.target.closest('button[data-action="delete-inquiry"]'); if(!btn) return;
      const id = e.target.closest('[data-id]')?.dataset.id;
      if(!id) return;
      if(confirm('Diese Anfrage löschen?')){
        M.saveInquiries(M.getInquiries().filter(i=>i.id !== id)); if(selectedOrderId===id) selectedOrderId=''; renderAll(); toast('Anfrage gelöscht.');
      }
    });
    $('#exportAllBtn')?.addEventListener('click', () => M.downloadJSON('main-wallprint-backup.json', {posts:getPostsForAdmin(), inquiries:M.getInquiries(), exportedAt:new Date().toISOString()}));
  }

  document.addEventListener('DOMContentLoaded', () => { initLogin(); initPostsAdmin(); initTrackingAdmin(); initInquiryAdmin(); });
})();
