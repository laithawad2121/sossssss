(function(){
  'use strict';

  const SERVICE_PROJECTS = {
    akustikpaneele: {
      slug:'akustikpaneele',
      number:'01',
      category:'Service',
      title:'Druck auf Akustikpaneele',
      excerpt:'Akustik trifft Design: bedruckte Paneele für Räume, die gut aussehen und angenehm klingen.',
      body:[
        'Akustikpaneele können mehr sein als eine technische Lösung. Mit einem individuellen Druck werden sie Teil des Raumdesigns und bleiben gleichzeitig funktional.',
        'Ideal für Büros, Meetingräume, Studios, Hotels, Restaurants oder private Räume, in denen Atmosphäre und Klang zusammenpassen sollen.'
      ],
      image:'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1600&q=84',
      facts:{'Einsatz':'Büro, Studio, Hotel, Praxis', 'Material':'Paneel / Platte', 'Look':'Logo, Muster, Foto, Illustration', 'Ziel':'Design + bessere Raumwirkung'},
      features:['Direkter Druck auf geeignete Paneele', 'Hochwertige Optik passend zur Marke', 'Saubere Vorbereitung der Druckdaten'],
      process:['Motiv und Paneel prüfen', 'Layout und Maßstab abstimmen', 'Druckdaten vorbereiten', 'Produktion und Übergabe planen']
    },
    wanddrucke: {
      slug:'wanddrucke',
      number:'02',
      category:'Service',
      title:'Wanddrucke',
      excerpt:'Logos, Motive und Illustrationen direkt auf die Wand gedruckt – ohne klassische Folie.',
      body:[
        'Wanddrucke eignen sich für Brand Walls, Empfangsbereiche, Kinderzimmer, Showrooms oder kreative Innenräume. Das Motiv wird passend zur Wandfläche geplant und direkt vor Ort umgesetzt.',
        'Vor dem Druck werden Oberfläche, Größe und Designzustand geprüft, damit das Ergebnis sauber und hochwertig wirkt.'
      ],
      image:'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1600&q=84',
      facts:{'Einsatz':'Innenräume & Markenflächen', 'Oberfläche':'Glatte oder geprüfte Wand', 'Motiv':'Logo, Text, Foto, Illustration', 'Vorteil':'Individuell und präzise'},
      features:['Direkter Druck auf Wandflächen', 'Passend für Corporate Design', 'Skalierung nach Raum und Motiv'],
      process:['Wandfoto und Maße senden', 'Motiv finalisieren', 'Termin und Fläche vorbereiten', 'Druck vor Ort umsetzen']
    },
    designerstellung: {
      slug:'designerstellung',
      number:'03',
      category:'Design',
      title:'Designerstellung',
      excerpt:'Design erstellen, optimieren oder druckfertig machen – vom ersten Motiv bis zur finalen Datei.',
      body:[
        'Wenn ein Motiv noch nicht fertig ist, kann es für den Wanddruck vorbereitet oder komplett neu gestaltet werden. Dazu gehören Layout, Farbwirkung, Dateiauflösung und die Anpassung an die konkrete Wandfläche.',
        'So entsteht aus einer Idee ein druckfertiges Konzept, das im Raum funktioniert und technisch sauber produziert werden kann.'
      ],
      image:'https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=1600&q=84',
      facts:{'Einsatz':'Vorbereitung & Gestaltung', 'Input':'Logo, Skizze, Foto oder Idee', 'Output':'Druckfertige Datei', 'Fokus':'Look, Maßstab, technische Prüfung'},
      features:['Motivbearbeitung und Layout', 'Druckdaten-Check', 'Anpassung an Wandgröße und Raumwirkung'],
      process:['Idee oder Datei senden', 'Designrichtung abstimmen', 'Entwurf prüfen', 'Finale Druckdaten vorbereiten']
    }
  };

  const DEFAULT_POSTS = [
    {id:'demo-1', title:'Druck auf Akustikpaneele', category:'Service', status:'published', date:'2026-06-16', excerpt:'Akustik trifft Design.', body:'Funktionale Paneele mit starkem Look.', image:''},
    {id:'demo-2', title:'Wanddrucke', category:'Service', status:'published', date:'2026-06-12', excerpt:'Logos, Motive und Illustrationen.', body:'Direkt auf die Wand gedruckt.', image:''},
    {id:'demo-3', title:'Designerstellung', category:'Design', status:'published', date:'2026-06-08', excerpt:'Design erstellen oder vorbereiten.', body:'Vom Motiv zur druckfertigen Datei.', image:''}
  ];

  const $ = (sel, root=document) => root.querySelector(sel);
  const escapeHTML = window.MWP?.escapeHTML || function(str){
    return String(str ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  };

  function getPosts(){
    if(window.MWP?.getPosts) return window.MWP.getPosts();
    try {
      const stored = JSON.parse(localStorage.getItem('mwp_posts_v1') || '[]');
      return Array.isArray(stored) && stored.length ? stored : DEFAULT_POSTS;
    } catch(err){
      return DEFAULT_POSTS;
    }
  }

  function paragraphs(value){
    if(Array.isArray(value)) return value;
    return String(value || '').split(/\n{2,}/).map(item => item.trim()).filter(Boolean);
  }

  function postToProject(post){
    const title = post?.title || 'Post';
    return {
      slug:post?.id || title,
      number:'POST',
      category:post?.category || 'Post',
      title,
      excerpt:post?.excerpt || 'Details aus dem Admin-Bereich.',
      body:paragraphs(post?.body || post?.excerpt || 'Noch keine ausführlichen Details hinterlegt.'),
      image:post?.image || '',
      date:post?.date || '',
      facts:{'Typ':post?.category || 'Post', 'Datum':post?.date || '—', 'Quelle':'Admin-Inhalt', 'Status':post?.status || 'published'},
      features:['Gleiche Projektseiten-Vorlage', 'Bild und Text aus dem Admin', 'Direkter Kontakt über Anfrage-Button'],
      process:['Inhalt ansehen', 'Projektidee prüfen', 'Kontakt aufnehmen', 'Details gemeinsam finalisieren']
    };
  }

  function findContent(){
    const params = new URLSearchParams(window.location.search);
    const projectSlug = params.get('project');
    const postId = params.get('post');
    if(projectSlug && SERVICE_PROJECTS[projectSlug]) return {type:'project', data:SERVICE_PROJECTS[projectSlug]};
    if(postId){
      const decoded = decodeURIComponent(postId);
      const posts = getPosts();
      const match = posts.find(post => String(post.id || '') === decoded || String(post.title || '') === decoded);
      if(match) return {type:'post', data:postToProject(match)};
    }
    return {type:'missing', data:null};
  }

  function imageBackground(url){
    if(!url) return 'radial-gradient(circle at 35% 28%, rgba(67,255,97,.28), transparent 27%), linear-gradient(135deg,#262c26,#050505 70%)';
    const safeUrl = String(url).replace(/"/g, '%22');
    return `linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.52)), url("${safeUrl}")`;
  }

  function renderFacts(facts){
    return Object.entries(facts || {}).map(([key, value]) => `
      <div class="project-fact-row">
        <span>${escapeHTML(key)}</span>
        <strong>${escapeHTML(value)}</strong>
      </div>`).join('');
  }

  function renderFeatures(features){
    return (features || []).map((item, index) => `
      <div class="project-feature-card">
        <span>${String(index + 1).padStart(2, '0')}</span>
        <strong>${escapeHTML(item)}</strong>
      </div>`).join('');
  }

  function renderProcess(steps){
    return (steps || []).map((item, index) => `
      <article class="project-step">
        <span>${String(index + 1).padStart(2, '0')}</span>
        <h3>${escapeHTML(item)}</h3>
      </article>`).join('');
  }

  function renderRelated(current){
    const services = Object.values(SERVICE_PROJECTS).filter(item => item.slug !== current.slug);
    return services.map(item => `
      <a class="related-card" href="project.html?project=${encodeURIComponent(item.slug)}">
        <span>${escapeHTML(item.number)}</span>
        <strong>${escapeHTML(item.title)}</strong>
        <small>${escapeHTML(item.excerpt)}</small>
      </a>`).join('');
  }

  function renderMissing(){
    $('#projectTitle').textContent = 'Projekt nicht gefunden';
    $('#projectExcerpt').textContent = 'Der angeforderte Inhalt ist nicht verfügbar. Bitte zurück zur Übersicht gehen.';
    $('#projectBody').innerHTML = '<p>Die Projektseite konnte nicht geladen werden. Das kann passieren, wenn ein Admin-Post gelöscht wurde oder der Link nicht mehr aktuell ist.</p>';
    $('#projectFacts').innerHTML = renderFacts({'Status':'Nicht gefunden'});
    $('#projectFeatures').innerHTML = '';
    $('#projectProcess').innerHTML = renderProcess(['Zur Übersicht zurückkehren', 'Projekt neu auswählen', 'Kontakt aufnehmen']);
    $('#projectRelated').innerHTML = renderRelated({slug:''});
    $('#projectHeroArt').style.backgroundImage = imageBackground('');
    document.title = 'Projekt nicht gefunden | Main WallPrint';
  }

  function renderProject(project){
    document.title = `${project.title} | Main WallPrint`;
    $('#projectCategory').textContent = project.category || 'Projekt';
    $('#projectNumber').textContent = project.number || 'MWP';
    $('#projectTitle').textContent = project.title;
    $('#projectExcerpt').textContent = project.excerpt || '';
    $('#projectDetailTitle').textContent = project.title;
    $('#projectBody').innerHTML = paragraphs(project.body).map(text => `<p>${escapeHTML(text)}</p>`).join('');
    $('#projectFeatures').innerHTML = renderFeatures(project.features);
    $('#projectFacts').innerHTML = renderFacts(project.facts);
    $('#projectProcess').innerHTML = renderProcess(project.process);
    $('#projectRelated').innerHTML = renderRelated(project);
    const heroArt = $('#projectHeroArt');
    heroArt.style.backgroundImage = imageBackground(project.image);
    heroArt.href = 'index.html#services';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const result = findContent();
    if(result.type === 'missing') renderMissing();
    else renderProject(result.data);
  });
})();
