import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/shadcn-ui/Default-Ui/card';
import { Button } from '../../components/shadcn-ui/Default-Ui/button';
import { Input } from '../../components/shadcn-ui/Default-Ui/input';
import { Label } from '../../components/shadcn-ui/Default-Ui/label';
import { Icon as IconifyIcon } from '@iconify/react';
import masterPanelService from '../../services/masterPanelService';

const MasterConfiguracionPage: React.FC = () => {
  const user = masterPanelService.getStoredUser();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <IconifyIcon icon="solar:settings-bold-duotone" className="text-gray-600" />
            Configuración
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Configuración del panel master y cuenta de administrador
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Perfil del Administrador */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconifyIcon icon="solar:user-bold-duotone" className="h-5 w-5 text-primary" />
              Perfil del Administrador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-2xl font-bold">
                  {user?.name?.charAt(0) || 'A'}
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{user?.name}</p>
                  <p className="text-gray-500">{user?.email}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                    Superadmin
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input id="name" defaultValue={user?.name} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue={user?.email} />
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
                <IconifyIcon icon="solar:diskette-linear" className="w-4 h-4 mr-2" />
                Guardar Cambios
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Seguridad */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconifyIcon icon="solar:shield-keyhole-bold-duotone" className="h-5 w-5 text-red-600" />
              Seguridad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="current_password">Contraseña Actual</Label>
                  <Input id="current_password" type="password" placeholder="••••••••" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new_password">Nueva Contraseña</Label>
                  <Input id="new_password" type="password" placeholder="••••••••" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm_password">Confirmar Contraseña</Label>
                  <Input id="confirm_password" type="password" placeholder="••••••••" />
                </div>
              </div>

              <Button variant="outline" className="w-full">
                <IconifyIcon icon="solar:key-linear" className="w-4 h-4 mr-2" />
                Cambiar Contraseña
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Información del Sistema */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconifyIcon icon="solar:info-circle-bold-duotone" className="h-5 w-5 text-blue-600" />
              Información del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="text-gray-600 dark:text-gray-300">Versión</span>
                <span className="font-mono text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded">v2.0.0</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="text-gray-600 dark:text-gray-300">Ambiente</span>
                <span className="font-mono text-sm bg-green-100 text-green-700 px-2 py-1 rounded">Producción</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="text-gray-600 dark:text-gray-300">API URL</span>
                <span className="font-mono text-xs text-gray-500 truncate max-w-[200px]">
                  {import.meta.env.VITE_API_URL || 'localhost:8001'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="text-gray-600 dark:text-gray-300">Último Login</span>
                <span className="text-sm text-gray-500">
                  {user?.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'N/A'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Acciones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconifyIcon icon="solar:widget-bold-duotone" className="h-5 w-5 text-purple-600" />
              Acciones Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <IconifyIcon icon="solar:database-bold-duotone" className="w-5 h-5 mr-3 text-blue-600" />
                Exportar Base de Datos
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <IconifyIcon icon="solar:refresh-bold-duotone" className="w-5 h-5 mr-3 text-green-600" />
                Limpiar Caché
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <IconifyIcon icon="solar:document-text-bold-duotone" className="w-5 h-5 mr-3 text-orange-600" />
                Ver Logs del Sistema
              </Button>
              <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50">
                <IconifyIcon icon="solar:trash-bin-trash-bold-duotone" className="w-5 h-5 mr-3" />
                Limpiar Datos de Prueba
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notificaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconifyIcon icon="solar:bell-bold-duotone" className="h-5 w-5 text-yellow-600" />
            Preferencias de Notificaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <IconifyIcon icon="solar:letter-bold-duotone" className="w-6 h-6 text-blue-600" />
                <span>Email</span>
              </div>
              <input type="checkbox" defaultChecked className="w-5 h-5 text-primary rounded" />
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <IconifyIcon icon="solar:chat-round-dots-bold-duotone" className="w-6 h-6 text-green-600" />
                <span>WhatsApp</span>
              </div>
              <input type="checkbox" defaultChecked className="w-5 h-5 text-primary rounded" />
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <IconifyIcon icon="solar:bell-bold-duotone" className="w-6 h-6 text-yellow-600" />
                <span>Push</span>
              </div>
              <input type="checkbox" className="w-5 h-5 text-primary rounded" />
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <IconifyIcon icon="solar:phone-bold-duotone" className="w-6 h-6 text-purple-600" />
                <span>SMS</span>
              </div>
              <input type="checkbox" className="w-5 h-5 text-primary rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MasterConfiguracionPage;
