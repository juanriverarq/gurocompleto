import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { janoTemplates, templateCategories } from './templatePresets';
import type { JanoTemplate } from './templatePresets';
import { widgets, widgetCategories } from './widgetCatalog';
import { websiteService } from '../../../../services/websiteService';
import type { WebsiteData, WebsitePage } from '../../../../services/websiteService';

const IFRAME_BASE = '/website-builder';

interface SectionInfo { id: string; index: number; label: string; visible: boolean; }
interface ElementInfo {
  type: 'text' | 'image'; tagName: string; text?: string;
  fontSize?: string; fontWeight?: string; color?: string; textAlign?: string;
  backgroundColor?: string; href?: string; src?: string; alt?: string;
  paddingTop?: string; paddingRight?: string; paddingBottom?: string; paddingLeft?: string;
  marginTop?: string; marginRight?: string; marginBottom?: string; marginLeft?: string;
  borderRadius?: string;
}

type ViewMode = 'dashboard' | 'gallery' | 'preview' | 'editor';

const DEFAULT_PAGES: Omit<WebsitePage, 'id' | 'updated_at'>[] = [
  { slug: 'home', title: 'Inicio', is_homepage: true, sort_order: 0, show_in_nav: true, status: 'draft' },
];

const PAGE_SUGGESTIONS = [
  { slug: 'nosotros', title: 'Nosotros', icon: 'solar:users-group-rounded-bold-duotone' },
  { slug: 'servicios', title: 'Servicios', icon: 'solar:shield-check-bold-duotone' },
  { slug: 'contacto', title: 'Contacto', icon: 'solar:letter-bold-duotone' },
  { slug: 'blog', title: 'Blog', icon: 'solar:document-text-bold-duotone' },
  { slug: 'testimonios', title: 'Testimonios', icon: 'solar:chat-round-dots-bold-duotone' },
  { slug: 'faq', title: 'Preguntas Frecuentes', icon: 'solar:question-circle-bold-duotone' },
];

const MiPaginaWeb: React.FC = () => {
  // Core state
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [website, setWebsite] = useState<WebsiteData | null>(null);
  const [loadingWeb, setLoadingWeb] = useState(true);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Dashboard state
  const [dashTab, setDashTab] = useState<'pages' | 'settings' | 'seo' | 'domain'>('pages');
  const [editingPage, setEditingPage] = useState<WebsitePage | null>(null);
  const [newPageSlug, setNewPageSlug] = useState('');
  const [newPageTitle, setNewPageTitle] = useState('');
  const [settingsForm, setSettingsForm] = useState({ slug: '', site_title: '', site_description: '', google_analytics_id: '', custom_domain: '', favicon_url: '', og_image_url: '' });
  const [seoForm, setSeoForm] = useState({ seo_title: '', seo_description: '', seo_keywords: '', og_image: '' });
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingSeo, setSavingSeo] = useState(false);

  // Gallery state
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [pendingPageForTemplate, setPendingPageForTemplate] = useState<WebsitePage | null>(null);

  // Editor state
  const [activePage, setActivePage] = useState<WebsitePage | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<JanoTemplate | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [leftTab, setLeftTab] = useState<'sections' | 'widgets'>('sections');
  const [widgetCatFilter, setWidgetCatFilter] = useState<string>('all');
  const [iframeSections, setIframeSections] = useState<SectionInfo[]>([]);
  const [selectedEl, setSelectedEl] = useState<ElementInfo | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [responsiveMode, setResponsiveMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [bridgeReady, setBridgeReady] = useState(false);
  const [dragSectionId, setDragSectionId] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragWidgetHtml, setDragWidgetHtml] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const saveResolverRef = useRef<((html: string) => void) | null>(null);

  // Load saved website on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await websiteService.get();
        if (data) {
          setWebsite(data);
          setSettingsForm({
            slug: data.slug || '', site_title: data.site_title || '', site_description: data.site_description || '',
            google_analytics_id: data.google_analytics_id || '', custom_domain: data.custom_domain || '',
            favicon_url: data.favicon_url || '', og_image_url: data.og_image_url || '',
          });
        }
      } catch (e) { console.warn('[Web] Error loading:', e); }
      setLoadingWeb(false);
    })();
  }, []);

  const filteredTemplates = categoryFilter === 'all' ? janoTemplates : janoTemplates.filter(t => t.category === categoryFilter);
  const filteredWidgets = widgetCatFilter === 'all' ? widgets : widgets.filter(w => w.category === widgetCatFilter);

  const sendToIframe = useCallback((type: string, data?: any) => {
    iframeRef.current?.contentWindow?.postMessage({ source: 'editor-parent', type, ...data }, '*');
  }, []);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || e.data.source !== 'editor-bridge') return;
      switch (e.data.type) {
        case 'BRIDGE_READY': setBridgeReady(true); sendToIframe('ENABLE_EDIT'); break;
        case 'EDIT_READY': setIframeSections(e.data.data?.sections || []); break;
        case 'SECTIONS_UPDATED': setIframeSections(e.data.data || []); break;
        case 'ELEMENT_SELECTED': setSelectedEl(e.data.data); break;
        case 'ELEMENT_DESELECTED': setSelectedEl(null); break;
        case 'ELEMENT_CHANGED': setSelectedEl(e.data.data); break;
        case 'UNDO_STATE': setCanUndo(e.data.data?.canUndo || false); setCanRedo(e.data.data?.canRedo || false); break;
        case 'HTML_CONTENT':
          if (saveResolverRef.current && e.data.data?.html) {
            saveResolverRef.current(e.data.data.html);
            saveResolverRef.current = null;
          }
          break;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [sendToIframe]);

  const handleEditorIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    const doc = iframe.contentDocument;
    if (doc.getElementById('editor-bridge-script')) return;
    // If we have saved HTML, inject it into the page before enabling the editor
    if (savedHtml) {
      const waitForRoot = setInterval(() => {
        const root = doc.querySelector('.main-page-wrapper') || doc.body;
        if (root && root.children.length > 0) {
          clearInterval(waitForRoot);
          root.innerHTML = savedHtml;
          const script = doc.createElement('script');
          script.id = 'editor-bridge-script';
          script.src = '/website-builder/editor-bridge.js';
          doc.body.appendChild(script);
        }
      }, 100);
    } else {
      const script = doc.createElement('script');
      script.id = 'editor-bridge-script';
      script.src = '/website-builder/editor-bridge.js';
      doc.body.appendChild(script);
    }
  }, [savedHtml]);

  // Toast auto-hide
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Get clean HTML from iframe via promise
  const getHtmlFromIframe = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      saveResolverRef.current = resolve;
      sendToIframe('GET_HTML');
      setTimeout(() => {
        if (saveResolverRef.current) {
          saveResolverRef.current = null;
          reject(new Error('Timeout getting HTML'));
        }
      }, 5000);
    });
  }, [sendToIframe]);

  const handleSave = useCallback(async () => {
    if (!selectedTemplate || saving) return;
    setSaving(true);
    try {
      const html = await getHtmlFromIframe();
      const result = await websiteService.save({
        template_id: selectedTemplate.id,
        template_route: selectedTemplate.route,
        html_content: html,
      });
      setSavedHtml(html);
      setWebStatus(result.status as any);
      setLastSaved(result.updated_at);
      setToastMsg({ type: 'success', text: 'Cambios guardados' });
    } catch (e: any) {
      setToastMsg({ type: 'error', text: e.message || 'Error al guardar' });
    }
    setSaving(false);
  }, [selectedTemplate, saving, getHtmlFromIframe]);

  const handlePublish = useCallback(async () => {
    if (!selectedTemplate || publishing) return;
    setPublishing(true);
    try {
      const html = await getHtmlFromIframe();
      const result = await websiteService.publish({
        template_id: selectedTemplate.id,
        template_route: selectedTemplate.route,
        html_content: html,
      });
      setSavedHtml(html);
      setWebStatus('published');
      setPublishedAt(result.published_at);
      setLastSaved(result.updated_at);
      setToastMsg({ type: 'success', text: 'Página web publicada exitosamente' });
    } catch (e: any) {
      setToastMsg({ type: 'error', text: e.message || 'Error al publicar' });
    }
    setPublishing(false);
  }, [selectedTemplate, publishing, getHtmlFromIframe]);

  const iframeWidth = responsiveMode === 'desktop' ? '100%' : responsiveMode === 'tablet' ? '768px' : '375px';

  // ── GALLERY ──
  if (viewMode === 'gallery') {
    if (loadingWeb) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Icon icon="solar:globe-bold-duotone" width={40} className="text-indigo-400 mx-auto mb-3 animate-pulse" />
            <p className="text-sm text-gray-500">Cargando tu página web...</p>
          </div>
        </div>
      );
    }
    return (
      <div className="p-6 max-w-6xl mx-auto">
        {/* Saved website banner */}
        {selectedTemplate && savedHtml && (
          <div className={`mb-6 p-4 rounded-xl border-2 ${webStatus === 'published' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${webStatus === 'published' ? 'bg-green-100 dark:bg-green-800' : 'bg-amber-100 dark:bg-amber-800'}`}>
                  <Icon icon={webStatus === 'published' ? 'solar:check-circle-bold' : 'solar:pen-new-square-bold'} width={22} className={webStatus === 'published' ? 'text-green-600' : 'text-amber-600'} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-800 dark:text-white">
                    {selectedTemplate.name} — <span className={webStatus === 'published' ? 'text-green-600' : 'text-amber-600'}>{webStatus === 'published' ? 'Publicada' : 'Borrador'}</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {publishedAt ? `Publicada: ${new Date(publishedAt).toLocaleDateString('es-CO')}` : ''}
                    {lastSaved ? ` · Última edición: ${new Date(lastSaved).toLocaleDateString('es-CO')}` : ''}
                  </p>
                </div>
              </div>
              <button onClick={() => setViewMode('editor')} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
                <Icon icon="solar:pen-new-square-bold" width={16} />Continuar editando
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Mi Página Web</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{savedHtml ? 'Cambia de plantilla o sigue editando' : 'Elige una plantilla para tu sitio web'}</p>
          </div>
          {selectedTemplate && !savedHtml && (
            <button onClick={() => setViewMode('editor')} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
              <Icon icon="solar:pen-new-square-bold" width={18} />Editar Sitio
            </button>
          )}
        </div>
        <div className="flex gap-2 mb-6 flex-wrap">
          {templateCategories.map(cat => (
            <button key={cat.id} onClick={() => setCategoryFilter(cat.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${categoryFilter === cat.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              {cat.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTemplates.map(t => (
            <div key={t.id} className={`group relative bg-white dark:bg-gray-800 rounded-xl border-2 overflow-hidden cursor-pointer transition-all hover:shadow-lg ${selectedTemplate?.id === t.id ? 'border-indigo-500 shadow-lg shadow-indigo-500/10' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'}`} onClick={() => setSelectedTemplate(t)}>
              <div className="relative bg-gray-100 dark:bg-gray-900 overflow-hidden" style={{ paddingBottom: '62.5%' }}
                ref={(container) => {
                  if (!container) {return;}
                  if ((container as any)._ro) return;
                  const iframe = container.querySelector('iframe');
                  if (!iframe) return;
                  const ro = new ResizeObserver(([entry]) => {
                    iframe.style.transform = `scale(${entry.contentRect.width / 1440})`;
                  });
                  ro.observe(container);
                  (container as any)._ro = ro;
                }}>
                <iframe src={`${IFRAME_BASE}${t.route}`} className="border-0 pointer-events-none absolute top-0 left-0" style={{ width: '1440px', height: '900px', transformOrigin: 'top left', transform: 'scale(0.25)' }} loading="lazy" tabIndex={-1} />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedTemplate(t); setViewMode('preview'); }} className="px-3 py-1.5 bg-white text-gray-800 rounded-lg text-xs font-medium shadow-lg">
                      <Icon icon="solar:eye-bold" width={14} className="inline mr-1" />Vista Previa
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); if (selectedTemplate?.id !== t.id) setSavedHtml(null); setSelectedTemplate(t); setViewMode('editor'); }} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium shadow-lg">
                      <Icon icon="solar:pen-new-square-bold" width={14} className="inline mr-1" />Usar
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-white">{t.name}</h3>
                  {selectedTemplate?.id === t.id && <Icon icon="solar:check-circle-bold" width={18} className="text-indigo-500" />}
                </div>
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">{t.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── PREVIEW ──
  if (viewMode === 'preview' && selectedTemplate) {
    return createPortal(
      <div className="fixed inset-0 bg-white flex flex-col" style={{ zIndex: 2147483647 }}>
        <div className="h-12 bg-[#141414] flex items-center justify-between px-4 shrink-0">
          <button onClick={() => setViewMode('gallery')} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white"><Icon icon="solar:arrow-left-bold" width={14} /> Volver</button>
          <span className="text-xs text-gray-400 font-medium">{selectedTemplate.name}</span>
          <button onClick={() => { setSavedHtml(null); setViewMode('editor'); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium"><Icon icon="solar:pen-new-square-bold" width={14} /> Usar plantilla</button>
        </div>
        <iframe ref={iframeRef} src={`${IFRAME_BASE}${selectedTemplate.route}`} className="w-full flex-1 border-0" />
      </div>, document.body
    );
  }

  // ── EDITOR ──
  if (viewMode === 'editor' && selectedTemplate) {
    return createPortal(
      <div className="fixed inset-0 flex flex-col" style={{ zIndex: 2147483647, background: '#0d0d0d' }}>
        {/* Toolbar */}
        <div className="h-11 bg-[#141414] border-b border-white/5 flex items-center justify-between px-3 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => { setBridgeReady(false); setSelectedEl(null); setIframeSections([]); setViewMode('gallery'); }} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white"><Icon icon="solar:arrow-left-bold" width={14} /> Volver</button>
            <div className="w-px h-5 bg-white/10" />
            <span className="text-xs text-gray-500 font-medium">{selectedTemplate.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => sendToIframe('UNDO')} disabled={!canUndo} className={`p-1.5 rounded ${canUndo ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-700 cursor-not-allowed'}`} title="Deshacer"><Icon icon="solar:undo-left-bold" width={16} /></button>
            <button onClick={() => sendToIframe('REDO')} disabled={!canRedo} className={`p-1.5 rounded ${canRedo ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-700 cursor-not-allowed'}`} title="Rehacer"><Icon icon="solar:undo-right-bold" width={16} /></button>
            <div className="w-px h-5 bg-white/10 mx-1" />
            {(['desktop','tablet','mobile'] as const).map(m => (
              <button key={m} onClick={() => setResponsiveMode(m)} className={`p-1.5 rounded ${responsiveMode === m ? 'text-indigo-400 bg-indigo-500/10' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                <Icon icon={m === 'desktop' ? 'solar:monitor-bold' : m === 'tablet' ? 'solar:tablet-bold' : 'solar:smartphone-bold'} width={16} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {webStatus && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${webStatus === 'published' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {webStatus === 'published' ? 'Publicada' : 'Borrador'}
              </span>
            )}
            <button onClick={handleSave} disabled={saving} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${saving ? 'bg-white/5 text-gray-600 cursor-wait' : 'bg-white/5 hover:bg-white/10 text-gray-300'}`}>
              {saving ? <Icon icon="solar:refresh-bold" width={14} className="animate-spin" /> : <Icon icon="solar:diskette-bold" width={14} />}
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={handlePublish} disabled={publishing} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${publishing ? 'bg-indigo-800 text-indigo-300 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
              {publishing ? <Icon icon="solar:refresh-bold" width={14} className="animate-spin" /> : <Icon icon="solar:global-bold" width={14} />}
              {publishing ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left Panel */}
          <div className="w-[280px] bg-[#141414] border-r border-white/5 flex flex-col shrink-0">
            <div className="flex border-b border-white/5">
              <button onClick={() => setLeftTab('sections')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium ${leftTab === 'sections' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' : 'text-gray-500 hover:text-gray-300'}`}>
                <Icon icon="solar:layers-bold-duotone" width={14} />Secciones
              </button>
              <button onClick={() => setLeftTab('widgets')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium ${leftTab === 'widgets' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' : 'text-gray-500 hover:text-gray-300'}`}>
                <Icon icon="solar:widget-add-bold-duotone" width={14} />Widgets
              </button>
            </div>
            {leftTab === 'sections' ? (
              <div className="flex-1 overflow-y-auto p-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Secciones ({iframeSections.length})</p>
                {iframeSections.length === 0 && <div className="text-center py-8"><Icon icon="solar:layers-bold-duotone" width={32} className="text-gray-700 mx-auto mb-2" /><p className="text-[11px] text-gray-600">{bridgeReady ? 'Sin secciones' : 'Cargando...'}</p></div>}
                <div className="space-y-0.5">
                  {iframeSections.map((sec, idx) => (
                    <div key={sec.id}>
                      {/* Drop indicator */}
                      {dragSectionId && dragOverIdx === idx && dragSectionId !== sec.id && (
                        <div className="h-[3px] bg-indigo-500 rounded-full mx-2 my-0.5" />
                      )}
                      <div
                        draggable
                        onDragStart={(e) => { setDragSectionId(sec.id); e.dataTransfer.effectAllowed = 'move'; }}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIdx(idx); }}
                        onDragEnd={() => { setDragSectionId(null); setDragOverIdx(null); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragSectionId && dragSectionId !== sec.id) {
                            sendToIframe('REORDER_SECTION', { sectionId: dragSectionId, toIndex: idx });
                          }
                          setDragSectionId(null); setDragOverIdx(null);
                        }}
                        className={`flex items-center gap-1.5 p-2 rounded-lg group cursor-grab active:cursor-grabbing transition-all ${
                          dragSectionId === sec.id ? 'opacity-40 bg-indigo-500/10' : 'hover:bg-white/5'
                        } ${!sec.visible ? 'opacity-50' : ''}`}
                        onClick={() => sendToIframe('SCROLL_TO_SECTION', { sectionId: sec.id })}
                      >
                        <Icon icon="solar:hamburger-menu-bold" width={12} className="text-gray-600 shrink-0 cursor-grab" />
                        <span className={`text-[11px] flex-1 truncate ${sec.visible ? 'text-gray-300' : 'text-gray-600 line-through italic'}`}>{sec.label}</span>
                        {/* Always-visible toggle */}
                        <button onClick={e => { e.stopPropagation(); sendToIframe('TOGGLE_VISIBILITY', { sectionId: sec.id }); }}
                          className={`p-1 rounded shrink-0 transition-colors ${sec.visible ? 'text-gray-500 hover:text-white hover:bg-white/10' : 'text-gray-700 hover:text-gray-400 hover:bg-white/10'}`}
                          title={sec.visible ? 'Ocultar sección' : 'Mostrar sección'}>
                          <Icon icon={sec.visible ? 'solar:eye-bold' : 'solar:eye-closed-bold'} width={13} />
                        </button>
                        {/* Hover actions */}
                        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                          <button onClick={e => { e.stopPropagation(); sendToIframe('DUPLICATE_SECTION', { sectionId: sec.id }); }} className="p-1 rounded text-gray-500 hover:text-white hover:bg-white/10" title="Duplicar"><Icon icon="solar:copy-bold" width={11} /></button>
                          <button onClick={e => { e.stopPropagation(); sendToIframe('DELETE_SECTION', { sectionId: sec.id }); }} className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10" title="Eliminar"><Icon icon="solar:trash-bin-trash-bold" width={11} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Drop at end */}
                  {dragSectionId && dragOverIdx === iframeSections.length && (
                    <div className="h-[3px] bg-indigo-500 rounded-full mx-2 my-0.5" />
                  )}
                  {dragSectionId && (
                    <div className="h-8"
                      onDragOver={(e) => { e.preventDefault(); setDragOverIdx(iframeSections.length); }}
                      onDrop={(e) => { e.preventDefault(); if (dragSectionId) sendToIframe('REORDER_SECTION', { sectionId: dragSectionId, toIndex: iframeSections.length }); setDragSectionId(null); setDragOverIdx(null); }}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="p-3 border-b border-white/5">
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => setWidgetCatFilter('all')} className={`px-2 py-1 rounded text-[10px] font-medium ${widgetCatFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>Todos</button>
                    {widgetCategories.map(c => (
                      <button key={c.id} onClick={() => setWidgetCatFilter(c.id)} className={`px-2 py-1 rounded text-[10px] font-medium ${widgetCatFilter === c.id ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>{c.label}</button>
                    ))}
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {filteredWidgets.map(w => (
                    <div key={w.id} draggable
                      onDragStart={(e) => { setDragWidgetHtml(w.html); e.dataTransfer.effectAllowed = 'copy'; }}
                      onDragEnd={() => setDragWidgetHtml(null)}
                      onClick={() => sendToIframe('INSERT_SECTION', { html: w.html, position: 'bottom' })}
                      className="w-full flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/5 border border-white/5 hover:border-indigo-500/30 transition-all text-left group cursor-grab active:cursor-grabbing">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/20"><Icon icon={w.icon} width={16} className="text-indigo-400" /></div>
                      <div className="min-w-0"><p className="text-[12px] font-medium text-gray-200 truncate">{w.name}</p><p className="text-[10px] text-gray-500 mt-0.5">{w.description}</p></div>
                      <Icon icon="solar:add-circle-bold" width={16} className="text-gray-600 group-hover:text-indigo-400 shrink-0 mt-1" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Center: iframe */}
          <div className="flex-1 flex flex-col min-w-0 items-center bg-[#0a0a0a] relative">
            <div className="flex-1 w-full flex items-start justify-center overflow-auto p-4" style={{ paddingTop: responsiveMode !== 'desktop' ? '16px' : '0' }}>
              <div style={{ width: iframeWidth, height: '100%', transition: 'width 0.3s', maxWidth: '100%' }} className={responsiveMode !== 'desktop' ? 'rounded-xl overflow-hidden shadow-2xl border border-white/10' : ''}>
                <iframe ref={iframeRef} src={`${IFRAME_BASE}${selectedTemplate.route}?edit=1`} className="w-full h-full border-0 bg-white" onLoad={handleEditorIframeLoad} />
              </div>
            </div>
            {/* Widget drop overlay */}
            {dragWidgetHtml && (
              <div className="absolute inset-0 z-10 flex items-center justify-center"
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                onDrop={(e) => { e.preventDefault(); if (dragWidgetHtml) { sendToIframe('INSERT_SECTION', { html: dragWidgetHtml, position: 'bottom' }); } setDragWidgetHtml(null); }}>
                <div className="absolute inset-0 bg-indigo-500/10 border-2 border-dashed border-indigo-500/40 rounded-lg pointer-events-none" />
                <div className="relative bg-[#141414] border border-indigo-500/40 rounded-xl px-6 py-4 text-center pointer-events-none shadow-2xl">
                  <Icon icon="solar:add-circle-bold-duotone" width={32} className="text-indigo-400 mx-auto mb-2" />
                  <p className="text-[12px] text-gray-300 font-medium">Soltar aquí para insertar</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Properties */}
          <div className="w-[260px] bg-[#141414] border-l border-white/5 flex flex-col shrink-0">
            <div className="p-3 border-b border-white/5">
              <p className="text-[11px] font-semibold text-gray-400">Propiedades</p>
            </div>
            {selectedEl ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                  <Icon icon={selectedEl.type === 'image' ? 'solar:gallery-bold-duotone' : 'solar:text-bold-duotone'} width={14} className="text-indigo-400" />
                  <span className="text-[11px] text-indigo-300 font-medium">{selectedEl.type === 'image' ? 'Imagen' : selectedEl.tagName?.toUpperCase()}</span>
                </div>

                {selectedEl.type === 'text' && (<>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1 block">Texto</label>
                    <textarea value={selectedEl.text || ''} onChange={e => { setSelectedEl({...selectedEl, text: e.target.value}); sendToIframe('UPDATE_ELEMENT', { data: { text: e.target.value } }); }}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-[11px] text-gray-200 resize-none focus:border-indigo-500 focus:outline-none" rows={3} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1 block">Color</label>
                      <div className="flex gap-1">
                        <input type="color" value={rgbToHex(selectedEl.color || '#000000')}
                          onChange={e => { setSelectedEl({...selectedEl, color: e.target.value}); sendToIframe('UPDATE_ELEMENT', { data: { color: e.target.value } }); }}
                          className="w-8 h-8 rounded border border-white/10 bg-transparent cursor-pointer" />
                        <input type="text" value={selectedEl.color || ''} readOnly className="flex-1 bg-white/5 border border-white/10 rounded p-1 text-[10px] text-gray-400 w-0" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1 block">Tamaño</label>
                      <input type="text" value={selectedEl.fontSize || ''} onChange={e => { setSelectedEl({...selectedEl, fontSize: e.target.value}); sendToIframe('UPDATE_ELEMENT', { data: { fontSize: e.target.value } }); }}
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-1.5 text-[11px] text-gray-200 focus:border-indigo-500 focus:outline-none" placeholder="16px" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1 block">Peso</label>
                    <select value={selectedEl.fontWeight || '400'} onChange={e => { setSelectedEl({...selectedEl, fontWeight: e.target.value}); sendToIframe('UPDATE_ELEMENT', { data: { fontWeight: e.target.value } }); }}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-1.5 text-[11px] text-gray-200 focus:border-indigo-500 focus:outline-none">
                      <option value="300">Light</option><option value="400">Normal</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700">Bold</option><option value="800">Extra Bold</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1 block">Alineación</label>
                    <div className="flex gap-1">
                      {(['left','center','right'] as const).map(a => (
                        <button key={a} onClick={() => { setSelectedEl({...selectedEl, textAlign: a}); sendToIframe('UPDATE_ELEMENT', { data: { textAlign: a } }); }}
                          className={`flex-1 p-1.5 rounded text-[11px] ${selectedEl.textAlign === a ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                          <Icon icon={a === 'left' ? 'solar:align-left-bold' : a === 'center' ? 'solar:align-horizontal-center-bold' : 'solar:align-right-bold'} width={14} className="mx-auto" />
                        </button>
                      ))}
                    </div>
                  </div>
                  {selectedEl.tagName === 'a' && (
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1 block">Enlace</label>
                      <input type="text" value={selectedEl.href || ''} onChange={e => { setSelectedEl({...selectedEl, href: e.target.value}); sendToIframe('UPDATE_ELEMENT', { data: { href: e.target.value } }); }}
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-1.5 text-[11px] text-gray-200 focus:border-indigo-500 focus:outline-none" placeholder="https://..." />
                    </div>
                  )}
                </>)}

                {selectedEl.type === 'image' && (<>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1 block">URL de imagen</label>
                    <input type="text" value={selectedEl.src || ''} onChange={e => { setSelectedEl({...selectedEl, src: e.target.value}); sendToIframe('UPDATE_ELEMENT', { data: { src: e.target.value } }); }}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-1.5 text-[11px] text-gray-200 focus:border-indigo-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1 block">Texto alternativo</label>
                    <input type="text" value={selectedEl.alt || ''} onChange={e => { setSelectedEl({...selectedEl, alt: e.target.value}); sendToIframe('UPDATE_ELEMENT', { data: { alt: e.target.value } }); }}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-1.5 text-[11px] text-gray-200 focus:border-indigo-500 focus:outline-none" />
                  </div>
                  {selectedEl.src && (
                    <div className="rounded-lg overflow-hidden border border-white/10">
                      <img src={selectedEl.src} alt={selectedEl.alt || ''} className="w-full h-32 object-cover" />
                    </div>
                  )}
                </>)}

                {/* ── Spacing: shared for text & image ── */}
                <div className="border-t border-white/5 pt-4">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">Espaciado</p>
                  {/* Padding */}
                  <label className="text-[10px] text-gray-500 mb-1 block">Padding</label>
                  <div className="grid grid-cols-4 gap-1 mb-3">
                    {(['paddingTop','paddingRight','paddingBottom','paddingLeft'] as const).map(k => (
                      <div key={k} className="text-center">
                        <input type="text" value={selectedEl[k] || ''} placeholder={k.replace('padding','').charAt(0)}
                          onChange={e => { const v = e.target.value; setSelectedEl({...selectedEl, [k]: v}); sendToIframe('UPDATE_ELEMENT', { data: { [k]: v } }); }}
                          className="w-full bg-white/5 border border-white/10 rounded p-1 text-[10px] text-gray-300 text-center focus:border-indigo-500 focus:outline-none" />
                        <span className="text-[8px] text-gray-600">{k.replace('padding','').charAt(0).toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                  {/* Margin */}
                  <label className="text-[10px] text-gray-500 mb-1 block">Margin</label>
                  <div className="grid grid-cols-4 gap-1 mb-3">
                    {(['marginTop','marginRight','marginBottom','marginLeft'] as const).map(k => (
                      <div key={k} className="text-center">
                        <input type="text" value={selectedEl[k] || ''} placeholder={k.replace('margin','').charAt(0)}
                          onChange={e => { const v = e.target.value; setSelectedEl({...selectedEl, [k]: v}); sendToIframe('UPDATE_ELEMENT', { data: { [k]: v } }); }}
                          className="w-full bg-white/5 border border-white/10 rounded p-1 text-[10px] text-gray-300 text-center focus:border-indigo-500 focus:outline-none" />
                        <span className="text-[8px] text-gray-600">{k.replace('margin','').charAt(0).toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                  {/* Border Radius */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500 mb-1 block">Border Radius</label>
                      <input type="text" value={selectedEl.borderRadius || ''} placeholder="0px"
                        onChange={e => { setSelectedEl({...selectedEl, borderRadius: e.target.value}); sendToIframe('UPDATE_ELEMENT', { data: { borderRadius: e.target.value } }); }}
                        className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-[10px] text-gray-300 focus:border-indigo-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-1 block">Fondo</label>
                      <div className="flex gap-1">
                        <input type="color" value={rgbToHex(selectedEl.backgroundColor || '#ffffff')}
                          onChange={e => { setSelectedEl({...selectedEl, backgroundColor: e.target.value}); sendToIframe('UPDATE_ELEMENT', { data: { backgroundColor: e.target.value } }); }}
                          className="w-8 h-8 rounded border border-white/10 bg-transparent cursor-pointer" />
                        <input type="text" value={selectedEl.backgroundColor || ''} readOnly className="flex-1 bg-white/5 border border-white/10 rounded p-1 text-[9px] text-gray-400 w-0" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <Icon icon="solar:cursor-bold-duotone" width={36} className="text-gray-700 mx-auto mb-3" />
                  <p className="text-[12px] text-gray-500 font-medium mb-1">Selecciona un elemento</p>
                  <p className="text-[10px] text-gray-600">Haz clic en cualquier texto o imagen del sitio para editarlo</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Toast notification */}
        {toastMsg && (
          <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-lg shadow-2xl border text-sm font-medium flex items-center gap-2 animate-[fadeIn_0.2s] ${
            toastMsg.type === 'success' ? 'bg-green-600 border-green-500 text-white' : 'bg-red-600 border-red-500 text-white'
          }`}>
            <Icon icon={toastMsg.type === 'success' ? 'solar:check-circle-bold' : 'solar:danger-triangle-bold'} width={16} />
            {toastMsg.text}
          </div>
        )}
      </div>, document.body
    );
  }

  return null;
};

function rgbToHex(color: string): string {
  if (color.startsWith('#')) return color;
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return '#000000';
  const r = parseInt(match[1]).toString(16).padStart(2, '0');
  const g = parseInt(match[2]).toString(16).padStart(2, '0');
  const b = parseInt(match[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

export default MiPaginaWeb;
