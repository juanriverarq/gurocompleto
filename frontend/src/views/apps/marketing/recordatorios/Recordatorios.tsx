import { useState } from 'react';
import { Card, Badge, Button, Alert, Modal } from 'flowbite-react';
import { Icon } from '@iconify/react';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';

const BCrumb = [
  {
    to: "/",
    title: "Dashboard",
  },
  {
    to: "/apps/marketing",
    title: "Marketing",
  },
  {
    title: "Email Marketing",
  },
  {
    title: "Recordatorios",
  },
];

const recordatoriosData = [
  {
    id: "REC-001",
    titulo: "Renovación Seguro Auto - Enero 2025",
    tipo: "email",
    estado: "enviado",
    destinatarios: 1250,
    enviados: 1248,
    abiertos: 456,
    clicks: 89,
    fechaProgramada: "15/01/2025",
    fechaEnvio: "15/01/2025 09:00",
    plantilla: "Renovación Auto",
    campana: "Renovaciones Q1"
  },
  {
    id: "REC-002",
    titulo: "Seguimiento Cotización Vida",
    tipo: "whatsapp",
    estado: "programado",
    destinatarios: 234,
    enviados: 0,
    abiertos: 0,
    clicks: 0,
    fechaProgramada: "16/01/2025",
    plantilla: "Seguimiento Cotización",
    campana: "Seguimiento Leads"
  }
];

const Recordatorios = () => {
  const [recordatorios] = useState(recordatoriosData);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsappConectado, setWhatsappConectado] = useState(false);
  const [filtroTipo] = useState('todos');

  const recordatoriosFiltrados = filtroTipo === 'todos' 
    ? recordatorios 
    : recordatorios.filter(r => r.tipo === filtroTipo);

  const totalRecordatorios = recordatorios.length;
  const programados = recordatorios.filter(r => r.estado === 'programado').length;
  const enviados = recordatorios.filter(r => r.estado === 'enviado').length;
  const totalDestinatarios = recordatorios.reduce((acc, r) => acc + r.destinatarios, 0);

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'programado':
        return <Badge color="warning">Programado</Badge>;
      case 'enviando':
        return <Badge color="info">Enviando</Badge>;
      case 'enviado':
        return <Badge color="success">Enviado</Badge>;
      case 'fallido':
        return <Badge color="failure">Fallido</Badge>;
      default:
        return <Badge color="gray">Desconocido</Badge>;
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'email':
        return 'solar:letter-bold-duotone';
      case 'whatsapp':
        return 'solar:chat-round-bold-duotone';
      case 'sms':
        return 'solar:phone-bold-duotone';
      default:
        return 'solar:notification-bold-duotone';
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'email':
        return 'text-blue-500';
      case 'whatsapp':
        return 'text-green-500';
      case 'sms':
        return 'text-purple-500';
      default:
        return 'text-gray-500';
    }
  };

  const conectarWhatsApp = () => {
    setWhatsappConectado(true);
    setShowWhatsAppModal(false);
  };

  return (
    <>
      <BreadcrumbComp title="Recordatorios" items={BCrumb} />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white mb-2">Recordatorios</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Envía recordatorios por email y WhatsApp para mantener a tus clientes informados.
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Icon icon="solar:notification-bold" className="text-primary" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{totalRecordatorios}</h3>
              <p className="text-sm text-gray-500">Total Recordatorios</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-warning/10 rounded-lg">
              <Icon icon="solar:clock-circle-bold" className="text-warning" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{programados}</h3>
              <p className="text-sm text-gray-500">Programados</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-success/10 rounded-lg">
              <Icon icon="solar:check-circle-bold" className="text-success" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{enviados}</h3>
              <p className="text-sm text-gray-500">Enviados</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-info/10 rounded-lg">
              <Icon icon="solar:users-group-two-rounded-bold" className="text-info" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{totalDestinatarios.toLocaleString()}</h3>
              <p className="text-sm text-gray-500">Destinatarios</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Estado de WhatsApp */}
      <Card className="mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${whatsappConectado ? 'bg-green-100' : 'bg-gray-100'}`}>
                <Icon 
                  icon="solar:chat-round-bold-duotone" 
                  className={whatsappConectado ? 'text-green-500' : 'text-gray-400'} 
                  width={32} 
                />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-dark dark:text-white">
                  WhatsApp Business
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {whatsappConectado 
                    ? 'Conectado y listo para enviar mensajes' 
                    : 'Conecta tu cuenta de WhatsApp Business para enviar recordatorios'
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {whatsappConectado ? (
                <>
                  <Badge color="success" className="flex items-center gap-2">
                    <Icon icon="solar:check-circle-bold" width={16} />
                    Conectado
                  </Badge>
                  <Button color="light" size="sm">
                    <Icon icon="solar:settings-bold" className="mr-2" width={16} />
                    Configurar
                  </Button>
                </>
              ) : (
                <Button color="success" onClick={() => setShowWhatsAppModal(true)}>
                  <Icon icon="solar:qr-code-bold" className="mr-2" width={16} />
                  Conectar WhatsApp
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Lista de Recordatorios */}
      <div className="space-y-6">
        {recordatoriosFiltrados.map((recordatorio) => (
          <Card key={recordatorio.id}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <Icon 
                      icon={getTipoIcon(recordatorio.tipo)} 
                      className={getTipoColor(recordatorio.tipo)} 
                      width={24} 
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-dark dark:text-white">
                      {recordatorio.titulo}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      <span>Campaña: {recordatorio.campana}</span>
                      <span>•</span>
                      <span>Plantilla: {recordatorio.plantilla}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {getEstadoBadge(recordatorio.estado)}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal Conectar WhatsApp */}
      <Modal show={showWhatsAppModal} onClose={() => setShowWhatsAppModal(false)} size="md">
        <Modal.Header>Conectar WhatsApp Business</Modal.Header>
        <Modal.Body>
          <div className="text-center space-y-6">
            <div className="mx-auto w-48 h-48 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
              {/* QR Code simulado */}
              <div className="grid grid-cols-8 gap-1">
                {Array.from({ length: 64 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 ${Math.random() > 0.5 ? 'bg-black' : 'bg-white'} rounded-sm`}
                  />
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-dark dark:text-white mb-2">
                Escanea el código QR
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                1. Abre WhatsApp en tu teléfono<br />
                2. Ve a Configuración → Dispositivos vinculados<br />
                3. Toca "Vincular un dispositivo"<br />
                4. Escanea este código QR
              </p>
            </div>
            
            <Alert color="info">
              <Icon icon="solar:info-circle-bold" className="mr-2" width={16} />
              <span className="text-sm">
                Necesitas una cuenta de WhatsApp Business para enviar recordatorios masivos.
              </span>
            </Alert>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="light" onClick={() => setShowWhatsAppModal(false)}>
            Cancelar
          </Button>
          <Button color="success" onClick={conectarWhatsApp}>
            <Icon icon="solar:check-circle-bold" className="mr-2" width={16} />
            Simular Conexión
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Recordatorios;
