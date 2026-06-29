(function(){
  'use strict';

  const STORAGE_POSTS = 'mwp_posts_v1';
  const STORAGE_INQUIRIES = 'mwp_inquiries_v1';
  const CONTACT_FILES_LIMIT = 4;
  const FILE_SIZE_LIMIT = 900 * 1024;
  const CONTACT_EMAIL = 'info@main-wallprint.de';

  const defaultPosts = [
    {
      id:'demo-1',
      title:'Druck auf Akustikpaneele',
      category:'Service',
      status:'published',
      date:'2026-06-16',
      excerpt:'Akustik trifft Design.',
      body:'Funktionale Paneele mit starkem Look.',
      image:''
    },
    {
      id:'demo-2',
      title:'Wanddrucke',
      category:'Service',
      status:'published',
      date:'2026-06-12',
      excerpt:'Logos, Motive und Illustrationen.',
      body:'Direkt auf die Wand gedruckt.',
      image:''
    },
    {
      id:'demo-3',
      title:'Designerstellung',
      category:'Design',
      status:'published',
      date:'2026-06-08',
      excerpt:'Design erstellen oder vorbereiten.',
      body:'Vom Motiv zur druckfertigen Datei.',
      image:''
    }
  ];

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function safeParse(value, fallback){
    try { return JSON.parse(value) || fallback; } catch { return fallback; }
  }
  function getPosts(){
    const stored = safeParse(localStorage.getItem(STORAGE_POSTS), []);
    return Array.isArray(stored) && stored.length ? stored : defaultPosts;
  }
  function getInquiries(){
    return safeParse(localStorage.getItem(STORAGE_INQUIRIES), []);
  }
  function saveInquiries(list){
    localStorage.setItem(STORAGE_INQUIRIES, JSON.stringify(list));
  }
  function uid(prefix='id'){
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  function trackingId(){
    const d = new Date();
    const stamp = d.toISOString().slice(0,10).replaceAll('-','');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `MWP-${stamp}-${rand}`;
  }
  const ORDER_STATUSES = {
    new:'Neu',
    review:'In Prüfung',
    design:'Design / Vorbereitung',
    awaiting_approval:'Warten auf Freigabe',
    scheduled:'Termin geplant',
    printing:'In Produktion',
    completed:'Abgeschlossen',
    cancelled:'Storniert'
  };
  function statusLabel(value){ return ORDER_STATUSES[value] || value || 'Neu'; }
  function statusProgress(value){
    const order = ['new','review','design','awaiting_approval','scheduled','printing','completed'];
    if(value === 'cancelled') return 0;
    const idx = Math.max(0, order.indexOf(value || 'new'));
    return Math.round((idx / (order.length - 1)) * 100);
  }
  function normalizeInquiry(item){
    if(!item) return item;
    if(!item.trackingId) item.trackingId = trackingId();
    if(!item.status) item.status = 'new';
    if(!Array.isArray(item.statusHistory)){
      item.statusHistory = [{status:item.status, date:item.createdAt || new Date().toISOString(), note:'Anfrage wurde erstellt.'}];
    }
    return item;
  }
  function toast(message){
    const box = $('#toast');
    if(!box) return alert(message);
    box.textContent = message;
    box.classList.add('show');
    clearTimeout(window.__mwpToast);
    window.__mwpToast = setTimeout(()=>box.classList.remove('show'), 3400);
  }
  function currencySymbol(code){
    return code === 'JOD' ? 'د.أ' : code === 'USD' ? '$' : '€';
  }
  function formatMoney(amount, code){
    const rounded = Math.round(amount / 5) * 5;
    const symbol = currencySymbol(code);
    if(code === 'JOD') return `${rounded.toLocaleString('de-DE')} ${symbol}`;
    return `${symbol} ${rounded.toLocaleString('de-DE')}`;
  }
  function convertFromEUR(value, code){
    if(code === 'JOD') return value * 0.77;
    if(code === 'USD') return value * 1.08;
    return value;
  }
  function readFile(file){
    return new Promise((resolve) => {
      if(!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve({
        name:file.name,
        type:file.type || 'unknown',
        size:file.size,
        dataUrl:reader.result
      });
      reader.onerror = () => resolve({name:file.name,type:file.type || 'unknown',size:file.size,error:'Could not read file'});
      reader.readAsDataURL(file);
    });
  }
  async function readFiles(input, limit=CONTACT_FILES_LIMIT){
    const files = Array.from(input?.files || []).slice(0, limit);
    const safeFiles = files.filter(f => f.size <= FILE_SIZE_LIMIT);
    const skipped = files.filter(f => f.size > FILE_SIZE_LIMIT);
    const read = await Promise.all(safeFiles.map(readFile));
    return {files:read.filter(Boolean), skipped};
  }
  function clamp(value, min, max){ return Math.min(max, Math.max(min, value)); }
  function loadImage(dataUrl){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }
  function estimateBgColor(data, width, height){
    const step = Math.max(1, Math.floor(Math.min(width, height) / 80));
    let r = 0, g = 0, b = 0, count = 0;
    const sampleAt = (x, y) => {
      const i = (y * width + x) * 4;
      const alpha = data[i+3];
      if(alpha < 30) return;
      r += data[i]; g += data[i+1]; b += data[i+2]; count++;
    };
    for(let x=0; x<width; x+=step){ sampleAt(x, 0); sampleAt(x, height - 1); }
    for(let y=step; y<height-step; y+=step){ sampleAt(0, y); sampleAt(width - 1, y); }
    if(!count) return {r:245, g:245, b:245};
    return {r:r/count, g:g/count, b:b/count};
  }
  async function autoRemoveBackground(readResult){
    if(!readResult?.dataUrl || !String(readResult.type || '').startsWith('image/')) return readResult;
    try {
      const img = await loadImage(readResult.dataUrl);
      const maxSide = 1800;
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
      const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
      const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d', {willReadFrequently:true});
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const pixels = imageData.data;
      const bg = estimateBgColor(pixels, width, height);
      const threshold = 26;
      const softness = 36;
      for(let i=0; i<pixels.length; i+=4){
        const alpha = pixels[i+3];
        if(alpha === 0) continue;
        const rr = pixels[i], gg = pixels[i+1], bb = pixels[i+2];
        const dist = Math.sqrt((rr - bg.r) ** 2 + (gg - bg.g) ** 2 + (bb - bg.b) ** 2);
        const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
        const sat = max - min;
        const lum = (rr + gg + bb) / 3;
        const likelyBg = dist < (threshold + softness) || (lum > 242 && sat < 22);
        if(!likelyBg) continue;
        let newAlpha = Math.round(clamp((dist - threshold) / softness, 0, 1) * 255);
        if(lum > 247 && sat < 12) newAlpha = Math.min(newAlpha, 10);
        pixels[i+3] = Math.min(alpha, newAlpha);
      }
      ctx.putImageData(imageData, 0, 0);
      return Object.assign({}, readResult, { type:'image/png', dataUrl:canvas.toDataURL('image/png') });
    } catch(err){
      console.warn('Background removal skipped:', err);
      return readResult;
    }
  }
  async function prepareArtworkFile(file){
    const read = await readFile(file);
    if(!read?.dataUrl) return read;
    return autoRemoveBackground(read);
  }
  function renderFileList(input, target){
    const box = typeof target === 'string' ? $(target) : target;
    if(!box || !input) return;
    const files = Array.from(input.files || []);
    box.innerHTML = files.length ? files.map(file => {
      const size = file.size > 1024*1024 ? `${(file.size/1024/1024).toFixed(1)} MB` : `${Math.round(file.size/1024)} KB`;
      const warn = file.size > FILE_SIZE_LIMIT ? ' - zu groß für LocalStorage Demo' : '';
      return `<span class="file-pill">${escapeHTML(file.name)} · ${size}${warn}</span>`;
    }).join('') : '';
  }
  function escapeHTML(str){
    return String(str ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
  function downloadJSON(filename, data){
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }


  const fallbackPostImages = [
    'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1200&q=84',
    'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1200&q=84',
    'https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=1200&q=84'
  ];

  function detailParagraphs(text){
    const value = String(text || '').trim();
    if(!value) return '<p>Weitere Details folgen bald.</p>';
    return value.split(/\n{2,}|\r?\n/).filter(Boolean).map(part => `<p>${escapeHTML(part)}</p>`).join('');
  }

  function openDetailModal(detail={}){
    const modal = $('#detailModal');
    if(!modal) return;
    const panel = $('.detail-modal-panel', modal);
    const category = $('#detailModalCategory');
    const title = $('#detailModalTitle');
    const subtitle = $('#detailModalSubtitle');
    const body = $('#detailModalBody');
    const media = $('#detailModalMedia');
    const action = $('#detailModalAction');

    if(category) category.textContent = detail.category || 'Details';
    if(title) title.textContent = detail.title || 'Main WallPrint';
    if(subtitle) subtitle.textContent = detail.subtitle || detail.excerpt || '';
    if(body) body.innerHTML = detailParagraphs(detail.body || detail.excerpt || '');
    if(media){
      if(detail.image){
        media.innerHTML = `<img src="${escapeHTML(detail.image)}" alt="${escapeHTML(detail.title || 'Main WallPrint Details')}">`;
      } else {
        media.innerHTML = '<span>MWP</span>';
      }
    }
    if(action){
      action.textContent = detail.actionText || 'Projekt anfragen';
      action.setAttribute('href', detail.actionHref || '#contact');
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => panel?.focus({preventScroll:true}), 20);
  }

  function closeDetailModal(){
    const modal = $('#detailModal');
    if(!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function detailFromCard(card){
    return {
      category: card.dataset.detailCategory || 'Details',
      title: card.dataset.detailTitle || $('.mosaic-card h3', card)?.textContent || 'Main WallPrint',
      subtitle: card.dataset.detailSubtitle || $('p', card)?.textContent || '',
      body: card.dataset.detailBody || $('p', card)?.textContent || '',
      image: card.dataset.detailImage || '',
      actionText: card.dataset.detailActionText || 'Projekt anfragen',
      actionHref: card.dataset.detailActionHref || '#contact'
    };
  }

  function detailFromPost(post, index=0){
    return {
      category: post.category || 'Post',
      title: post.title || 'Main WallPrint Post',
      subtitle: post.excerpt || '',
      body: post.body || post.excerpt || '',
      image: post.image || fallbackPostImages[index % fallbackPostImages.length],
      actionText: 'Anfrage starten',
      actionHref: '#contact'
    };
  }

  function initDetailModal(){
    const modal = $('#detailModal');
    if(!modal) return;
    $$('[data-detail-close]', modal).forEach(btn => btn.addEventListener('click', closeDetailModal));
    $('#detailModalAction')?.addEventListener('click', () => closeDetailModal());
    document.addEventListener('keydown', event => {
      if(event.key === 'Escape' && modal.classList.contains('is-open')) closeDetailModal();
    });
    $$('[data-detail-card]').forEach(card => {
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `${card.dataset.detailTitle || 'Details'} anzeigen`);
      const open = (event) => {
        event.preventDefault();
        openDetailModal(detailFromCard(card));
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', event => {
        if(event.key === 'Enter' || event.key === ' '){
          event.preventDefault();
          openDetailModal(detailFromCard(card));
        }
      });
    });
  }


  function initHeaderScroll(){
    const update = () => {
      const progress = Math.min(Math.max(window.scrollY / 500, 0), 1);
      document.documentElement.style.setProperty('--header-darkness', progress.toFixed(3));
      document.body.classList.toggle('header-scrolled', progress > 0.02);
    };
    update();
    window.addEventListener('scroll', update, {passive:true});
    window.addEventListener('resize', update);
  }

  function initNav(){
    const header = $('.header');
    const toggle = $('.menu-toggle');
    if(!header || !toggle) return;
    toggle.addEventListener('click', () => {
      const open = header.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    $$('.nav a').forEach(a => a.addEventListener('click', () => header.classList.remove('open')));
  }

  function initReveal(){
    const items = $$('[data-reveal]');
    if(!items.length) return;
    items.forEach(el => el.classList.add('reveal-init'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {threshold:.12});
    items.forEach(el => observer.observe(el));
  }

  function initHeroPrint(){
    const wall = $('.hero-wall');
    const textInput = $('#heroTextInput');
    const heroText = $('#heroPrintText');
    const fileInput = $('#heroImageInput');
    const image = $('#heroPrintImage');
    const replay = $('#heroReplay');
    const clear = $('#heroClear');
    const moveUp = $('#heroMoveUp');
    const moveDown = $('#heroMoveDown');
    const moveLeft = $('#heroMoveLeft');
    const moveRight = $('#heroMoveRight');
    const sizeRange = $('#heroPrintSize');
    if(!wall || !textInput || !heroText) return;

    const pos = {x:25, y:22, size:53};

    function clamp(value, min, max){
      return Math.min(Math.max(value, min), max);
    }

    function applyPosition(){
      if(image){
        image.style.left = `${pos.x}%`;
        image.style.top = `${pos.y}%`;
        image.style.width = `${pos.size}%`;
      }
      heroText.style.left = `${pos.x}%`;
      heroText.style.top = `${pos.y + 3}%`;
      heroText.style.maxWidth = `${Math.max(42, pos.size + 8)}%`;
    }

    function nudge(dx=0, dy=0){
      pos.x = clamp(pos.x + dx, 4, 70);
      pos.y = clamp(pos.y + dy, 6, 62);
      applyPosition();
      play();
    }

    function play(){
      wall.classList.remove('printing');
      void wall.offsetWidth;
      wall.classList.add('printing');
    }

    textInput.addEventListener('input', () => {
      heroText.textContent = textInput.value.trim() || 'Main WallPrint';
      wall.classList.remove('image-mode');
      applyPosition();
      play();
    });

    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if(!file) return;
      toast('Motiv wird vorbereitet …');
      const prepared = await prepareArtworkFile(file);
      if(prepared?.dataUrl){
        image.src = prepared.dataUrl;
        wall.classList.add('image-mode');
        applyPosition();
        play();
        toast('Motiv gesetzt.');
      }
    });

    moveUp?.addEventListener('click', () => nudge(0, -5));
    moveDown?.addEventListener('click', () => nudge(0, 5));
    moveLeft?.addEventListener('click', () => nudge(-5, 0));
    moveRight?.addEventListener('click', () => nudge(5, 0));
    sizeRange?.addEventListener('input', () => {
      pos.size = clamp(Number(sizeRange.value) || 53, 28, 82);
      applyPosition();
    });

    replay?.addEventListener('click', play);
    clear?.addEventListener('click', () => {
      if(image) image.removeAttribute('src');
      if(fileInput) fileInput.value = '';
      wall.classList.remove('image-mode');
      heroText.textContent = textInput.value.trim() || 'Main WallPrint';
      pos.x = 25; pos.y = 22; pos.size = Number(sizeRange?.value) || 53;
      applyPosition();
      play();
      toast('Motiv gelöscht.');
    });

    applyPosition();
    setTimeout(play, 700);
  }

  function initCalculator(){
    const form = $('#priceForm');
    if(!form) return;
    const fields = ['width','height','quality','surface','designService','urgency','currency'].map(id => $('#'+id));
    const priceOutput = $('#priceOutput');
    const areaOutput = $('#areaOutput');
    const breakdown = $('#breakdown');
    const copy = $('#copyEstimate');

    const multipliers = {
      quality:{standard:1, premium:1.22, ultra:1.45},
      surface:{smooth:1, textured:1.12, panel:1.08},
      designService:{ready:0, minor:95, new:320},
      urgency:{normal:1, fast:1.18}
    };
    function calc(){
      const width = Math.max(parseFloat($('#width').value) || 0, 0);
      const height = Math.max(parseFloat($('#height').value) || 0, 0);
      const area = width * height;
      const baseRate = 84;
      const minProject = 290;
      const quality = $('#quality').value;
      const surface = $('#surface').value;
      const design = $('#designService').value;
      const urgency = $('#urgency').value;
      const currency = $('#currency').value;
      const printEUR = Math.max(area * baseRate * multipliers.quality[quality] * multipliers.surface[surface], minProject);
      const designEUR = multipliers.designService[design];
      const subtotalEUR = (printEUR + designEUR) * multipliers.urgency[urgency];
      const converted = convertFromEUR(subtotalEUR, currency);
      const rows = [
        ['Fläche', `${area.toFixed(2)} m²`],
        ['Druck & Oberfläche', formatMoney(convertFromEUR(printEUR, currency), currency)],
        ['Design-Service', formatMoney(convertFromEUR(designEUR, currency), currency)],
        ['Dringlichkeit', urgency === 'fast' ? '+18%' : 'Normal'],
        ['Business-Type', 'Entfernt ✓']
      ];
      priceOutput.textContent = formatMoney(converted, currency);
      areaOutput.textContent = `Schätzung für ${width.toFixed(1)} m × ${height.toFixed(1)} m. Final nach Prüfung.`;
      breakdown.innerHTML = rows.map(([k,v]) => `<div class="breakdown-row"><span>${k}</span><strong>${v}</strong></div>`).join('');
      return {width,height,area,price:formatMoney(converted,currency),currency,quality,surface,design,urgency};
    }
    fields.forEach(el => el?.addEventListener('input', calc));
    fields.forEach(el => el?.addEventListener('change', calc));
    copy?.addEventListener('click', async () => {
      const c = calc();
      const txt = `Main WallPrint Preis-Schätzung\nFläche: ${c.width}m x ${c.height}m (${c.area.toFixed(2)} m²)\nPreis: ${c.price}\nQualität: ${c.quality}\nOberfläche: ${c.surface}\nDesign: ${c.design}\nBusiness-Type: entfernt`;
      try { await navigator.clipboard.writeText(txt); toast('Schätzung wurde kopiert.'); }
      catch { downloadJSON('main-wallprint-estimate.json', c); toast('Clipboard nicht verfügbar, JSON wurde heruntergeladen.'); }
    });
    calc();
  }

  function initSimulator(){
    const wall = $('#simWall');
    const obj = $('#simObject');
    if(!wall || !obj) return;
    const text = $('#simText'), artwork = $('#simArtwork'), wallUpload = $('#simWallUpload'), size = $('#simSize'), x = $('#simX'), y = $('#simY');
    function updatePosition(){
      obj.style.left = `${x.value}%`;
      obj.style.top = `${y.value}%`;
      if(obj.classList.contains('image-mode')){
        obj.style.width = `${size.value}%`;
        obj.style.fontSize = '';
      } else {
        obj.style.width = 'auto';
        obj.style.fontSize = `${Math.max(18, Number(size.value) * 1.2)}px`;
      }
    }
    text?.addEventListener('input', () => {
      obj.classList.remove('image-mode');
      obj.classList.add('text-mode');
      obj.textContent = text.value.trim() || 'Ihr Motiv';
      updatePosition();
    });
    artwork?.addEventListener('change', async () => {
      const file = artwork.files && artwork.files[0];
      if(!file) return;
      toast('Motiv wird vorbereitet und freigestellt …');
      const prepared = await prepareArtworkFile(file);
      if(prepared?.dataUrl){
        obj.classList.add('image-mode');
        obj.classList.remove('text-mode');
        obj.innerHTML = `<img alt="Preview artwork" src="${prepared.dataUrl}">`;
        updatePosition();
        toast('Vorschau aktualisiert. Hintergrund wurde automatisch entfernt.');
      }
    });
    wallUpload?.addEventListener('change', async () => {
      const file = wallUpload.files && wallUpload.files[0];
      if(!file) return;
      const read = await readFile(file);
      if(read?.dataUrl){
        wall.style.background = `linear-gradient(0deg,rgba(0,0,0,.15),rgba(0,0,0,.15)), url('${read.dataUrl}') center/cover`;
      }
    });
    [size,x,y].forEach(input => input?.addEventListener('input', updatePosition));
    $('#simReset')?.addEventListener('click', () => {
      if(text) text.value='Ihr Motiv'; if(size) size.value=38; if(x) x.value=50; if(y) y.value=42;
      obj.className='sim-object text-mode'; obj.textContent='Ihr Motiv';
      updatePosition();
    });
    $('#simRemoveImages')?.addEventListener('click', () => {
      if(artwork) artwork.value=''; if(wallUpload) wallUpload.value='';
      wall.removeAttribute('style'); obj.className='sim-object text-mode'; obj.textContent = text?.value || 'Ihr Motiv'; updatePosition();
    });
    updatePosition();
  }

  function initConfigurator(){
    const form = $('#configForm');
    if(!form) return;
    const steps = $$('.config-step', form);
    let index = 0;
    const state = {contentType:'', designState:'', files:[]};
    const progress = $('#progressBar');
    const back = $('#configBack'), next = $('#configNext'), skip = $('#configSkip'), submit = $('#configSubmit');

    function setStep(i){
      index = Math.max(0, Math.min(steps.length-1, i));
      steps.forEach((step, idx) => step.classList.toggle('active', idx === index));
      if(progress) progress.style.width = `${((index+1)/steps.length)*100}%`;
      if(back) back.disabled = index === 0;
      next?.classList.toggle('hidden', index === steps.length-1);
      skip?.classList.toggle('hidden', index === steps.length-1);
      submit?.classList.toggle('hidden', index !== steps.length-1);
      if(index === steps.length-1) renderSummary();
    }
    $$('.option-grid').forEach(grid => {
      grid.addEventListener('click', e => {
        const btn = e.target.closest('button[data-value]'); if(!btn) return;
        $$('button', grid).forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        state[grid.dataset.name] = btn.dataset.value;
      });
    });
    $('#configFiles')?.addEventListener('change', e => renderFileList(e.currentTarget, '#configFileList'));
    function collectSummary(){
      return {
        id:uid('config'), trackingId:trackingId(), type:'configurator', status:'new', createdAt:new Date().toISOString(),
        statusHistory:[{status:'new', date:new Date().toISOString(), note:'Konfigurator-Anfrage wurde erstellt.'}],
        contentType:state.contentType || 'Nicht ausgewählt',
        designState:state.designState || 'Nicht ausgewählt',
        width:$('#configWidth')?.value || '', height:$('#configHeight')?.value || '', unknownSize:$('#unknownSize')?.checked || false,
        name:$('#configName')?.value || '', email:$('#configEmail')?.value || '', notes:$('#configNotes')?.value || ''
      };
    }
    function renderSummary(){
      const s = collectSummary();
      const files = Array.from($('#configFiles')?.files || []).map(f=>f.name);
      $('#configSummary').innerHTML = `
        <div><strong>Inhalt:</strong> ${escapeHTML(s.contentType)}</div>
        <div><strong>Dateien:</strong> ${files.length ? files.map(escapeHTML).join(', ') : 'Keine Dateien gewählt'}</div>
        <div><strong>Größe:</strong> ${s.unknownSize ? 'Maße unbekannt' : `${escapeHTML(s.width || '?')}m × ${escapeHTML(s.height || '?')}m`}</div>
        <div><strong>Design:</strong> ${escapeHTML(s.designState)}</div>
        <div><strong>Kontakt:</strong> ${escapeHTML(s.name || '—')} · ${escapeHTML(s.email || '—')}</div>
        <div><strong>Notizen:</strong> ${escapeHTML(s.notes || '—')}</div>`;
    }
    back?.addEventListener('click', () => setStep(index-1));
    next?.addEventListener('click', () => setStep(index+1));
    skip?.addEventListener('click', () => setStep(index+1));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const data = collectSummary();
      const {files, skipped} = await readFiles($('#configFiles'), 5);
      data.files = files;
      data.skippedFiles = skipped.map(f => ({name:f.name,size:f.size,type:f.type}));
      const list = getInquiries(); list.unshift(data); saveInquiries(list);
      toast('Anfrage gespeichert.');
      downloadJSON(`main-wallprint-configurator-${Date.now()}.json`, data);
      form.reset();
      $$('.option-grid button').forEach(b => b.classList.remove('selected'));
      state.contentType=''; state.designState=''; setStep(0); $('#configFileList').innerHTML='';
    });
    setStep(0);
  }

  function initPosts(){
    const grid = $('#postGrid');
    if(!grid) return;
    const posts = getPosts().filter(p => p.status === 'published').sort((a,b) => String(b.date).localeCompare(String(a.date))).slice(0,9);
    grid.innerHTML = posts.map((post, index) => `
      <article class="post-card" tabindex="0" role="button" aria-label="${escapeHTML(post.title || 'Post')} Details anzeigen">
        <div class="post-image">${post.image ? `<img src="${escapeHTML(post.image)}" alt="${escapeHTML(post.title)}">` : 'MWP'}</div>
        <div class="post-body">
          <div class="post-meta">${escapeHTML(post.category || 'Post')} · ${escapeHTML(post.date || '')}</div>
          <h3>${escapeHTML(post.title)}</h3>
          <p>${escapeHTML(post.excerpt || post.body || '')}</p>
          <button class="mini-btn muted post-more" type="button">Details ansehen</button>
        </div>
      </article>`).join('');
    $$('.post-card', grid).forEach((card, index) => {
      const open = (event) => {
        event.preventDefault();
        openDetailModal(detailFromPost(posts[index], index));
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', event => {
        if(event.key === 'Enter' || event.key === ' '){
          event.preventDefault();
          openDetailModal(detailFromPost(posts[index], index));
        }
      });
    });
  }

  function setContactStatus(message, isError=false){
    const box = $('#contactStatus');
    if(!box) return;
    box.innerHTML = message;
    box.classList.toggle('error', Boolean(isError));
    box.classList.add('show');
  }

  function buildContactPayload(){
    return {
      id:uid('contact'),
      trackingId:trackingId(),
      type:'Main WallPrint Kontaktformular',
      status:'new',
      createdAt:new Date().toISOString(),
      statusHistory:[{status:'new', date:new Date().toISOString(), note:'Kontaktanfrage wurde erstellt.'}],
      formName:'Main WallPrint Projektanfrage – Website',
      name:$('#contactName')?.value.trim() || '',
      email:$('#contactEmail')?.value.trim() || '',
      phone:$('#contactPhone')?.value.trim() || '',
      city:$('#contactCity')?.value.trim() || '',
      projectType:$('#contactProjectType')?.value || '',
      designState:$('#contactDesignState')?.value || '',
      width:$('#contactWidth')?.value || '',
      height:$('#contactHeight')?.value || '',
      surface:$('#contactSurface')?.value || '',
      message:$('#contactMessage')?.value.trim() || '',
      consent:$('#contactConsent')?.checked || false
    };
  }

  function contactMailText(data){
    return [
      'Hallo Main WallPrint Team,',
      '',
      'ich möchte unverbindlich ein Wanddruck-Projekt anfragen.',
      '',
      '— Kontaktdaten —',
      `Name: ${data.name || '-'}`,
      `E-Mail: ${data.email || '-'}`,
      `Telefon: ${data.phone || '-'}`,
      `Stadt / PLZ: ${data.city || '-'}`,
      '',
      '— Projektangaben —',
      `Was soll gedruckt werden?: ${data.projectType || '-'}`,
      `Designzustand: ${data.designState || '-'}`,
      `Maße: ${data.width || '?'} m × ${data.height || '?'} m`,
      `Wandzustand: ${data.surface || '-'}`,
      '',
      '— Nachricht —',
      data.message || '-',
      '',
      'Hinweis: Dateien wurden über das Website-Formular ausgewählt. In der Static-Demo werden sie im Admin-Bereich lokal gespeichert oder als JSON exportiert.'
    ].join('\n');
  }

  function openPreparedEmail(data){
    const subjectParts = ['Main WallPrint Anfrage'];
    if(data.projectType) subjectParts.push(data.projectType);
    if(data.city) subjectParts.push(data.city);
    const subject = subjectParts.join(' – ');
    const href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(contactMailText(data))}`;
    window.location.href = href;
  }

  function validateContact(data){
    const errors = [];
    if(!data.name) errors.push('Name');
    if(!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('gültige E-Mail-Adresse');
    if(!data.projectType) errors.push('Projektart');
    if(!data.designState) errors.push('Designzustand');
    if(!data.message) errors.push('Nachricht');
    if(!data.consent) errors.push('Einverständnis');
    return errors;
  }

  function initContact(){
    const form = $('#contactForm');
    if(!form) return;
    const fileInput = $('#contactFiles');
    const prepareEmailBtn = $('#prepareEmailBtn');
    fileInput?.addEventListener('change', e => renderFileList(e.currentTarget, '#contactFileList'));

    prepareEmailBtn?.addEventListener('click', () => {
      const data = buildContactPayload();
      const errors = validateContact(data).filter(label => label !== 'Einverständnis');
      if(errors.length){
        setContactStatus(`Bitte ergänzen: ${errors.join(', ')}.`, true);
        toast('Bitte fehlende Felder ergänzen.');
        return;
      }
      openPreparedEmail(data);
      setContactStatus('E-Mail-Entwurf wurde vorbereitet. Falls sich kein Mailprogramm öffnet, bitte E-Mail-Adresse im README anpassen oder Formular normal speichern.');
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const data = buildContactPayload();
      const errors = validateContact(data);
      if(errors.length){
        setContactStatus(`Bitte ergänzen: ${errors.join(', ')}.`, true);
        toast('Bitte prüfe das Kontaktformular.');
        return;
      }
      const {files, skipped} = await readFiles(fileInput, 8);
      data.files = files;
      data.fileNames = files.map(f => f.name);
      data.skippedFiles = skipped.map(f => ({name:f.name,size:f.size,type:f.type}));
      const list = getInquiries();
      list.unshift(data);
      saveInquiries(list);
      downloadJSON(`main-wallprint-contact-${Date.now()}.json`, data);
      setContactStatus(`Danke! Anfrage gespeichert.<br><strong>Tracking-ID:</strong> ${escapeHTML(data.trackingId)}<br>Mit E-Mail zum Tracking nutzen.`);
      toast('Kontaktanfrage gespeichert.');
      form.reset();
      $('#contactFileList').innerHTML = '';
    });
  }


  function initTeamPage(){
    const cards = $$('[data-team-card]');
    if(!cards.length) return;
    cards.forEach(card => {
      const open = $('.team-open', card);
      const close = $('.team-close', card);
      open?.addEventListener('click', () => {
        cards.forEach(c => c.classList.toggle('active', c === card));
        card.scrollIntoView({behavior:'smooth', block:'start'});
      });
      close?.addEventListener('click', (event) => {
        event.stopPropagation();
        card.classList.remove('active');
      });
    });
    document.addEventListener('keydown', (event) => {
      if(event.key === 'Escape') cards.forEach(c => c.classList.remove('active'));
    });
  }


  function renderTrackingResult(item){
    const box = $('#trackingResult');
    if(!box) return;
    if(!item){
      box.innerHTML = `<p class="eyebrow">Status</p><h3>Nichts gefunden</h3><p class="muted">Bitte prüfe Tracking-ID und E-Mail-Adresse. Bei alten Demo-Anfragen ohne Tracking-ID bitte im Admin-Bereich eine Anfrage öffnen.</p>`;
      box.classList.add('not-found');
      return;
    }
    normalizeInquiry(item);
    const progress = statusProgress(item.status);
    const history = (item.statusHistory || []).slice().reverse().map(h => `
      <li>
        <strong>${escapeHTML(statusLabel(h.status))}</strong>
        <span>${new Date(h.date).toLocaleString('de-DE')}</span>
        ${h.note ? `<p>${escapeHTML(h.note)}</p>` : ''}
      </li>`).join('');
    box.classList.remove('not-found');
    box.innerHTML = `
      <p class="eyebrow">Tracking-ID</p>
      <h3>${escapeHTML(item.trackingId)}</h3>
      <div class="status-pill">${escapeHTML(statusLabel(item.status))}</div>
      <div class="tracking-progress"><span style="width:${progress}%"></span></div>
      <div class="tracking-details">
        <div><strong>Kunde</strong><span>${escapeHTML(item.name || '—')}</span></div>
        <div><strong>E-Mail</strong><span>${escapeHTML(item.email || '—')}</span></div>
        <div><strong>Projekt</strong><span>${escapeHTML(item.projectType || item.contentType || '—')}</span></div>
        <div><strong>Datum</strong><span>${new Date(item.createdAt).toLocaleString('de-DE')}</span></div>
      </div>
      ${item.adminNote ? `<div class="client-note"><strong>Nachricht vom Team</strong><p>${escapeHTML(item.adminNote)}</p></div>` : ''}
      <ol class="tracking-history">${history}</ol>
    `;
  }

  function initTracking(){
    const form = $('#trackingForm');
    if(!form) return;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const id = ($('#trackingIdInput')?.value || '').trim().toUpperCase();
      const email = ($('#trackingEmailInput')?.value || '').trim().toLowerCase();
      const inquiries = getInquiries().map(normalizeInquiry);
      saveInquiries(inquiries);
      const match = inquiries.find(item => String(item.trackingId || '').toUpperCase() === id && String(item.email || '').trim().toLowerCase() === email);
      renderTrackingResult(match || null);
    });
  }

  function initYear(){ const y=$('#year'); if(y) y.textContent = new Date().getFullYear(); }

  document.addEventListener('DOMContentLoaded', () => {
    initYear(); initHeaderScroll(); initNav(); initReveal(); initDetailModal(); initHeroPrint(); initCalculator(); initSimulator(); initConfigurator(); initPosts(); initTeamPage(); initTracking(); initContact();
  });

  window.MWP = {getPosts, getInquiries, saveInquiries, escapeHTML, readFile, downloadJSON, toast, openDetailModal, closeDetailModal, STORAGE_POSTS, STORAGE_INQUIRIES, defaultPosts, trackingId, statusLabel, statusProgress, normalizeInquiry, ORDER_STATUSES};
})();
