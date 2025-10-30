import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Card,
  Button,
  Badge,
  TextInput,
  Label,
  Textarea,
  ToggleSwitch,
  Alert,
  Spinner,
  Select,
} from 'flowbite-react';
import { Icon } from '@iconify/react';
import {
  miniWebService,
  MiniWebConfig,
  MiniWebLink,
} from 'src/services/miniWebService';
import { INSURANCE_PRODUCTS } from 'src/data/insuranceProducts';
import enlacesService from 'src/services/enlacesCotizacionService';

type SlugStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'invalid';

const slugRegex = /^[a-z0-9-]{3,40}$/;

const defaultTheme = {
  primary: '#3B82F6',
  background: '#FFFFFF',
  text: '#111827',
};

const MiniWeb: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [enlacesCotizacion, setEnlacesCotizacion] = useState<any[]>([]);
  const [selectedEnlaceId, setSelectedEnlaceId] = useState<string>('');

  const [form, setForm] = useState<MiniWebConfig>({
    slug: '',
    title: '',
    bio: '',
    logoUrl: '',
    avatarUrl: '',
    links: [],
    theme: defaultTheme,
    contact: {},
    social: {},
    published: false,
  });

  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [slugMessage, setSlugMessage] = useState('');
  const slugTimerRef = useRef<number | null>(null);

  // Cargar configuración inicial y enlaces de cotización
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Cargar configuración Mini Web
        const res = await miniWebService.getConfig();
        if (mounted && res.success && res.data) {
          setForm({
            ...form,
            ...res.data,
            theme: {
              ...defaultTheme,
              ...(res.data.theme || {}),
            },
            links: res.data.links || [],
            social: res.data.social || {},
            contact: res.data.contact || {},
          });
        }

        // Cargar enlaces de cotización activos
        const enlacesRes = await enlacesService.list({ per_page: 100 });
        const enlacesRows = (enlacesRes?.data || enlacesRes?.data?.data || enlacesRes || []).data || enlacesRes?.data || [];
        if (mounted) {
          setEnlacesCotizacion(enlacesRows.filter((e: any) => e.activo));
        }
      } catch {
        // Ya maneja fallback local el servicio
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      if (slugTimerRef.current) window.clearTimeout(slugTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Verificar disponibilidad del slug con debounce
  useEffect(() => {
    if (!form.slug) {
      setSlugStatus('idle');
      setSlugMessage('');
      return;
    }

    if (!slugRegex.test(form.slug)) {
      setSlugStatus('invalid');
      setSlugMessage('Use solo minúsculas, números y guiones. Mínimo 3 caracteres.');
      return;
    }

    setSlugStatus('checking');
    setSlugMessage('Verificando disponibilidad...');
    if (slugTimerRef.current) window.clearTimeout(slugTimerRef.current);
    slugTimerRef.current = window.setTimeout(async () => {
      try {
        const res = await miniWebService.checkSlug(form.slug);
        const available = !!res.data?.available;
        setSlugStatus(available ? 'available' : 'unavailable');
        setSlugMessage(available ? 'Disponible' : 'No disponible');
      } catch {
        setSlugStatus('idle');
        setSlugMessage('');
      }
    }, 500);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.slug]);

  const handleAddLink = () => {
    const next: MiniWebLink = { label: '', url: '' };
    setForm((f) => ({ ...f, links: [...(f.links || []), next] }));
  };

  const handleAddLinkFromEnlace = () => {
    if (!selectedEnlaceId) return;
    const sel = enlacesCotizacion.find((e: any) => String(e.id) === String(selectedEnlaceId));
    if (!sel) return;
    const prod = INSURANCE_PRODUCTS.find((p) => p.value === sel.tipo);
    const label = sel.nombre || (prod ? `Cotizar ${prod.label}` : 'Cotizar');
    const slug = form.slug || 'mi-agencia';
    const url = `/web/${slug}/${sel.tipo}`;
    setForm((f) => ({ ...f, links: [...(f.links || []), { label, url }] }));
    setSelectedEnlaceId('');
  };

  const handleRemoveLink = (idx: number) => {
    setForm((f) => ({ ...f, links: (f.links || []).filter((_, i) => i !== idx) }));
  };

  const handleUpdateLink = (idx: number, patch: Partial<MiniWebLink>) => {
    setForm((f) => ({
      ...f,
      links: (f.links || []).map((lnk, i) => (i === idx ? { ...lnk, ...patch } : lnk)),
    }));
  };

  const canSave = useMemo(() => {
    if (!form.title?.trim()) return false;
    if (!form.slug?.trim() || !slugRegex.test(form.slug)) return false;
    if (slugStatus === 'unavailable' || slugStatus === 'checking' || slugStatus === 'invalid') return false;
    return true;
  }, [form.title, form.slug, slugStatus]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await miniWebService.saveConfig(form);
      if (res.success && res.data) {
        setForm((f) => ({ ...f, ...res.data }));
      }
    } catch {
      // El servicio ya toastea fallback local
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (nextState: boolean) => {
    try {
      setPublishing(true);
      const res = await miniWebService.publish(nextState);
      if (res.success) {
        setForm((f) => ({ ...f, published: nextState }));
      }
    } catch {
      // maneja mensaje el servicio
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con acciones */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Icon icon="solar:smartphone-2-bold-duotone" className="text-primary" width={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mini Web</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Crea tu página de enlaces personalizada tipo "link in bio"
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {form.published && form.slug && (
            <Button color="light" onClick={() => window.open(`/web/${form.slug}`, '_blank')}>
              <Icon icon="solar:eye-bold" className="me-2" width={16} />
              Ver público
            </Button>
          )}
          <Button 
            color={form.published ? 'warning' : 'success'} 
            onClick={() => handlePublish(!form.published)} 
            disabled={publishing || !canSave}
          >
            {publishing ? (
              <><Spinner size="sm" className="me-2"/>Procesando...</>
            ) : (
              <>
                <Icon icon={form.published ? 'solar:eye-closed-bold' : 'solar:eye-bold'} className="me-2" width={16} />
                {form.published ? 'Despublicar' : 'Publicar'}
              </>
            )}
          </Button>

          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? (
              <><Spinner size="sm" className="me-2"/>Guardando...</>
            ) : (
              <>
                <Icon icon="solar:diskette-bold" className="me-2" width={16} />
                Guardar
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Estado de publicación */}
      {form.published && form.slug && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <Icon icon="solar:check-circle-bold" className="text-white" width={24} />
              </div>
              <div>
                <p className="font-semibold text-green-900 dark:text-green-100">¡Tu Mini Web está en línea!</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300">
                    {window.location.origin}/web/{form.slug}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/web/${form.slug}`);
                    }}
                    className="text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100"
                    title="Copiar URL"
                  >
                    <Icon icon="solar:copy-bold" width={14} />
                  </button>
                </div>
              </div>
            </div>
            <Button
              color="success"
              size="sm"
              onClick={() => window.open(`/web/${form.slug}`, '_blank')}
            >
              <Icon icon="solar:eye-bold" className="me-2" width={16} />
              Abrir
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Formulario */}
        <div className="col-span-12 xl:col-span-7 space-y-6">
          {/* Información básica */}
          <Card>
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              <Icon icon="solar:info-circle-bold-duotone" className="text-primary" width={20} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Información Básica</h3>
            </div>
            
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label value="Título de tu Mini Web" htmlFor="mw-title" />
                  <TextInput
                    id="mw-title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Ej: Mi Agencia de Seguros"
                    required
                    icon={() => <Icon icon="solar:text-bold" width={16} />}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label value="URL personalizada (slug)" htmlFor="mw-slug" />
                    {slugStatus !== 'idle' && (
                      <Badge 
                        color={
                          slugStatus === 'available' ? 'success' : 
                          slugStatus === 'checking' ? 'gray' :
                          slugStatus === 'invalid' ? 'warning' : 'failure'
                        }
                        className="text-xs"
                      >
                        {slugMessage}
                      </Badge>
                    )}
                  </div>
                  <TextInput
                    id="mw-slug"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                    placeholder="mi-agencia"
                    helperText="Solo minúsculas, números y guiones (3-40 caracteres)"
                    color={
                      slugStatus === 'invalid'
                        ? 'warning'
                        : slugStatus === 'unavailable'
                        ? 'failure'
                        : undefined
                    }
                    icon={() => <Icon icon="solar:link-bold" width={16} />}
                  />
                </div>
              </div>

              <div>
                <Label value="Descripción breve" htmlFor="mw-bio" />
                <Textarea
                  id="mw-bio"
                  rows={3}
                  value={form.bio || ''}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="Cuéntale a tus visitantes sobre ti o tu agencia..."
                />
              </div>

              <div>
                <Label value="Logo o imagen de perfil" htmlFor="mw-logo" />
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <input
                      id="mw-logo"
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          setUploadingLogo(true);
                          const res = await miniWebService.uploadLogo(file);
                          if (res.success && res.data?.url) {
                            setForm((f) => ({ ...f, logoUrl: res.data!.url }));
                          }
                        } finally {
                          setUploadingLogo(false);
                          e.currentTarget.value = '';
                        }
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {uploadingLogo ? 'Subiendo...' : 'PNG, JPG o SVG. Recomendado: 256x256px'}
                    </p>
                  </div>
                  {form.logoUrl && (
                    <div className="relative">
                      <img
                        src={form.logoUrl}
                        alt="logo"
                        className="h-16 w-16 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-700"
                      />
                      <button
                        onClick={() => setForm((f) => ({ ...f, logoUrl: '' }))}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <Icon icon="solar:close-circle-bold" width={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Personalización */}
          <Card>
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              <Icon icon="solar:palette-2-bold-duotone" className="text-primary" width={20} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Personalización</h3>
            </div>

            <div className="space-y-4">
              <div>
                <Label value="Colores del tema" />
                <div className="mt-2 grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Color primario</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.theme?.primary || defaultTheme.primary}
                        onChange={(e) => setForm({ ...form, theme: { ...form.theme, primary: e.target.value } })}
                        className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Color de fondo</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.theme?.background || defaultTheme.background}
                        onChange={(e) => setForm({ ...form, theme: { ...form.theme, background: e.target.value } })}
                        className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Color de texto</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.theme?.text || defaultTheme.text}
                        onChange={(e) => setForm({ ...form, theme: { ...form.theme, text: e.target.value } })}
                        className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Contacto */}
          <Card>
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              <Icon icon="solar:phone-bold-duotone" className="text-primary" width={20} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Información de Contacto</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label value="WhatsApp" htmlFor="mw-wa" />
                <TextInput
                  id="mw-wa"
                  value={form.contact?.whatsapp || ''}
                  onChange={(e) => setForm({ ...form, contact: { ...form.contact, whatsapp: e.target.value } })}
                  placeholder="57XXXXXXXXXX"
                  icon={() => <Icon icon="mdi:whatsapp" width={16} />}
                />
              </div>
              <div>
                <Label value="Teléfono" htmlFor="mw-phone" />
                <TextInput
                  id="mw-phone"
                  value={form.contact?.phone || ''}
                  onChange={(e) => setForm({ ...form, contact: { ...form.contact, phone: e.target.value } })}
                  placeholder="+57 300 000 0000"
                  icon={() => <Icon icon="mdi:phone" width={16} />}
                />
              </div>
              <div>
                <Label value="Email" htmlFor="mw-email" />
                <TextInput
                  id="mw-email"
                  value={form.contact?.email || ''}
                  onChange={(e) => setForm({ ...form, contact: { ...form.contact, email: e.target.value } })}
                  placeholder="correo@dominio.com"
                  icon={() => <Icon icon="mdi:email" width={16} />}
                />
              </div>
              <div>
                <Label value="Dirección" htmlFor="mw-address" />
                <TextInput
                  id="mw-address"
                  value={form.contact?.address || ''}
                  onChange={(e) => setForm({ ...form, contact: { ...form.contact, address: e.target.value } })}
                  placeholder="Calle 1 # 2-34, Ciudad"
                  icon={() => <Icon icon="mdi:map-marker" width={16} />}
                />
              </div>
            </div>
          </Card>

          {/* Redes sociales */}
          <Card>
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              <Icon icon="solar:share-bold-duotone" className="text-primary" width={20} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Redes Sociales</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label value="Instagram" htmlFor="mw-ig" />
                <TextInput
                  id="mw-ig"
                  value={form.social?.instagram || ''}
                  onChange={(e) => setForm({ ...form, social: { ...form.social, instagram: e.target.value } })}
                  placeholder="https://instagram.com/tuusuario"
                  icon={() => <Icon icon="mdi:instagram" width={16} />}
                />
              </div>
              <div>
                <Label value="Facebook" htmlFor="mw-fb" />
                <TextInput
                  id="mw-fb"
                  value={form.social?.facebook || ''}
                  onChange={(e) => setForm({ ...form, social: { ...form.social, facebook: e.target.value } })}
                  placeholder="https://facebook.com/tuusuario"
                  icon={() => <Icon icon="mdi:facebook" width={16} />}
                />
              </div>
              <div>
                <Label value="Sitio web" htmlFor="mw-web" />
                <TextInput
                  id="mw-web"
                  value={form.social?.website || ''}
                  onChange={(e) => setForm({ ...form, social: { ...form.social, website: e.target.value } })}
                  placeholder="https://tu-dominio.com"
                  icon={() => <Icon icon="mdi:web" width={16} />}
                />
              </div>
              <div>
                <Label value="LinkedIn" htmlFor="mw-li" />
                <TextInput
                  id="mw-li"
                  value={form.social?.linkedin || ''}
                  onChange={(e) => setForm({ ...form, social: { ...form.social, linkedin: e.target.value } })}
                  placeholder="https://linkedin.com/in/tuusuario"
                  icon={() => <Icon icon="mdi:linkedin" width={16} />}
                />
              </div>
            </div>
          </Card>

          {/* Enlaces/Botones */}
          <Card>
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              <Icon icon="solar:link-circle-bold-duotone" className="text-primary" width={20} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Enlaces y Botones</h3>
            </div>

            <div className="space-y-4">
              {/* Agregar desde enlaces de cotización */}
              {enlacesCotizacion.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Icon icon="solar:lightbulb-bolt-bold-duotone" className="text-blue-600 dark:text-blue-400 mt-1" width={20} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                        Agrega enlaces de cotización rápidamente
                      </p>
                      <div className="flex items-center gap-2">
                        <Select
                          value={selectedEnlaceId}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedEnlaceId(e.target.value)}
                          className="flex-1"
                          sizing="sm"
                        >
                          <option value="">Selecciona un enlace de cotización...</option>
                          {enlacesCotizacion.map((e: any) => (
                            <option key={e.id} value={String(e.id)}>
                              {e.nombre || `Cotizar ${e.tipo}`}
                            </option>
                          ))}
                        </Select>
                        <Button color="primary" size="sm" onClick={handleAddLinkFromEnlace} disabled={!selectedEnlaceId}>
                          <Icon icon="solar:add-circle-bold" className="me-1" width={14} />
                          Añadir
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Botón agregar enlace manual */}
              <Button color="light" size="sm" onClick={handleAddLink} className="w-full">
                <Icon icon="solar:add-circle-bold" className="me-2" width={16} />
                Agregar enlace personalizado
              </Button>

              {/* Lista de enlaces */}
              <div className="space-y-3">
                {(form.links || []).length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                    <Icon icon="solar:link-broken-bold-duotone" className="text-gray-400 mx-auto mb-2" width={32} />
                    <p className="text-sm text-gray-500">Aún no tienes enlaces. Agrega tu primer enlace arriba.</p>
                  </div>
                )}
                {(form.links || []).map((lnk, idx) => (
                  <div key={idx} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="grid md:grid-cols-12 gap-3">
                      <div className="md:col-span-5">
                        <Label value="Texto del botón" className="text-xs" />
                        <TextInput
                          value={lnk.label}
                          onChange={(e) => handleUpdateLink(idx, { label: e.target.value })}
                          placeholder="Ej: Solicitar cotización"
                          sizing="sm"
                        />
                      </div>
                      <div className="md:col-span-6">
                        <Label value="URL destino" className="text-xs" />
                        <TextInput
                          value={lnk.url}
                          onChange={(e) => handleUpdateLink(idx, { url: e.target.value })}
                          placeholder="https://... o /web/mi-slug/autos"
                          sizing="sm"
                        />
                      </div>
                      <div className="md:col-span-1 flex items-end">
                        <Button color="failure" size="sm" onClick={() => handleRemoveLink(idx)} className="w-full">
                          <Icon icon="solar:trash-bin-minimalistic-2-bold" width={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Preview en vivo */}
        <div className="col-span-12 xl:col-span-5 space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Icon icon="solar:eye-bold-duotone" className="text-primary" width={20} />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Vista Previa</h3>
              </div>
              {form.slug && (
                <Badge color="info" className="font-mono text-xs">
                  /web/{form.slug}
                </Badge>
              )}
            </div>

            {/* Simulación de móvil */}
            <div className="mx-auto max-w-sm">
              <div className="border-8 border-gray-800 dark:border-gray-700 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <div
                  className="h-[600px] overflow-y-auto"
                  style={{
                    background: form.theme?.background || defaultTheme.background,
                    color: form.theme?.text || defaultTheme.text,
                  }}
                >
                  <div className="p-6 text-center">
                    {/* Logo */}
                    {form.logoUrl ? (
                      <img
                        src={form.logoUrl}
                        alt="logo"
                        className="mx-auto h-20 w-20 object-cover rounded-full border-4 mb-4"
                        style={{ borderColor: form.theme?.primary || defaultTheme.primary }}
                      />
                    ) : (
                      <div
                        className="mx-auto h-20 w-20 grid place-items-center border-4 rounded-full mb-4"
                        style={{ borderColor: form.theme?.primary || defaultTheme.primary, background: '#F3F4F6' }}
                      >
                        <Icon icon="solar:user-bold" className="text-gray-400" width={32} />
                      </div>
                    )}

                    {/* Título y bio */}
                    <h2 className="text-xl font-bold mb-2">{form.title || 'Tu título aquí'}</h2>
                    {form.bio && <p className="text-sm opacity-80 mb-4">{form.bio}</p>}

                    {/* Botones de contacto */}
                    {(form.contact?.whatsapp || form.contact?.phone || form.contact?.email || form.contact?.address) && (
                      <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                        {form.contact?.whatsapp && (
                          <div
                            className="h-10 w-10 rounded-full flex items-center justify-center"
                            style={{ background: form.theme?.primary || defaultTheme.primary }}
                          >
                            <Icon icon="mdi:whatsapp" className="text-white" width={20} />
                          </div>
                        )}
                        {form.contact?.phone && (
                          <div
                            className="h-10 w-10 rounded-full flex items-center justify-center"
                            style={{ background: form.theme?.primary || defaultTheme.primary }}
                          >
                            <Icon icon="mdi:phone" className="text-white" width={20} />
                          </div>
                        )}
                        {form.contact?.email && (
                          <div
                            className="h-10 w-10 rounded-full flex items-center justify-center"
                            style={{ background: form.theme?.primary || defaultTheme.primary }}
                          >
                            <Icon icon="mdi:email" className="text-white" width={20} />
                          </div>
                        )}
                        {form.contact?.address && (
                          <div
                            className="h-10 w-10 rounded-full flex items-center justify-center"
                            style={{ background: form.theme?.primary || defaultTheme.primary }}
                          >
                            <Icon icon="mdi:map-marker" className="text-white" width={20} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Enlaces/Botones */}
                    <div className="space-y-3">
                      {(form.links || []).map((lnk, i) => (
                        <div
                          key={i}
                          className="w-full border-2 rounded-xl py-3 px-4 font-medium text-center transition-all hover:scale-105"
                          style={{
                            borderColor: form.theme?.primary || defaultTheme.primary,
                            color: form.theme?.primary || defaultTheme.primary,
                          }}
                        >
                          {lnk.label || 'Botón sin texto'}
                        </div>
                      ))}
                      {(form.links || []).length === 0 && (
                        <div className="text-sm opacity-60 py-4">Tus botones aparecerán aquí</div>
                      )}
                    </div>

                    {/* Redes sociales */}
                    {(form.social?.instagram || form.social?.facebook || form.social?.website || form.social?.linkedin) && (
                      <div className="mt-6 flex items-center justify-center gap-4">
                        {form.social?.instagram && (
                          <Icon icon="mdi:instagram" width={24} style={{ color: form.theme?.text || defaultTheme.text }} />
                        )}
                        {form.social?.facebook && (
                          <Icon icon="mdi:facebook" width={24} style={{ color: form.theme?.text || defaultTheme.text }} />
                        )}
                        {form.social?.website && (
                          <Icon icon="mdi:web" width={24} style={{ color: form.theme?.text || defaultTheme.text }} />
                        )}
                        {form.social?.linkedin && (
                          <Icon icon="mdi:linkedin" width={24} style={{ color: form.theme?.text || defaultTheme.text }} />
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="mt-8 text-xs opacity-50">
                      © {new Date().getFullYear()} - Mini Web
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Tips */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Icon icon="solar:lightbulb-bolt-bold-duotone" className="text-blue-600 dark:text-blue-400 mt-1" width={24} />
              <div>
                <h3 className="text-base font-semibold text-blue-900 dark:text-blue-100 mb-2">Consejos</h3>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Usa un slug corto y memorable para tu URL</li>
                  <li>• Agrega enlaces de cotización para facilitar el contacto</li>
                  <li>• Los colores del tema se aplican a toda la página</li>
                  <li>• Publica cuando estés listo para compartir tu Mini Web</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MiniWeb;