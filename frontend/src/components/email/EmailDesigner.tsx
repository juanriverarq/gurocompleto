import React, { useState, useEffect } from 'react';
import { TextInput, Textarea, Label } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { sanitizeEmailHtml } from 'src/utils/sanitize';

type EmailDesignerProps = {
  initialHtml?: string;
  height?: number | string;
  onChange?: (html: string) => void;
  className?: string;
};

type BodyElement = {
  id: string;
  type: 'text' | 'image' | 'button' | 'link' | 'divider';
  content?: string;
  imageFile?: File;
  imageUrl?: string;
  buttonText?: string;
  buttonLink?: string;
  buttonColor?: string;
  linkText?: string;
  linkUrl?: string;
  align?: 'left' | 'center' | 'right';
};

interface EmailSection {
  header: {
    logoFile?: File;
    logoUrl: string;
    title: string;
    subtitle: string;
    backgroundColor: string;
    align?: 'left' | 'center' | 'right';
  };
  body: {
    elements: BodyElement[];
  };
  footer: {
    text: string;
    facebook: string;
    instagram: string;
    twitter: string;
    linkedin: string;
    backgroundColor: string;
    align?: 'left' | 'center' | 'right';
    socialColor?: string;
  };
}

const EmailDesigner: React.FC<EmailDesignerProps> = ({ initialHtml, height = 600, onChange, className }) => {
  const [sections, setSections] = useState<EmailSection>({
    header: {
      logoUrl: 'https://via.placeholder.com/150x50/635BFF/FFFFFF?text=GURO',
      title: 'Bienvenido a GURO',
      subtitle: 'Tu plataforma de gestión de seguros',
      backgroundColor: '#635BFF',
      align: 'center',
    },
    body: {
      elements: [
        {
          id: '1',
          type: 'text',
          content: 'Hola {{nombre}},\n\nGracias por confiar en nosotros.',
          align: 'left',
        },
      ],
    },
    footer: {
      text: '© 2024 GURO. Todos los derechos reservados.',
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: '',
      backgroundColor: '#f9fafb',
      align: 'center',
      socialColor: '#635BFF',
    },
  });

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const generateHTML = async (): Promise<string> => {
    const { header, body, footer } = sections;
    
    let logoSrc = header.logoUrl;
    if (header.logoFile) {
      logoSrc = await fileToBase64(header.logoFile);
    }

    const bodyHtml = await Promise.all(
      body.elements.map(async (el) => {
        const align = el.align || 'left';
        switch (el.type) {
          case 'text':
            return `<div style="color:#4b5563;font-size:14px;line-height:1.6;white-space:pre-wrap;margin-bottom:15px;text-align:${align}">${el.content || ''}</div>`;
          case 'image':
            let imgSrc = el.imageUrl || '';
            if (el.imageFile) {
              imgSrc = await fileToBase64(el.imageFile);
            }
            return imgSrc ? `<table style="width:100%;margin-bottom:20px"><tr><td align="${align}"><img src="${imgSrc}" alt="Imagen" style="max-width:100%;height:auto;border-radius:8px;display:inline-block" /></td></tr></table>` : '';
          case 'button':
            return el.buttonText ? `<table style="margin:20px 0;width:100%"><tr><td align="${align}"><a href="${el.buttonLink || '#'}" style="display:inline-block;padding:12px 30px;background:${el.buttonColor || '#635BFF'};color:white;text-decoration:none;border-radius:6px;font-weight:600">${el.buttonText}</a></td></tr></table>` : '';
          case 'link':
            return el.linkText ? `<p style="margin:10px 0;text-align:${align}"><a href="${el.linkUrl || '#'}" style="color:#635BFF;text-decoration:underline">${el.linkText}</a></p>` : '';
          case 'divider':
            return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />`;
          default:
            return '';
        }
      })
    );
    
    const socialLinks = [];
    if (footer.facebook) socialLinks.push(`<a href="${footer.facebook}" style="margin:0 5px"><img src="https://img.icons8.com/color/32/facebook.png" alt="Facebook" style="width:24px;height:24px"/></a>`);
    if (footer.instagram) socialLinks.push(`<a href="${footer.instagram}" style="margin:0 5px"><img src="https://img.icons8.com/color/32/instagram-new.png" alt="Instagram" style="width:24px;height:24px"/></a>`);
    if (footer.twitter) socialLinks.push(`<a href="${footer.twitter}" style="margin:0 5px"><img src="https://img.icons8.com/color/32/twitter.png" alt="Twitter" style="width:24px;height:24px"/></a>`);
    if (footer.linkedin) socialLinks.push(`<a href="${footer.linkedin}" style="margin:0 5px"><img src="https://img.icons8.com/color/32/linkedin.png" alt="LinkedIn" style="width:24px;height:24px"/></a>`);

    return `<table style="width:100%;background:#f6f6f6;padding:20px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <tr>
    <td align="center">
      <table style="width:600px;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
        <tr>
          <td style="background:${header.backgroundColor};padding:30px">
            ${logoSrc ? `<div style="text-align:${header.align || 'center'};margin-bottom:15px"><img src="${logoSrc}" alt="Logo" style="max-width:150px;height:auto;display:inline-block" /></div>` : ''}
            <h1 style="margin:0 0 10px;color:white;font-size:28px;font-weight:bold;text-align:${header.align || 'center'}">${header.title}</h1>
            ${header.subtitle ? `<p style="margin:0;color:rgba(255,255,255,0.9);font-size:14px;text-align:${header.align || 'center'}">${header.subtitle}</p>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:30px">
            ${bodyHtml.join('\n')}
          </td>
        </tr>
        <tr>
          <td style="background:${footer.backgroundColor};padding:25px;text-align:${footer.align || 'center'};border-top:1px solid #e5e7eb">
            ${socialLinks.length > 0 ? `<div style="margin-bottom:15px;display:flex;align-items:center;justify-content:${footer.align === 'left' ? 'flex-start' : footer.align === 'right' ? 'flex-end' : 'center'};gap:0">${socialLinks.join('')}</div>` : ''}
            <p style="margin:0;color:#6b7280;font-size:12px">${footer.text}</p>
            <p style="margin:10px 0 0;color:#9ca3af;font-size:11px"><a href="{{unsubscribe_link}}" style="color:#9ca3af;text-decoration:underline">Cancelar suscripción</a></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  };

  useEffect(() => {
    generateHTML().then(html => onChange?.(html));
  }, [sections]);

  const updateHeader = (field: string, value: string | File) => {
    setSections(prev => ({ ...prev, header: { ...prev.header, [field]: value } }));
  };

  const updateFooter = (field: string, value: string) => {
    setSections(prev => ({ ...prev, footer: { ...prev.footer, [field]: value } }));
  };

  const addBodyElement = (type: BodyElement['type']) => {
    const newElement: BodyElement = {
      id: Date.now().toString(),
      type,
      content: type === 'text' ? 'Nuevo texto aquí...' : undefined,
      buttonText: type === 'button' ? 'Haz clic' : undefined,
      buttonLink: type === 'button' ? '#' : undefined,
      buttonColor: type === 'button' ? '#635BFF' : undefined,
      linkText: type === 'link' ? 'Enlace' : undefined,
      linkUrl: type === 'link' ? '#' : undefined,
      align: 'left',
    };
    setSections(prev => ({ ...prev, body: { elements: [...prev.body.elements, newElement] } }));
  };

  const updateBodyElement = (id: string, field: string, value: string | File) => {
    setSections(prev => ({
      ...prev,
      body: { elements: prev.body.elements.map(el => el.id === id ? { ...el, [field]: value } : el) },
    }));
  };

  const removeBodyElement = (id: string) => {
    setSections(prev => ({ ...prev, body: { elements: prev.body.elements.filter(el => el.id !== id) } }));
  };

  const moveElement = (id: string, direction: 'up' | 'down') => {
    setSections(prev => {
      const elements = [...prev.body.elements];
      const index = elements.findIndex(el => el.id === id);
      if (index === -1) return prev;
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= elements.length) return prev;
      [elements[index], elements[newIndex]] = [elements[newIndex], elements[index]];
      return { ...prev, body: { elements } };
    });
  };

  const [previewHtml, setPreviewHtml] = useState('');
  useEffect(() => {
    generateHTML().then(setPreviewHtml);
  }, [sections]);

  return (
    <div className={className || ''}>
      <div className="flex gap-4" style={{ height: typeof height === 'number' ? `${height}px` : height }}>
        <div className="w-1/2 overflow-y-auto pr-2 space-y-4">
          
          {/* CABECERA */}
          <div className="border-2 border-blue-300 dark:border-blue-700 rounded-lg p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">1</div>
              <h3 className="font-bold text-blue-900 dark:text-blue-100 text-lg">Cabecera</h3>
            </div>
            <div className="space-y-3">
              <div className="flex gap-1 mb-3" title="Alineación de la cabecera">
                <button onClick={() => updateHeader('align', 'left')} className={`px-2 py-1 text-xs rounded ${sections.header.align === 'left' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`} title="Alinear a la izquierda">
                  <Icon icon="solar:align-left-bold" width={12} />
                </button>
                <button onClick={() => updateHeader('align', 'center')} className={`px-2 py-1 text-xs rounded ${sections.header.align === 'center' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`} title="Centrar">
                  <Icon icon="solar:align-center-bold" width={12} />
                </button>
                <button onClick={() => updateHeader('align', 'right')} className={`px-2 py-1 text-xs rounded ${sections.header.align === 'right' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`} title="Alinear a la derecha">
                  <Icon icon="solar:align-right-bold" width={12} />
                </button>
              </div>
              <div title="🖼️ Logo de tu empresa - Sube un archivo PNG/JPG o usa una URL">
                <Label htmlFor="header-logo-file" className="text-sm font-semibold">🖼️ Logo</Label>
                <input type="file" id="header-logo-file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) updateHeader('logoFile', file); }} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
                <p className="text-xs text-gray-500 mt-1">O usa URL:</p>
                <TextInput placeholder="https://ejemplo.com/logo.png" value={sections.header.logoUrl} onChange={(e) => updateHeader('logoUrl', e.target.value)} sizing="sm" />
              </div>
              <div title="📝 Título principal en grande que aparecerá en la cabecera">
                <Label htmlFor="header-title" className="text-sm font-semibold">📝 Título Principal</Label>
                <TextInput id="header-title" placeholder="Ej: Bienvenido a GURO" value={sections.header.title} onChange={(e) => updateHeader('title', e.target.value)} sizing="sm" />
              </div>
              <div title="💬 Texto secundario debajo del título (opcional)">
                <Label htmlFor="header-subtitle" className="text-sm font-semibold">💬 Subtítulo (opcional)</Label>
                <TextInput id="header-subtitle" placeholder="Ej: Tu plataforma de gestión" value={sections.header.subtitle} onChange={(e) => updateHeader('subtitle', e.target.value)} sizing="sm" />
              </div>
              <div title="🎨 Color de fondo de toda la cabecera">
                <Label htmlFor="header-bg" className="text-sm font-semibold">🎨 Color de Fondo</Label>
                <div className="flex gap-2">
                  <input type="color" id="header-bg" value={sections.header.backgroundColor} onChange={(e) => updateHeader('backgroundColor', e.target.value)} className="w-12 h-9 rounded border border-gray-300 cursor-pointer" />
                  <TextInput value={sections.header.backgroundColor} onChange={(e) => updateHeader('backgroundColor', e.target.value)} sizing="sm" className="flex-1" placeholder="#635BFF" />
                </div>
              </div>
            </div>
          </div>

          {/* CUERPO */}
          <div className="border-2 border-green-300 dark:border-green-700 rounded-lg p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-bold">2</div>
                <h3 className="font-bold text-green-900 dark:text-green-100 text-lg">Cuerpo</h3>
              </div>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => addBodyElement('text')} className="px-2 py-1 text-[10px] bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-0.5 transition-colors" title="💬 Agregar texto">
                  <Icon icon="solar:text-bold" width={10} />
                  Texto
                </button>
                <button onClick={() => addBodyElement('image')} className="px-2 py-1 text-[10px] bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-0.5 transition-colors" title="🖼️ Agregar imagen">
                  <Icon icon="solar:gallery-bold" width={10} />
                  Imagen
                </button>
                <button onClick={() => addBodyElement('button')} className="px-2 py-1 text-[10px] bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-0.5 transition-colors" title="🔘 Agregar botón">
                  <Icon icon="solar:widget-bold" width={10} />
                  Botón
                </button>
                <button onClick={() => addBodyElement('link')} className="px-2 py-1 text-[10px] bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-0.5 transition-colors" title="🔗 Agregar enlace">
                  <Icon icon="solar:link-bold" width={10} />
                  Enlace
                </button>
                <button onClick={() => addBodyElement('divider')} className="px-2 py-1 text-[10px] bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-0.5 transition-colors" title="➖ Agregar divisor">
                  <Icon icon="solar:minus-circle-bold" width={10} />
                  Divisor
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {sections.body.elements.map((el, idx) => (
                <div key={el.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon icon={el.type === 'text' ? 'solar:text-bold' : el.type === 'image' ? 'solar:gallery-bold' : el.type === 'button' ? 'solar:widget-bold' : el.type === 'link' ? 'solar:link-bold' : 'solar:minus-circle-bold'} width={14} className="text-green-600" />
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize">{el.type === 'text' ? 'Texto' : el.type === 'image' ? 'Imagen' : el.type === 'button' ? 'Botón' : el.type === 'link' ? 'Enlace' : 'Divisor'}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => moveElement(el.id, 'up')} disabled={idx === 0} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30" title="⬆️ Mover arriba">
                        <Icon icon="solar:alt-arrow-up-bold" width={12} />
                      </button>
                      <button onClick={() => moveElement(el.id, 'down')} disabled={idx === sections.body.elements.length - 1} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30" title="⬇️ Mover abajo">
                        <Icon icon="solar:alt-arrow-down-bold" width={12} />
                      </button>
                      <button onClick={() => removeBodyElement(el.id)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600" title="🗑️ Eliminar">
                        <Icon icon="solar:trash-bin-minimalistic-bold" width={12} />
                      </button>
                    </div>
                  </div>

                  {/* Alineación (para todos excepto divisor) */}
                  {el.type !== 'divider' && (
                    <div className="flex gap-1 mb-2" title="Alineación del contenido">
                      <button onClick={() => updateBodyElement(el.id, 'align', 'left')} className={`px-2 py-1 text-xs rounded ${el.align === 'left' ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`} title="Alinear a la izquierda">
                        <Icon icon="solar:align-left-bold" width={12} />
                      </button>
                      <button onClick={() => updateBodyElement(el.id, 'align', 'center')} className={`px-2 py-1 text-xs rounded ${el.align === 'center' ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`} title="Centrar">
                        <Icon icon="solar:align-center-bold" width={12} />
                      </button>
                      <button onClick={() => updateBodyElement(el.id, 'align', 'right')} className={`px-2 py-1 text-xs rounded ${el.align === 'right' ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`} title="Alinear a la derecha">
                        <Icon icon="solar:align-right-bold" width={12} />
                      </button>
                    </div>
                  )}

                  {el.type === 'text' && (
                    <Textarea rows={3} value={el.content || ''} onChange={(e) => updateBodyElement(el.id, 'content', e.target.value)} placeholder="Escribe... Usa {{nombre}}, {{email}}" />
                  )}

                  {el.type === 'image' && (
                    <div className="space-y-2">
                      <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) updateBodyElement(el.id, 'imageFile', file); }} className="block w-full text-sm text-gray-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer" />
                      <p className="text-xs text-gray-500">O URL:</p>
                      <TextInput placeholder="https://..." value={el.imageUrl || ''} onChange={(e) => updateBodyElement(el.id, 'imageUrl', e.target.value)} sizing="sm" />
                    </div>
                  )}

                  {el.type === 'button' && (
                    <div className="space-y-2">
                      <TextInput placeholder="Texto del botón" value={el.buttonText || ''} onChange={(e) => updateBodyElement(el.id, 'buttonText', e.target.value)} sizing="sm" />
                      <TextInput placeholder="https://..." value={el.buttonLink || ''} onChange={(e) => updateBodyElement(el.id, 'buttonLink', e.target.value)} sizing="sm" />
                      <div className="flex gap-2">
                        <input type="color" value={el.buttonColor || '#635BFF'} onChange={(e) => updateBodyElement(el.id, 'buttonColor', e.target.value)} className="w-10 h-8 rounded border cursor-pointer" />
                        <TextInput value={el.buttonColor || '#635BFF'} onChange={(e) => updateBodyElement(el.id, 'buttonColor', e.target.value)} sizing="sm" className="flex-1" placeholder="#635BFF" />
                      </div>
                    </div>
                  )}

                  {el.type === 'link' && (
                    <div className="space-y-2">
                      <TextInput placeholder="Texto del enlace" value={el.linkText || ''} onChange={(e) => updateBodyElement(el.id, 'linkText', e.target.value)} sizing="sm" />
                      <TextInput placeholder="https://..." value={el.linkUrl || ''} onChange={(e) => updateBodyElement(el.id, 'linkUrl', e.target.value)} sizing="sm" />
                    </div>
                  )}

                  {el.type === 'divider' && (
                    <div className="text-center text-xs text-gray-500 py-2">➖ Línea divisora</div>
                  )}
                </div>
              ))}
              {sections.body.elements.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  👆 Haz clic arriba para agregar elementos
                </div>
              )}
            </div>
          </div>

          {/* FOOTER */}
          <div className="border-2 border-purple-300 dark:border-purple-700 rounded-lg p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold">3</div>
              <h3 className="font-bold text-purple-900 dark:text-purple-100 text-lg">Pie de Página</h3>
            </div>
            <div className="space-y-3">
              <div title="📄 Texto de copyright">
                <Label htmlFor="footer-text" className="text-sm font-semibold">📄 Texto</Label>
                <TextInput id="footer-text" placeholder="© 2024 GURO" value={sections.footer.text} onChange={(e) => updateFooter('text', e.target.value)} sizing="sm" />
              </div>
              <div>
                <Label className="text-sm font-semibold mb-2 block">🌐 Redes Sociales</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2" title="📘 Facebook">
                    <Icon icon="logos:facebook" width={18} />
                    <TextInput placeholder="https://facebook.com/..." value={sections.footer.facebook} onChange={(e) => updateFooter('facebook', e.target.value)} sizing="sm" className="flex-1" />
                  </div>
                  <div className="flex items-center gap-2" title="📸 Instagram">
                    <Icon icon="skill-icons:instagram" width={18} />
                    <TextInput placeholder="https://instagram.com/..." value={sections.footer.instagram} onChange={(e) => updateFooter('instagram', e.target.value)} sizing="sm" className="flex-1" />
                  </div>
                  <div className="flex items-center gap-2" title="🐦 Twitter/X">
                    <Icon icon="logos:twitter" width={18} />
                    <TextInput placeholder="https://twitter.com/..." value={sections.footer.twitter} onChange={(e) => updateFooter('twitter', e.target.value)} sizing="sm" className="flex-1" />
                  </div>
                  <div className="flex items-center gap-2" title="💼 LinkedIn">
                    <Icon icon="logos:linkedin-icon" width={18} />
                    <TextInput placeholder="https://linkedin.com/..." value={sections.footer.linkedin} onChange={(e) => updateFooter('linkedin', e.target.value)} sizing="sm" className="flex-1" />
                  </div>
                </div>
              </div>
              <div title="🎨 Color de fondo del footer">
                <Label htmlFor="footer-bg" className="text-sm font-semibold">🎨 Color de Fondo</Label>
                <div className="flex gap-2">
                  <input type="color" id="footer-bg" value={sections.footer.backgroundColor} onChange={(e) => updateFooter('backgroundColor', e.target.value)} className="w-10 h-8 rounded border cursor-pointer" />
                  <TextInput value={sections.footer.backgroundColor} onChange={(e) => updateFooter('backgroundColor', e.target.value)} sizing="sm" className="flex-1" placeholder="#f9fafb" />
                </div>
              </div>
            </div>
          </div>

          {/* Ayuda */}
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 border border-gray-300 dark:border-gray-600">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">💡 Variables:</p>
            <div className="flex flex-wrap gap-1">
              {['nombre', 'email', 'numero_documento', 'numero_poliza', 'fecha_vencimiento'].map(v => (
                <code key={v} className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-[10px] cursor-help" title={`Usa {{${v}}} en textos`}>
                  {`{{${v}}}`}
                </code>
              ))}
            </div>
          </div>
        </div>

        {/* Vista Previa */}
        <div className="w-1/2 border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
          <div className="bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600 p-3 flex items-center gap-2">
            <Icon icon="solar:eye-bold" width={18} className="text-gray-600 dark:text-gray-400" />
            <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">Vista Previa</span>
          </div>
          <div className="p-4 overflow-y-auto" style={{ height: 'calc(100% - 52px)' }}>
            <div dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(previewHtml) }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailDesigner;