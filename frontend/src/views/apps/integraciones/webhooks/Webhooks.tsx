import { useState, useEffect } from 'react';
import { Card, Badge, Button, Alert, Modal, Table, TextInput, Textarea, ToggleSwitch } from 'flowbite-react';
import { Icon } from '@iconify/react';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';

const BCrumb = [
  {
    to: "/",
    title: "Dashboard",
  },
  {
    to: "/apps/integraciones",
    title: "Integraciones",
  },
  {
    title: "Webhooks",
  },
];

interface Webhook {
  id: string;
  nombre: string;
  tipo: 'entrante' | 'saliente';
  url: string;
  metodo: 'GET' | 'POST' | 'PUT' | 'DELETE';
  eventos: string[];
  estado: 'activo' | 'inactivo' | 'error' | 'pausado';
  headers: { [key: string]: string };
  autenticacion: 'none' | 'api_key' | 'bearer_token' | 'basic_auth' | 'signature';
  secreto?: string;
  timeout: number;
  reintentos: number;
  ultimo_disparo: string;
  total_disparos: number;
  disparos_exitosos: number;
  disparos_fallidos: number;
  fecha_creacion: string;
  creado_por: string;
  descripcion?: string;
}

const Webhooks = () => {
  const [loading, setLoading] = useState(true);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);

  useEffect(() => {
    setTimeout(() => {
      setWebhooks([
        {
          id: 'WH-001',
          nombre: 'Notificación Pólizas CRM',
          tipo: 'saliente',
          url: 'https://crm.empresa.com/webhooks/polizas',
          metodo: 'POST',
          eventos: ['poliza.creada', 'poliza.actualizada'],
          estado: 'activo',
          headers: { 'Content-Type': 'application/json' },
          autenticacion: 'api_key',
          timeout: 30,
          reintentos: 3,
          ultimo_disparo: '16/01/2025 14:25',
          total_disparos: 1247,
          disparos_exitosos: 1189,
          disparos_fallidos: 58,
          fecha_creacion: '15/11/2024',
          creado_por: 'admin',
          descripcion: 'Envía notificaciones de cambios en pólizas al sistema CRM'
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <BreadcrumbComp title="Webhooks" items={BCrumb} />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">Gestión de Webhooks</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Configuración y monitoreo de webhooks entrantes y salientes.
        </p>
      </div>

      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Webhooks Configurados ({webhooks.length})</h3>
          
          <div className="overflow-x-auto">
            <Table>
              <Table.Head>
                <Table.HeadCell>Webhook</Table.HeadCell>
                <Table.HeadCell>Tipo</Table.HeadCell>
                <Table.HeadCell>Estado</Table.HeadCell>
                <Table.HeadCell>URL</Table.HeadCell>
                <Table.HeadCell>Eventos</Table.HeadCell>
                <Table.HeadCell>Estadísticas</Table.HeadCell>
                <Table.HeadCell>Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {webhooks.map((webhook) => (
                  <Table.Row key={webhook.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell>
                      <div>
                        <p className="font-semibold text-sm">{webhook.nombre}</p>
                        <p className="text-xs text-gray-500">{webhook.descripcion}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={webhook.tipo === 'entrante' ? 'blue' : 'purple'} size="sm">
                        {webhook.tipo}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color="success" size="sm">
                        {webhook.estado}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <p className="font-mono text-xs text-blue-600 truncate max-w-xs">{webhook.url}</p>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-wrap gap-1">
                        {webhook.eventos.slice(0, 2).map((evento, index) => (
                          <Badge key={index} color="info" size="sm">
                            {evento.split('.')[1]}
                          </Badge>
                        ))}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm">
                        <p className="font-semibold text-green-600">{webhook.disparos_exitosos}</p>
                        <p className="text-red-600">{webhook.disparos_fallidos}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-1">
                        <Button size="xs" color="gray">
                          <Icon icon="solar:eye-bold" width={14} />
                        </Button>
                        <Button size="xs" color="info">
                          <Icon icon="solar:play-bold" width={14} />
                        </Button>
                        <Button size="xs" color="primary">
                          <Icon icon="solar:pen-bold" width={14} />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </div>
      </Card>
    </>
  );
};

export default Webhooks; 