import React, { useEffect, useState } from 'react';
import { Card, Button, TextInput, Label, Alert, Spinner } from 'flowbite-react';
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
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await saasApi.getAuditLogs({ per_page: 1 }); // dummy call to ensure headers setup
        const info = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8081/api'}/saas/informacion-agencia`,
          {
            headers: await (saasApi as any).getAuthHeaders(),
          },
        );
        if (!info.ok) throw new Error('No se pudo cargar la información de agencia');
        const data = await info.json();
        const b = data.data;
        setForm({
          name: b.name || '',
          legal_name: b.legal_name || '',
          document_type: b.document_type || '',
          document_number: b.document_number || '',
          email: b.email || '',
          phone: b.phone || '',
          address: b.address || '',
          city: b.city || '',
          state: b.state || '',
          country: b.country || '',
          postal_code: b.postal_code || '',
          website: b.website || '',
        });
        setLogoUrl(
          b.logo
            ? `${import.meta.env.VITE_API_URL || 'http://localhost:8081/api'}/storage/${b.logo}`
            : null,
        );
        setFaviconUrl(
          b.favicon
            ? `${import.meta.env.VITE_API_URL || 'http://localhost:8081/api'}/storage/${b.favicon}`
            : null,
        );
      } catch (e) {
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
      if (!resp.ok) throw new Error('No se pudo guardar');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'favicon') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append(field, file);
    const resp = await fetch(
      `${
        import.meta.env.VITE_API_URL || 'http://localhost:8081/api'
      }/saas/informacion-agencia/branding`,
      {
        method: 'POST',
        headers: {
          ...(await (saasApi as any).getAuthHeaders()),
        },
        body: fd,
      },
    );
    const data = await resp.json();
    if (data.success) {
      setLogoUrl(data.data.logo_url || logoUrl);
      setFaviconUrl(data.data.favicon_url || faviconUrl);
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
              <div>
                <Label>Logo</Label>
                <div className="flex items-center gap-4 mt-2">
                  {logoUrl ? (
                    <img src={logoUrl} alt="logo" className="h-12" />
                  ) : (
                    <div className="text-gray-400">Sin logo</div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-2"
                  onChange={(e) => onUpload(e, 'logo')}
                />
              </div>
              <div>
                <Label>Favicon</Label>
                <div className="flex items-center gap-4 mt-2">
                  {faviconUrl ? (
                    <img src={faviconUrl} alt="favicon" className="h-8" />
                  ) : (
                    <div className="text-gray-400">Sin favicon</div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-2"
                  onChange={(e) => onUpload(e, 'favicon')}
                />
              </div>
            </div>
          </div>
        </Card>
      )}
    </>
  );
};

export default InformacionAgencia;
