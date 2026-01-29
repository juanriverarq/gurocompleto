import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/shadcn-ui/Default-Ui/card';
import { Button } from '../../components/shadcn-ui/Default-Ui/button';
import { Input } from '../../components/shadcn-ui/Default-Ui/input';
import { Label } from '../../components/shadcn-ui/Default-Ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../../components/shadcn-ui/Default-Ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/shadcn-ui/Default-Ui/tabs';
import { Icon as IconifyIcon } from '@iconify/react';
import masterPanelService from '../../services/masterPanelService';

interface BrokerDetail {
  id: number;
  name: string;
  legal_name: string;
  document_type: string;
  document_number: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  website: string;
  plan: string;
  status: string;
  max_users: number;
  max_clients: number;
  max_policies: number;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  created_at: string;
  policies_count: number;
  clients_count: number;
  users_count: number;
  owner?: {
    id: number;
    name: string;
    email: string;
  };
}

const MasterBrokerEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [broker, setBroker] = useState<BrokerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    legal_name: '',
    document_type: 'NIT',
    document_number: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: 'Colombia',
    postal_code: '',
    website: '',
    plan: 'basic',
    status: 'active',
    max_users: 5,
    max_clients: 100,
    max_policies: 500,
  });

  useEffect(() => {
    if (id) {
      loadBroker();
    }
  }, [id]);

  const loadBroker = async () => {
    setLoading(true);
    try {
      const response = await masterPanelService.getBrokerDetail(Number(id));
      if (response.success) {
        const b = response.data.broker;
        setBroker(b);
        setFormData({
          name: b.name || '',
          legal_name: b.legal_name || '',
          document_type: b.document_type || 'NIT',
          document_number: b.document_number || '',
          email: b.email || '',
          phone: b.phone || '',
          address: b.address || '',
          city: b.city || '',
          state: b.state || '',
          country: b.country || 'Colombia',
          postal_code: b.postal_code || '',
          website: b.website || '',
          plan: b.plan || 'basic',
          status: b.status || 'active',
          max_users: b.max_users || 5,
          max_clients: b.max_clients || 100,
          max_policies: b.max_policies || 500,
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cargar broker');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      setSuccess('Broker actualizado correctamente');
      setTimeout(() => navigate('/master-panel/brokers'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/master-panel/brokers')}>
          <IconifyIcon icon="solar:arrow-left-linear" className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <IconifyIcon icon="solar:buildings-2-bold" className="text-purple-600" />
            {broker?.name || 'Editar Broker'}
          </h1>
          <p className="text-gray-500">ID: {id}</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <IconifyIcon icon="solar:danger-circle-bold" className="w-5 h-5 text-red-600" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
          <IconifyIcon icon="solar:check-circle-bold" className="w-5 h-5 text-green-600" />
          <span className="text-green-700">{success}</span>
        </div>
      )}

      {/* Stats Cards */}
      {broker && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <IconifyIcon icon="solar:document-text-bold" className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{broker.policies_count?.toLocaleString() || 0}</p>
                  <p className="text-sm text-gray-500">Pólizas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <IconifyIcon icon="solar:users-group-rounded-bold" className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{broker.clients_count?.toLocaleString() || 0}</p>
                  <p className="text-sm text-gray-500">Clientes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <IconifyIcon icon="solar:user-bold" className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{broker.users_count || 0}</p>
                  <p className="text-sm text-gray-500">Usuarios</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <IconifyIcon icon="solar:crown-bold" className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    broker.plan === 'pro' ? 'bg-purple-100 text-purple-700' :
                    broker.plan === 'enterprise' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {broker.plan?.toUpperCase() || 'BASIC'}
                  </span>
                  <p className="text-sm text-gray-500 mt-1">Plan Actual</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="general">
            <TabsList className="mb-6">
              <TabsTrigger value="general" className="flex items-center gap-2">
                <IconifyIcon icon="solar:buildings-linear" className="w-4 h-4" />
                Información General
              </TabsTrigger>
              <TabsTrigger value="plan" className="flex items-center gap-2">
                <IconifyIcon icon="solar:settings-linear" className="w-4 h-4" />
                Plan y Límites
              </TabsTrigger>
              <TabsTrigger value="owner" className="flex items-center gap-2">
                <IconifyIcon icon="solar:user-linear" className="w-4 h-4" />
                Propietario
              </TabsTrigger>
            </TabsList>

            {/* Tab: Información General */}
            <TabsContent value="general">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre Comercial *</Label>
                    <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legal_name">Razón Social</Label>
                    <Input id="legal_name" name="legal_name" value={formData.legal_name} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="document_type">Tipo Documento</Label>
                    <Select value={formData.document_type} onValueChange={(v) => handleSelectChange('document_type', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NIT">NIT</SelectItem>
                        <SelectItem value="CC">Cédula</SelectItem>
                        <SelectItem value="CE">Cédula Extranjería</SelectItem>
                        <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="document_number">Número Documento</Label>
                    <Input id="document_number" name="document_number" value={formData.document_number} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="address">Dirección</Label>
                    <Input id="address" name="address" value={formData.address} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Ciudad</Label>
                    <Input id="city" name="city" value={formData.city} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">Departamento/Estado</Label>
                    <Input id="state" name="state" value={formData.state} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">País</Label>
                    <Input id="country" name="country" value={formData.country} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Sitio Web</Label>
                    <Input id="website" name="website" value={formData.website} onChange={handleChange} placeholder="https://" />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => navigate('/master-panel/brokers')}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving} className="bg-purple-600 hover:bg-purple-700">
                    {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
                    <IconifyIcon icon="solar:diskette-linear" className="w-4 h-4 mr-2" />
                    Guardar Cambios
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* Tab: Plan y Límites */}
            <TabsContent value="plan">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Select value={formData.plan} onValueChange={(v) => handleSelectChange('plan', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select value={formData.status} onValueChange={(v) => handleSelectChange('status', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Activo</SelectItem>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="suspended">Suspendido</SelectItem>
                        <SelectItem value="inactive">Inactivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_users">Máximo de Usuarios</Label>
                    <Input id="max_users" name="max_users" type="number" value={formData.max_users} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_clients">Máximo de Clientes</Label>
                    <Input id="max_clients" name="max_clients" type="number" value={formData.max_clients} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_policies">Máximo de Pólizas</Label>
                    <Input id="max_policies" name="max_policies" type="number" value={formData.max_policies} onChange={handleChange} />
                  </div>
                </div>

                {/* Uso Actual */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <IconifyIcon icon="solar:chart-2-bold" className="w-5 h-5 text-purple-600" />
                    Uso Actual vs Límites
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Usuarios</span>
                        <span>{broker?.users_count || 0} / {formData.max_users}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, ((broker?.users_count || 0) / formData.max_users) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Clientes</span>
                        <span>{broker?.clients_count || 0} / {formData.max_clients}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, ((broker?.clients_count || 0) / formData.max_clients) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Pólizas</span>
                        <span>{broker?.policies_count || 0} / {formData.max_policies}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, ((broker?.policies_count || 0) / formData.max_policies) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => navigate('/master-panel/brokers')}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmit} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
                    {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
                    <IconifyIcon icon="solar:diskette-linear" className="w-4 h-4 mr-2" />
                    Guardar Cambios
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Tab: Propietario */}
            <TabsContent value="owner">
              <div className="space-y-6">
                {broker?.owner ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <IconifyIcon icon="solar:user-bold" className="w-5 h-5 text-purple-600" />
                        Usuario Propietario (MASTER)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
                          {broker.owner.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-lg font-semibold">{broker.owner.name}</p>
                          <p className="text-gray-500 flex items-center gap-1">
                            <IconifyIcon icon="solar:letter-linear" className="w-4 h-4" />
                            {broker.owner.email}
                          </p>
                          <p className="text-xs text-gray-400">ID: {broker.owner.id}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-2">
                    <IconifyIcon icon="solar:info-circle-bold" className="w-5 h-5 text-yellow-600" />
                    <span className="text-yellow-700">Este broker no tiene un propietario asignado.</span>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default MasterBrokerEditPage;
