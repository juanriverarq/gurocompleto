/**
 * Editor Bridge — Injected into Jano iframe for visual editing.
 * Communicates with parent editor via postMessage.
 */
(function() {
  'use strict';

  let editMode = false;
  let selectedElement = null;
  let selectedSection = null;
  let sections = [];
  let undoStack = [];
  let redoStack = [];

  const STYLES = `
    .eb-section-hover { outline: 2px dashed rgba(99,102,241,0.5); outline-offset: -2px; position: relative; }
    .eb-section-selected { outline: 2px solid #6366f1; outline-offset: -2px; position: relative; }
    .eb-section-label {
      display:none; position:absolute; top:0; left:0; background:#6366f1; color:#fff;
      font-size:11px; font-weight:600; padding:3px 10px; z-index:9999;
      font-family:system-ui,sans-serif; border-radius:0 0 6px 0; pointer-events:auto;
    }
    .eb-section-hover > .eb-section-label,
    .eb-section-selected > .eb-section-label { display:flex; align-items:center; gap:6px; }
    .eb-section-actions {
      display:none; position:absolute; top:0; right:0; z-index:9999;
      pointer-events:auto; gap:2px; padding:2px;
    }
    .eb-section-hover > .eb-section-actions,
    .eb-section-selected > .eb-section-actions { display:flex; }
    .eb-section-actions button {
      width:26px; height:26px; border:none; border-radius:4px;
      background:#6366f1; color:#fff; cursor:pointer; font-size:12px;
      display:flex; align-items:center; justify-content:center;
    }
    .eb-section-actions button:hover { background:#4f46e5; }
    .eb-section-actions button.eb-danger { background:#ef4444; }
    .eb-editable-hover { outline:1px dashed rgba(99,102,241,0.4)!important; outline-offset:2px; cursor:text!important; }
    .eb-editable-selected { outline:2px solid #6366f1!important; outline-offset:2px; }
    .eb-img-hover { outline:2px dashed rgba(99,102,241,0.5)!important; cursor:pointer!important; }
    .eb-img-selected { outline:2px solid #6366f1!important; }
    .eb-hidden-section { display:none!important; }
    [contenteditable="true"]:focus { outline:2px solid #6366f1!important; outline-offset:2px; }
  `;

  function injectStyles() {
    if (document.getElementById('eb-styles')) return;
    var s = document.createElement('style');
    s.id = 'eb-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  function discoverSections() {
    var root = document.querySelector('.main-page-wrapper') || document.body;
    var found = [];
    var children = root.children;
    for (var i = 0; i < children.length; i++) {
      var el = children[i];
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.id === 'eb-styles') continue;
      if (el.offsetHeight < 10) continue;
      var cls = el.className || '';
      var label = 'Sección';
      if (/hero.banner/i.test(cls)) label = 'Hero';
      else if (/fancy.feature/i.test(cls)) label = 'Feature';
      else if (/fancy.short.banner/i.test(cls)) label = 'Banner';
      else if (/feedback|testimonial/i.test(cls)) label = 'Testimonios';
      else if (/blog.section/i.test(cls)) label = 'Blog';
      else if (/footer/i.test(cls)) label = 'Footer';
      else if (/pricing/i.test(cls)) label = 'Precios';
      else if (/team/i.test(cls)) label = 'Equipo';
      else if (/portfolio|gallery/i.test(cls)) label = 'Portfolio';
      else if (/contact|address/i.test(cls)) label = 'Contacto';
      else if (/faq/i.test(cls)) label = 'FAQ';
      else if (/counter/i.test(cls)) label = 'Contador';
      else if (/partner|brand/i.test(cls)) label = 'Partners';
      else if (/theme.main.menu|header|navbar/i.test(cls) || el.tagName === 'HEADER') label = 'Header';
      else { var h = el.querySelector('h1,h2,h3'); if (h) label = h.textContent.trim().substring(0,25) || 'Sección'; }
      var id = 'eb-s-' + i;
      el.setAttribute('data-eb-section', id);
      if (!el.style.position || el.style.position === 'static') el.style.position = 'relative';
      found.push({ id:id, index:i, label:label, visible:!el.classList.contains('eb-hidden-section'), element:el });
    }
    sections = found;
    return found.map(function(s){ return {id:s.id, index:s.index, label:s.label, visible:s.visible}; });
  }

  function addOverlays() {
    document.querySelectorAll('.eb-section-label,.eb-section-actions').forEach(function(e){e.remove();});
    sections.forEach(function(sec) {
      var el = sec.element;
      var lbl = document.createElement('div'); lbl.className='eb-section-label';
      lbl.textContent = sec.label; el.appendChild(lbl);
      var acts = document.createElement('div'); acts.className='eb-section-actions';
      acts.innerHTML = '<button data-a="moveUp" title="Subir">↑</button><button data-a="moveDown" title="Bajar">↓</button><button data-a="duplicate" title="Duplicar">⧉</button><button data-a="toggleVisibility" title="Ocultar">👁</button><button data-a="delete" class="eb-danger" title="Eliminar">✕</button>';
      el.appendChild(acts);
      el.onmouseenter = function(){ if(selectedSection!==sec.id) el.classList.add('eb-section-hover'); };
      el.onmouseleave = function(){ el.classList.remove('eb-section-hover'); };
      acts.querySelectorAll('button').forEach(function(btn){
        btn.onclick = function(e){ e.stopPropagation(); sectionAction(sec.id, btn.getAttribute('data-a')); };
      });
    });
  }

  function sectionAction(id, action) {
    var sec = sections.find(function(s){return s.id===id;});
    if(!sec) return;
    var el=sec.element, parent=el.parentNode;
    saveUndo();
    if(action==='moveUp'){ var p=el.previousElementSibling; if(p&&p.hasAttribute('data-eb-section')){parent.insertBefore(el,p);refresh();} }
    else if(action==='moveDown'){ var n=el.nextElementSibling; if(n&&n.hasAttribute('data-eb-section')){parent.insertBefore(n,el);refresh();} }
    else if(action==='duplicate'){ var c=el.cloneNode(true); c.removeAttribute('data-eb-section'); c.querySelectorAll('.eb-section-label,.eb-section-actions').forEach(function(x){x.remove();}); el.after(c); refresh(); }
    else if(action==='toggleVisibility'){ el.classList.toggle('eb-hidden-section'); sec.visible=!el.classList.contains('eb-hidden-section'); notify('SECTIONS_UPDATED',getSections()); }
    else if(action==='delete'){ el.remove(); refresh(); }
  }

  function refresh() { discoverSections(); addOverlays(); setupEditable(); notify('SECTIONS_UPDATED',getSections()); }
  function getSections(){ return sections.map(function(s){return {id:s.id,index:s.index,label:s.label,visible:s.visible};}); }

  function setupEditable() {
    if(!editMode) return;
    document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,a,li,label,blockquote,button,.btn').forEach(function(el){
      if(el.closest('.eb-section-label,.eb-section-actions')) return;
      if(el.children.length>3 || el.textContent.trim().length===0) return;
      el.onmouseenter=function(){if(editMode&&selectedElement!==el)el.classList.add('eb-editable-hover');};
      el.onmouseleave=function(){el.classList.remove('eb-editable-hover');};
      el.onclick=function(e){if(!editMode)return; e.preventDefault();e.stopPropagation();selectEl(el,'text');};
    });
    document.querySelectorAll('img[src]').forEach(function(el){
      if(el.closest('.eb-section-label,.eb-section-actions')) return;
      if(el.width<20||el.height<20) return;
      el.onmouseenter=function(){if(editMode)el.classList.add('eb-img-hover');};
      el.onmouseleave=function(){el.classList.remove('eb-img-hover');};
      el.onclick=function(e){if(!editMode)return; e.preventDefault();e.stopPropagation();selectEl(el,'image');};
    });
  }

  function selectEl(el, type) {
    if(selectedElement){
      selectedElement.classList.remove('eb-editable-selected','eb-img-selected');
      selectedElement.removeAttribute('contenteditable');
    }
    selectedElement = el;
    if(type==='text'){ el.classList.add('eb-editable-selected'); el.setAttribute('contenteditable','true'); el.focus();
      el.oninput=function(){notify('ELEMENT_CHANGED',{type:'text',text:el.textContent,innerHTML:el.innerHTML});};
      el.onblur=function(){saveUndo(); el.oninput=null; el.onblur=null;};
    } else { el.classList.add('eb-img-selected'); }
    var secEl=el.closest('[data-eb-section]');
    if(secEl) selectSection(secEl.getAttribute('data-eb-section'));
    notify('ELEMENT_SELECTED', getElInfo(el,type));
  }

  function getElInfo(el,type) {
    var cs=window.getComputedStyle(el);
    var info={type:type, tagName:el.tagName.toLowerCase(), text:el.textContent||''};
    info.paddingTop=cs.paddingTop; info.paddingRight=cs.paddingRight;
    info.paddingBottom=cs.paddingBottom; info.paddingLeft=cs.paddingLeft;
    info.marginTop=cs.marginTop; info.marginRight=cs.marginRight;
    info.marginBottom=cs.marginBottom; info.marginLeft=cs.marginLeft;
    info.borderRadius=cs.borderRadius;
    info.backgroundColor=cs.backgroundColor;
    if(type==='text'){
      info.fontSize=cs.fontSize; info.fontWeight=cs.fontWeight; info.color=cs.color;
      info.textAlign=cs.textAlign;
      if(el.tagName==='A') info.href=el.getAttribute('href')||'';
    } else {
      info.src=el.getAttribute('src')||''; info.alt=el.getAttribute('alt')||'';
      info.width=el.naturalWidth; info.height=el.naturalHeight;
    }
    return info;
  }

  function selectSection(id) {
    sections.forEach(function(s){s.element.classList.remove('eb-section-selected');});
    selectedSection=id;
    var sec=sections.find(function(s){return s.id===id;});
    if(sec){ sec.element.classList.add('eb-section-selected'); notify('SECTION_SELECTED',{id:sec.id,label:sec.label}); }
  }

  function saveUndo() {
    var root=document.querySelector('.main-page-wrapper')||document.body;
    var c=root.cloneNode(true);
    c.querySelectorAll('.eb-section-label,.eb-section-actions').forEach(function(x){x.remove();});
    c.querySelectorAll('[contenteditable]').forEach(function(x){x.removeAttribute('contenteditable');});
    c.querySelectorAll('[data-eb-section]').forEach(function(x){x.removeAttribute('data-eb-section');});
    undoStack.push(c.innerHTML);
    if(undoStack.length>50) undoStack.shift();
    redoStack=[];
    notify('UNDO_STATE',{canUndo:undoStack.length>1,canRedo:false});
  }

  function undo() {
    if(undoStack.length<2) return;
    redoStack.push(undoStack.pop());
    var root=document.querySelector('.main-page-wrapper')||document.body;
    root.innerHTML=undoStack[undoStack.length-1];
    refresh();
    notify('UNDO_STATE',{canUndo:undoStack.length>1,canRedo:redoStack.length>0});
  }

  function redo() {
    if(!redoStack.length) return;
    var s=redoStack.pop(); undoStack.push(s);
    var root=document.querySelector('.main-page-wrapper')||document.body;
    root.innerHTML=s; refresh();
    notify('UNDO_STATE',{canUndo:undoStack.length>1,canRedo:redoStack.length>0});
  }

  function updateElement(data) {
    if(!selectedElement) return;
    saveUndo();
    if(data.text!==undefined&&selectedElement.tagName!=='IMG') selectedElement.textContent=data.text;
    if(data.color) selectedElement.style.color=data.color;
    if(data.fontSize) selectedElement.style.fontSize=data.fontSize;
    if(data.fontWeight) selectedElement.style.fontWeight=data.fontWeight;
    if(data.textAlign) selectedElement.style.textAlign=data.textAlign;
    if(data.backgroundColor) selectedElement.style.backgroundColor=data.backgroundColor;
    if(data.href!==undefined&&selectedElement.tagName==='A') selectedElement.setAttribute('href',data.href);
    if(data.src&&selectedElement.tagName==='IMG') selectedElement.setAttribute('src',data.src);
    if(data.alt!==undefined&&selectedElement.tagName==='IMG') selectedElement.setAttribute('alt',data.alt);
    if(data.paddingTop!==undefined) selectedElement.style.paddingTop=data.paddingTop;
    if(data.paddingRight!==undefined) selectedElement.style.paddingRight=data.paddingRight;
    if(data.paddingBottom!==undefined) selectedElement.style.paddingBottom=data.paddingBottom;
    if(data.paddingLeft!==undefined) selectedElement.style.paddingLeft=data.paddingLeft;
    if(data.marginTop!==undefined) selectedElement.style.marginTop=data.marginTop;
    if(data.marginRight!==undefined) selectedElement.style.marginRight=data.marginRight;
    if(data.marginBottom!==undefined) selectedElement.style.marginBottom=data.marginBottom;
    if(data.marginLeft!==undefined) selectedElement.style.marginLeft=data.marginLeft;
    if(data.borderRadius!==undefined) selectedElement.style.borderRadius=data.borderRadius;
    var t=selectedElement.tagName==='IMG'?'image':'text';
    notify('ELEMENT_CHANGED',getElInfo(selectedElement,t));
  }

  function reorderSection(fromId, toIndex) {
    var root=document.querySelector('.main-page-wrapper')||document.body;
    var fromEl=root.querySelector('[data-eb-section="'+fromId+'"]');
    if(!fromEl) return;
    saveUndo();
    var sectionEls=Array.from(root.querySelectorAll('[data-eb-section]'));
    if(toIndex>=sectionEls.length){ root.appendChild(fromEl); }
    else if(toIndex<=0){ root.insertBefore(fromEl,sectionEls[0]); }
    else {
      var target=sectionEls[toIndex];
      if(target===fromEl) return;
      var fromIdx=sectionEls.indexOf(fromEl);
      if(fromIdx<toIndex) target.after(fromEl);
      else root.insertBefore(fromEl,target);
    }
    refresh();
  }

  function toggleSectionVisibility(sectionId) {
    var sec=sections.find(function(s){return s.id===sectionId;});
    if(!sec) return;
    sec.element.classList.toggle('eb-hidden-section');
    sec.visible=!sec.element.classList.contains('eb-hidden-section');
    notify('SECTIONS_UPDATED',getSections());
  }

  function insertSection(html, position) {
    saveUndo();
    var root=document.querySelector('.main-page-wrapper')||document.body;
    var tmp=document.createElement('div'); tmp.innerHTML=html;
    var newEl=tmp.firstElementChild;
    if(!newEl) return;
    if(position==='top') root.insertBefore(newEl,root.firstChild);
    else if(position&&position.startsWith('after:')){ var a=root.querySelector('[data-eb-section="'+position.replace('after:','')+'"]'); if(a)a.after(newEl); else root.appendChild(newEl); }
    else { var ft=root.querySelector('[class*="footer"]'); if(ft)root.insertBefore(newEl,ft); else root.appendChild(newEl); }
    refresh();
  }

  function getCleanHTML() {
    var root=document.querySelector('.main-page-wrapper')||document.body;
    var c=root.cloneNode(true);
    c.querySelectorAll('.eb-section-label,.eb-section-actions').forEach(function(x){x.remove();});
    c.querySelectorAll('[contenteditable]').forEach(function(x){x.removeAttribute('contenteditable');});
    c.querySelectorAll('[data-eb-section]').forEach(function(x){x.removeAttribute('data-eb-section');});
    return c.innerHTML;
  }

  function notify(type,data){ window.parent.postMessage({source:'editor-bridge',type:type,data:data},'*'); }

  window.addEventListener('message',function(e){
    if(!e.data||e.data.source!=='editor-parent') return;
    switch(e.data.type){
      case 'ENABLE_EDIT': editMode=true; injectStyles(); discoverSections(); addOverlays(); setupEditable(); saveUndo(); notify('EDIT_READY',{sections:getSections()}); break;
      case 'DISABLE_EDIT': editMode=false; document.querySelectorAll('.eb-section-label,.eb-section-actions').forEach(function(x){x.remove();}); document.querySelectorAll('[contenteditable]').forEach(function(x){x.removeAttribute('contenteditable');}); var st=document.getElementById('eb-styles'); if(st)st.remove(); break;
      case 'SELECT_SECTION': selectSection(e.data.sectionId); var s2=sections.find(function(s){return s.id===e.data.sectionId;}); if(s2)s2.element.scrollIntoView({behavior:'smooth',block:'center'}); break;
      case 'UPDATE_ELEMENT': updateElement(e.data.data); break;
      case 'INSERT_SECTION': insertSection(e.data.html,e.data.position); break;
      case 'UNDO': undo(); break;
      case 'REDO': redo(); break;
      case 'GET_HTML': notify('HTML_CONTENT',{html:getCleanHTML()}); break;
      case 'GET_SECTIONS': discoverSections(); notify('SECTIONS_UPDATED',getSections()); break;
      case 'SCROLL_TO_SECTION': var s3=sections.find(function(s){return s.id===e.data.sectionId;}); if(s3)s3.element.scrollIntoView({behavior:'smooth',block:'start'}); break;
      case 'DELETE_SECTION': sectionAction(e.data.sectionId,'delete'); break;
      case 'MOVE_SECTION': sectionAction(e.data.sectionId,e.data.direction==='up'?'moveUp':'moveDown'); break;
      case 'DUPLICATE_SECTION': sectionAction(e.data.sectionId,'duplicate'); break;
      case 'REORDER_SECTION': reorderSection(e.data.sectionId, e.data.toIndex); break;
      case 'TOGGLE_VISIBILITY': toggleSectionVisibility(e.data.sectionId); break;
      case 'REPLACE_HTML': {
        var root=document.querySelector('.main-page-wrapper')||document.body;
        if(selectedElement){try{selectedElement.classList.remove('eb-editable-selected','eb-img-selected');selectedElement.removeAttribute('contenteditable');}catch(_){}selectedElement=null;notify('ELEMENT_DESELECTED',{});}
        try{ root.innerHTML = e.data.html || ''; }catch(_){}
        sections=[]; discoverSections(); addOverlays(); setupEditable(); saveUndo();
        notify('SECTIONS_UPDATED',getSections());
        break;
      }
    }
  });

  document.addEventListener('click',function(e){
    if(!editMode) return;
    if(!e.target.closest('[contenteditable]')&&!e.target.closest('.eb-section-actions')&&!e.target.closest('img')){
      if(selectedElement){selectedElement.classList.remove('eb-editable-selected','eb-img-selected');selectedElement.removeAttribute('contenteditable');selectedElement=null;notify('ELEMENT_DESELECTED',{});}
    }
  });

  // Auto-init when Jano app renders
  var readyCheck = setInterval(function(){
    var root = document.querySelector('.main-page-wrapper');
    if(root && root.children.length > 0){
      clearInterval(readyCheck);
      notify('BRIDGE_READY',{});
    }
  }, 200);
})();
