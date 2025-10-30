import React, { useEffect, useState, useRef } from 'react';
import { Card, Button, TextInput, Label, Alert, Spinner } from 'flowbite-react';
import { Icon } from '@iconify/react';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import saasApi from 'src/services/saasApi';

const BCrumb = [
  {
    to: '/',
    title: 'Dashboard',
  },
  {
    to: '/apps/admin',
    title: 'Administración',
  },
  {
    title: 'Configuración Agencia',
  },
  {
    title: 'Información de agencia',
  },
];

const InformacionAgencia: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [form, setForm] = useState<any>({
    name: '',
    legal_name: '',
    document_type: '',
    document_number: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    website: '',
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState<string>('#635BFF');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(null);
  const [initialPrimaryColor, setInitialPrimaryColor] = useState<string>('#635BFF');

  // Colores predefinidos
  const defaultColors = [
    { name: 'Azul', value: '#635BFF' },
    { name: 'Verde', value: '#10B981' },
    { name: 'Rojo', value: '#EF4444' },
    { name: 'Naranja', value: '#F59E0B' },
    { name: 'Morado', value: '#8B5CF6' },
    { name: 'Rosa', value: '#EC4899' },
    { name: 'Índigo', value: '#6366F1' },
    { name: 'Turquesa', value: '#14B8A6' },
  ];

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        
        const info = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8081/api'}/saas/informacion-agencia`,
          {
            headers: await (saasApi as any).getAuthHeaders(),
          },
        );
        
        if (!info.ok) {
          const errorData = await info.json().catch(() => ({}));
          throw new Error(errorData.message || `Error ${info.status}: No se pudo cargar la información`);
        }
        
        const data = await info.json();
        console.log('📊 Datos del broker recibidos:', data);
        
        if (!data.success || !data.data) {
          throw new Error('Respuesta inválida del servidor');
        }
        
        const b = data.data;
        setForm({
          name: b.name || b.nombre || '',
          legal_name: b.legal_name || b.razon_social || '',
          document_type: b.document_type || b.tipo_documento || '',
          document_number: b.document_number || b.numero_documento || '',
          email: b.email || b.correo || '',
          phone: b.phone || b.telefono || '',
          address: b.address || b.direccion || '',
          city: b.city || b.ciudad || '',
          state: b.state || b.departamento || '',
          country: b.country || b.pais || 'Colombia',
          postal_code: b.postal_code || b.codigo_postal || '',
          website: b.website || b.sitio_web || '',
        });
        
        // Cargar logo (priorizar branding.logo o logo_url; fallback a logo con /storage)
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';
        const brandingLogo = b?.branding?.logo;
        const logoUrlResp = b?.logo_url;
        const rawLogo = brandingLogo || logoUrlResp || b?.logo;
        if (rawLogo) {
          const raw = String(rawLogo);
          const logoPath = raw.startsWith('http') ? raw : `${apiBase}/storage/${raw.replace(/^\/+/, '')}`;
          setLogoUrl(logoPath);
        }
        
        // Cargar color primario desde branding si existe
        if (b.branding?.primary_color) {
          setPrimaryColor(b.branding.primary_color);
          setInitialPrimaryColor(b.branding.primary_color);
        } else {
          setInitialPrimaryColor('#635BFF');
        }
      } catch (e) {
        console.error('❌ Error cargando información de agencia:', e);
        setError(e instanceof Error ? e.message : 'Error al cargar información');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onChange = (field: string, value: string) =>
    setForm((p: any) => ({ ...p, [field]: value }));

  const onSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // 1) Guardar información general
      const resp = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8081/api'}/saas/informacion-agencia`,
        {
          method: 'PUT',
          headers: {
            ...(await (saasApi as any).getAuthHeaders()),
          },
          body: JSON.stringify(form),
        },
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudo guardar la información de la agencia');
      }

      // 2) Guardar branding (logo y/o color) solo al guardar
      let brandingActualizado = false;

      if (pendingLogoFile) {
        const fd = new FormData();
        fd.append('logo', pendingLogoFile);
        fd.append('primary_color', primaryColor);

        // IMPORTANTE: para multipart/form-data NO establecer Content-Type manualmente,
        // solo enviar Authorization. Muchos helpers agregan 'Content-Type: application/json'
        // y eso impide que Laravel detecte el archivo (hasFile('logo') => false).
        const auth = await (saasApi as any).getAuthHeaders();
        const headers: any = {};
        if (auth?.Authorization) headers['Authorization'] = auth.Authorization;
        if (!headers['Authorization'] && auth?.authorization) headers['Authorization'] = auth.authorization;

        const brandingResp = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8081/api'}/saas/informacion-agencia/branding`,
          {
            method: 'POST',
            headers,
            body: fd,
          },
        );

        const brandingData = await brandingResp.json().catch(() => ({}));
        if (!brandingResp.ok || !brandingData.success) {
          throw new Error(brandingData.message || 'Error al guardar el branding');
        }
        if (brandingData.data?.logo_url) {
          setLogoUrl(brandingData.data.logo_url);
        }
        brandingActualizado = true;
      } else if (primaryColor !== initialPrimaryColor) {
        const colorResp = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8081/api'}/saas/informacion-agencia/branding`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(await (saasApi as any).getAuthHeaders()),
            },
            body: JSON.stringify({ primary_color: primaryColor }),
          },
        );
        const colorData = await colorResp.json().catch(() => ({}));
        if (!colorResp.ok || !colorData.success) {
          throw new Error(colorData.message || 'Error al guardar el color');
        }
        brandingActualizado = true;
      }

      // 3) Refrescar localStorage del empleado (broker) y aplicar tema solo después de guardar
      try {
        const infoResp = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8081/api'}/saas/informacion-agencia`,
          {
            headers: await (saasApi as any).getAuthHeaders(),
          },
        );
        if (infoResp.ok) {
          const infoData = await infoResp.json().catch(() => ({}));
          if (infoData.success && infoData.data) {
            const empleadoData = localStorage.getItem('empleado_data');
            if (empleadoData) {
              const parsed = JSON.parse(empleadoData);
              if (parsed.broker) {
                parsed.broker.logo = infoData.data.logo;
                parsed.broker.branding = infoData.data.branding;
                localStorage.setItem('empleado_data', JSON.stringify(parsed));
              }
            }
          }
        }
      } catch (e) {
        console.warn('No se pudo actualizar el contexto:', e);
      }

      if (brandingActualizado) {
        document.documentElement.style.setProperty('--color-primary', primaryColor);
        setInitialPrimaryColor(primaryColor);
      }

      // Limpiar vista previa de logo
      if (pendingLogoPreview) {
        URL.revokeObjectURL(pendingLogoPreview);
      }
      setPendingLogoFile(null);
      setPendingLogoPreview(null);

      // Recargar para reflejar logo en el sidebar y aplicar color global desde localStorage
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const onUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede superar los 5MB');
      e.target.value = '';
      return;
    }

    // Solo vista previa, no subir aún
    try {
      if (pendingLogoPreview) {
        URL.revokeObjectURL(pendingLogoPreview);
      }
      const objectUrl = URL.createObjectURL(file);
      setPendingLogoFile(file);
      setPendingLogoPreview(objectUrl);
    } finally {
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  };


  return (
    <>
      <BreadcrumbComp title="Información de Agencia" items={BCrumb} />

      {error && (
        <Alert color="failure" className="mb-4">
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size="xl" />
        </div>
      ) : (
        <Card>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nombre Comercial</Label>
                  <TextInput value={form.name} onChange={(e) => onChange('name', e.target.value)} />
                </div>
                <div>
                  <Label>Razón Social</Label>
                  <TextInput
                    value={form.legal_name}
                    onChange={(e) => onChange('legal_name', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Tipo Documento</Label>
                  <TextInput
                    value={form.document_type}
                    onChange={(e) => onChange('document_type', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Número Documento</Label>
                  <TextInput
                    value={form.document_number}
                    onChange={(e) => onChange('document_number', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <TextInput
                    type="email"
                    value={form.email}
                    onChange={(e) => onChange('email', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <TextInput
                    value={form.phone}
                    onChange={(e) => onChange('phone', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Dirección</Label>
                  <TextInput
                    value={form.address}
                    onChange={(e) => onChange('address', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Ciudad</Label>
                  <TextInput value={form.city} onChange={(e) => onChange('city', e.target.value)} />
                </div>
                <div>
                  <Label>Departamento/Estado</Label>
                  <TextInput
                    value={form.state}
                    onChange={(e) => onChange('state', e.target.value)}
                  />
                </div>
                <div>
                  <Label>País</Label>
                  <TextInput
                    value={form.country}
                    onChange={(e) => onChange('country', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Código Postal</Label>
                  <TextInput
                    value={form.postal_code}
                    onChange={(e) => onChange('postal_code', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Sitio Web</Label>
                  <TextInput
                    value={form.website}
                    onChange={(e) => onChange('website', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={onSave} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            </div>
            <div className="space-y-6">
              {/* Logo */}
              <div>
                <Label className="mb-2 block">Logo de la Agencia</Label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                  {pendingLogoPreview ? (
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <img src={pendingLogoPreview} alt="logo-preview" className="max-h-24 max-w-full object-contain" />
                      </div>
                      <p className="text-xs text-gray-500">Vista previa (no aplicado)</p>
                    </div>
                  ) : logoUrl ? (
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <img src={logoUrl} alt="logo" className="max-h-24 max-w-full object-contain" />
                      </div>
                      <p className="text-xs text-gray-500">Logo actual</p>
                    </div>
                  ) : (
                    <div className="py-4">
                      <Icon icon="solar:gallery-bold-duotone" className="mx-auto text-gray-400 mb-2" height={48} />
                      <p className="text-sm text-gray-500">Sin logo configurado</p>
                    </div>
                  )}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onUploadLogo}
                  />
                  <div className="mt-4 flex justify-center">
                    <Button
                      size="sm"
                      color="primary"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      <Icon icon="solar:upload-bold" className="mr-2" height={16} />
                      {pendingLogoPreview ? 'Cambiar Logo' : (logoUrl ? 'Cambiar Logo' : 'Subir Logo')}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Formatos: PNG, JPG, SVG (máx. 5MB)
                  </p>
                </div>
              </div>

              {/* Color Primario */}
              <div>
                <Label className="mb-2 block">Color Primario</Label>
                <div className="space-y-4">
                  {/* Selector de color personalizado */}
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-300 dark:border-gray-600"
                      />
                    </div>
                    <div className="flex-1">
                      <TextInput
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        placeholder="#635BFF"
                        className="font-mono"
                      />
                    </div>
                  </div>

                  {/* Colores predefinidos */}
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Colores predefinidos:</p>
                    <div className="grid grid-cols-4 gap-2">
                      {defaultColors.map((color) => (
                        <button
                          key={color.value}
                          onClick={() => setPrimaryColor(color.value)}
                          className={`group relative h-10 rounded-lg border-2 transition-all ${
                            primaryColor === color.value
                              ? 'border-gray-900 dark:border-white scale-105'
                              : 'border-gray-200 dark:border-gray-700 hover:scale-105'
                          }`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        >
                          {primaryColor === color.value && (
                            <Icon
                              icon="solar:check-circle-bold"
                              className="absolute inset-0 m-auto text-white drop-shadow-lg"
                              height={20}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-md border border-dashed border-gray-300 dark:border-gray-600 p-3 text-center">
                    <p className="text-xs text-gray-500">
                      Los cambios de color no se reflejarán hasta que presiones "Guardar Cambios".
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </>
  );
};

export default InformacionAgencia;
