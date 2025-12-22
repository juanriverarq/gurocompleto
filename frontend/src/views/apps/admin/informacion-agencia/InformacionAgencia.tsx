import React, { useEffect, useState, useRef } from 'react';
import { useUnifiedAuth } from 'src/context/UnifiedAuthContext';
import { useTerminologia } from 'src/context/TerminologiaContext';
import { Card, Button, TextInput, Label, Alert, Spinner, Select, Modal } from 'flowbite-react';
import { Icon } from '@iconify/react';
import saasApi from 'src/services/saasApi';

// Valores por defecto
const DEFAULT_PRIMARY_COLOR = '#635BFF';
const DEFAULT_TERMINOLOGIA = { vendedor: 'Vendedor' };

const InformacionAgencia: React.FC = () => {
  const { updateTenant } = useUnifiedAuth();
  const { refetch: refetchTerminologia } = useTerminologia();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  
  // Estado para terminología personalizada
  const [terminologia, setTerminologia] = useState({
    vendedor: 'Vendedor', // Opciones: 'Vendedor', 'Asesor', 'Agente', 'Ejecutivo'
  });

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

        // Cargar logo desde logo_url (el backend devuelve URL absoluta)
        if (b?.logo_url) {
          setLogoUrl(b.logo_url);
        }

        // Cargar colores desde branding si existen
        const branding = b.branding || {};
        if (branding.primary_color) {
          setPrimaryColor(branding.primary_color);
          setInitialPrimaryColor(branding.primary_color);
        }
        
        // Cargar terminología desde settings
        const settings = b.settings || {};
        if (settings.terminologia) {
          setTerminologia(prev => ({ ...prev, ...settings.terminologia }));
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

      // 1) Guardar información general incluyendo terminología en settings
      const dataToSave = {
        ...form,
        settings: {
          terminologia: terminologia,
        },
      };
      
      const resp = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8081/api'}/saas/informacion-agencia`,
        {
          method: 'PUT',
          headers: {
            ...(await (saasApi as any).getAuthHeaders()),
          },
          body: JSON.stringify(dataToSave),
        },
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudo guardar la información de la agencia');
      }

      // 2) Guardar branding (logo y/o color) solo al guardar
      let brandingActualizado = false;

      if (pendingLogoFile || primaryColor !== initialPrimaryColor) {
        const fd = new FormData();
        if (pendingLogoFile) {
          fd.append('logo', pendingLogoFile);
        }
        fd.append('primary_color', primaryColor);
        // No enviamos secondary ni accent para que se usen los defaults del tema

        // IMPORTANTE: para multipart/form-data NO establecer Content-Type manualmente.
        // El navegador lo establece automáticamente con el boundary correcto.
        // Solo necesitamos Authorization y otros headers de autenticación.
        const headers = await saasApi.getAuthHeadersOnly();

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
        if (brandingData.data?.branding) {
          const br = brandingData.data.branding;
          if (br.primary_color) {
            setPrimaryColor(br.primary_color);
            setInitialPrimaryColor(br.primary_color);
          }
          // Ignoramos secondary y accent del response para la UI
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
            // Actualizar contexto global inmediatamente
            updateTenant({
              logo: infoData.data.logo,
              logo_url: infoData.data.logo_url,
              branding: infoData.data.branding,
            });
            // Refrescar terminología
            await refetchTerminologia();
          }
        }
      } catch (e) {
        console.warn('No se pudo actualizar el contexto:', e);
      }

      if (brandingActualizado) {
        document.documentElement.style.setProperty('--color-primary', primaryColor);
      }

      // Limpiar vista previa de logo
      if (pendingLogoPreview) {
        URL.revokeObjectURL(pendingLogoPreview);
      }
      setPendingLogoFile(null);
      setPendingLogoPreview(null);

      // No recargar, el contexto ya actualizó todo
      // window.location.reload();
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

  const onReset = async () => {
    try {
      setResetting(true);
      setError(null);

      // Restablecer logo y color a valores por defecto
      const fd = new FormData();
      fd.append('reset_logo', 'true');
      fd.append('primary_color', DEFAULT_PRIMARY_COLOR);

      const headers = await saasApi.getAuthHeadersOnly();
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
        throw new Error(brandingData.message || 'Error al restablecer el branding');
      }

      // Restablecer terminología
      const dataToSave = {
        ...form,
        settings: {
          terminologia: DEFAULT_TERMINOLOGIA,
        },
      };
      
      const resp = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8081/api'}/saas/informacion-agencia`,
        {
          method: 'PUT',
          headers: {
            ...(await (saasApi as any).getAuthHeaders()),
          },
          body: JSON.stringify(dataToSave),
        },
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudo restablecer la configuración');
      }

      // Actualizar estados locales
      setLogoUrl(null);
      setPrimaryColor(DEFAULT_PRIMARY_COLOR);
      setInitialPrimaryColor(DEFAULT_PRIMARY_COLOR);
      setTerminologia(DEFAULT_TERMINOLOGIA);
      setPendingLogoFile(null);
      setPendingLogoPreview(null);

      // Refrescar contexto
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
            updateTenant({
              logo: undefined,
              logo_url: undefined,
              branding: { primary_color: DEFAULT_PRIMARY_COLOR },
            });
            await refetchTerminologia();
          }
        }
      } catch (e) {
        console.warn('No se pudo actualizar el contexto:', e);
      }

      document.documentElement.style.setProperty('--color-primary', DEFAULT_PRIMARY_COLOR);
      setShowResetModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al restablecer');
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Información de Agencia</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Configura los datos, logo y personalización de tu agencia</p>
      </div>

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
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-300 dark:border-gray-600"
                    />
                    <TextInput
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#635BFF"
                      className="font-mono flex-1"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {defaultColors.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => setPrimaryColor(color.value)}
                        className={`relative h-10 rounded-lg border-2 transition-all ${primaryColor === color.value
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
              </div>

              {/* Terminología Personalizada */}
              <div>
                <Label className="mb-2 block">
                  <Icon icon="solar:text-bold" className="inline mr-1" height={16} />
                  Terminología
                </Label>
                <div className="space-y-3 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">Término para "Vendedor"</Label>
                    <Select
                      value={terminologia.vendedor}
                      onChange={(e) => setTerminologia(prev => ({ ...prev, vendedor: e.target.value }))}
                      sizing="sm"
                    >
                      <option value="Vendedor">Vendedor</option>
                      <option value="Asesor">Asesor</option>
                      <option value="Agente">Agente</option>
                      <option value="Ejecutivo">Ejecutivo</option>
                      <option value="Comercial">Comercial</option>
                      <option value="Representante">Representante</option>
                    </Select>
                    <p className="text-xs text-gray-400 mt-1">
                      Se usará en: Gestión de vendedores, Liquidaciones, Pólizas, etc.
                    </p>
                  </div>
                </div>
              </div>

              {/* Botón Restablecer */}
              <div className="pt-2">
                <Button
                  color="gray"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowResetModal(true)}
                >
                  <Icon icon="solar:restart-bold" className="mr-2" height={16} />
                  Restablecer valores por defecto
                </Button>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Restablece logo, color y terminología a los valores iniciales
                </p>
              </div>

              {/* Nota informativa */}
              <div className="rounded-md border border-dashed border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 p-3">
                <p className="text-xs text-blue-700 dark:text-blue-300 text-center">
                  <Icon icon="solar:info-circle-bold" className="inline mr-1" height={14} />
                  Los cambios se aplicarán después de guardar y recargar la página.
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Modal de confirmación para restablecer */}
      <Modal show={showResetModal} onClose={() => setShowResetModal(false)} size="md">
        <Modal.Header>Restablecer configuración</Modal.Header>
        <Modal.Body>
          <div className="text-center">
            <Icon icon="solar:restart-bold" className="mx-auto mb-4 text-gray-400" height={48} />
            <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
              ¿Estás seguro?
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Esto restablecerá el <strong>logo</strong>, <strong>color primario</strong> y <strong>terminología</strong> a los valores por defecto. Los demás datos de la agencia no se modificarán.
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer className="flex justify-end gap-2">
          <Button color="gray" onClick={() => setShowResetModal(false)} disabled={resetting}>
            Cancelar
          </Button>
          <Button color="failure" onClick={onReset} disabled={resetting}>
            {resetting ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Restableciendo...
              </>
            ) : (
              'Sí, restablecer'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default InformacionAgencia;
