import React, { useState, useEffect } from 'react';
import { Modal, Card, Badge, Button, Timeline } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { Renovacion } from 'src/services/renovacionesService';

interface DetalleRenovacionProps {
  show: boolean;
  onClose: () => void;
  renovacion: Renovacion | null;
  onRegistrarContacto?: (renovacion: Renovacion) => void;
  onRenovar?: (renovacion: Renovacion) => void;
}

interface HistorialContacto {
  id: string;
  fecha: string;
  tipo: 'llamada' | 'email' | 'whatsapp' | 'presencial' | 'sms';
  resultado: string;
  observaciones: string;
  agente: string;
}

const DetalleRenovacion: React.FC<DetalleRenovacionProps> = ({
  show,
  onClose,
  renovacion,
  onRegistrarContacto,
  onRenovar
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'historial' | 'documentos'>('general');
  const [historialContactos, setHistorialContactos] = useState<HistorialContacto[]>([]);

  // Datos mock para el historial de contactos
  const historialMock: HistorialContacto[] = [
    {
      id: '1',
      fecha: '2024-07-20T10:30:00',
      tipo: 'llamada',
      resultado: 'Cliente contactado exitosamente',
      observaciones: 'Cliente confirma interés en renovar, solicita cotización actualizada',
      agente: 'María González'
    },
    {
      id: '2',
      fecha: '2024-07-18T14:15:00',
      tipo: 'email',
      resultado: 'Email enviado exitosamente',
      observaciones: 'Envío de recordatorio de vencimiento y documentos requeridos',
      agente: 'María González'
    },
    {
      id: '3',
      fecha: '2024-07-15T09:45:00',
      tipo: 'whatsapp',
      resultado: 'Cliente no disponible',
      observaciones: 'Mensaje enviado, cliente responde que llamará en la tarde',
      agente: 'María González'
    }
  ];

  useEffect(() => {
    if (renovacion) {
      // Simular carga de historial
      setHistorialContactos(historialMock);
    }
  }, [renovacion]);

  const tiposSeguro = [
    { value: 'vida', label: 'Vida', icon: 'solar:heart-bold-duotone', color: 'red' },
    { value: 'automovil', label: 'Automóvil', icon: 'solar:car-bold-duotone', color: 'blue' },
    { value: 'hogar', label: 'Hogar', icon: 'solar:home-bold-duotone', color: 'green' },
    { value: 'salud', label: 'Salud', icon: 'solar:medical-kit-bold-duotone', color: 'pink' },
    { value: 'empresarial', label: 'Empresarial', icon: 'solar:buildings-bold-duotone', color: 'purple' },
  ];

  const estadosRenovacion = [
    { value: 'PENDIENTE', label: 'Pendiente', color: 'warning' },
    { value: 'EN_PROCESO', label: 'En Proceso', color: 'info' },
    { value: 'CRITICO', label: 'Crítico', color: 'failure' },
    { value: 'RENOVADO', label: 'Renovado', color: 'success' },
    { value: 'VENCIDO', label: 'Vencido', color: 'gray' }
  ];

  const prioridadRenovacion = [
    { value: 'BAJA', label: 'Baja', color: 'gray' },
    { value: 'MEDIA', label: 'Media', color: 'warning' },
    { value: 'ALTA', label: 'Alta', color: 'info' },
    { value: 'CRITICA', label: 'Crítica', color: 'failure' }
  ];

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getDiasVencimientoColor = (dias: number) => {
    if (dias < 0) return 'text-red-600';
    if (dias <= 7) return 'text-red-500';
    if (dias <= 15) return 'text-orange-500';
    if (dias <= 30) return 'text-yellow-500';
    return 'text-green-500';
  };

  const formatDiasVencimiento = (dias: number) => {
    if (dias < 0) return `${Math.abs(dias)} días vencido`;
    if (dias === 0) return 'Vence hoy';
    if (dias === 1) return 'Vence mañana';
    return `${dias} días restantes`;
  };

  const getTipoIcon = (tipo?: string) => {
    if (!tipo) return <Icon icon="solar:document-bold-duotone" className="w-4 h-4" />;
    const tipoInfo = tiposSeguro.find(t => t.value === tipo.toLowerCase());
    if (tipoInfo) {
      return <Icon icon={tipoInfo.icon} className="w-4 h-4" />;
    }
    return <Icon icon="solar:document-bold-duotone" className="w-4 h-4" />;
  };

  const getContactoIcon = (tipo: string) => {
    const iconos = {
      llamada: 'solar:phone-bold-duotone',
      email: 'solar:letter-bold-duotone',
      whatsapp: 'solar:chat-round-bold-duotone',
      presencial: 'solar:user-bold-duotone',
      sms: 'solar:chat-dots-bold-duotone'
    };
    return iconos[tipo as keyof typeof iconos] || 'solar:chat-bold-duotone';
  };

  const getEstadoBadge = (estado: string) => {
    const estadoInfo = estadosRenovacion.find(e => e.value === estado);
    return estadoInfo?.color || 'gray';
  };

  const getPrioridadBadge = (prioridad: string) => {
    const prioridadInfo = prioridadRenovacion.find(p => p.value === prioridad);
    return prioridadInfo?.color || 'gray';
  };

  if (!renovacion) return null;

  return (
    <Modal show={show} onClose={onClose} size="6xl" className="!max-w-6xl">
      <Modal.Header className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex items-center gap-3">
            {getTipoIcon(renovacion.tipoSeguro)}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Póliza {renovacion.numeroPoliza}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {renovacion.cliente} • {renovacion.aseguradora}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              color={`light${getEstadoBadge(renovacion.estado)}`}
              className="capitalize"
            >
              {estadosRenovacion.find(e => e.value === renovacion.estado)?.label || renovacion.estado}
            </Badge>
            <Badge
              color={`light${getPrioridadBadge(renovacion.prioridad)}`}
              className="capitalize"
            >
              {prioridadRenovacion.find(p => p.value === renovacion.prioridad)?.label || renovacion.prioridad}
            </Badge>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="p-0">
        {/* Tabs Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6 pt-4">
            <button
              onClick={() => setActiveTab('general')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'general'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon icon="solar:document-text-bold-duotone" className="w-4 h-4" />
                General
              </div>
            </button>
            <button
              onClick={() => setActiveTab('historial')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'historial'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon icon="solar:history-bold-duotone" className="w-4 h-4" />
                Historial
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full px-2 py-0.5">
                  {historialContactos.length}
                </span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('documentos')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'documentos'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon icon="solar:folder-bold-duotone" className="w-4 h-4" />
                Documentos
              </div>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Alert de vencimiento */}
              {renovacion.diasVencimiento <= 7 && (
                <div className={`rounded-lg p-4 ${
                  renovacion.diasVencimiento < 0 
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
                    : 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700'
                }`}>
                  <div className="flex items-center">
                    <Icon 
                      icon="solar:danger-bold-duotone" 
                      className={`w-5 h-5 mr-3 ${
                        renovacion.diasVencimiento < 0 ? 'text-red-600' : 'text-orange-600'
                      }`} 
                    />
                    <div>
                      <h4 className={`font-medium ${
                        renovacion.diasVencimiento < 0 ? 'text-red-800 dark:text-red-200' : 'text-orange-800 dark:text-orange-200'
                      }`}>
                        {renovacion.diasVencimiento < 0 ? '¡Póliza Vencida!' : '¡Vencimiento Próximo!'}
                      </h4>
                      <p className={`text-sm ${
                        renovacion.diasVencimiento < 0 ? 'text-red-700 dark:text-red-300' : 'text-orange-700 dark:text-orange-300'
                      }`}>
                        Esta póliza {formatDiasVencimiento(renovacion.diasVencimiento).toLowerCase()}. 
                        Es necesario tomar acción inmediata.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Información Principal */}
                <div className="lg:col-span-2 space-y-4">
                  <Card>
                    <div className="flex items-center gap-3 mb-4">
                      <Icon icon="solar:shield-bold-duotone" className="w-5 h-5 text-blue-600" />
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Información de la Póliza
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Número:</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {renovacion.numeroPoliza}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Aseguradora:</span>
                          <span className="text-sm text-gray-900 dark:text-white">
                            {renovacion.aseguradora}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Tipo de Seguro:</span>
                          <div className="flex items-center gap-2">
                            {getTipoIcon(renovacion.tipoSeguro)}
                            <span className="text-sm text-gray-900 dark:text-white capitalize">
                              {tiposSeguro.find(t => t.value === renovacion.tipoSeguro)?.label || renovacion.tipoSeguro}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Vencimiento:</span>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white block">
                              {new Date(renovacion.fechaVencimiento).toLocaleDateString('es-CO', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                            <span className={`text-xs font-medium ${getDiasVencimientoColor(renovacion.diasVencimiento)}`}>
                              {formatDiasVencimiento(renovacion.diasVencimiento)}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Prima:</span>
                          <span className="text-sm font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(renovacion.valorPrima)}
                          </span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Estado:</span>
                          <Badge color={`light${getEstadoBadge(renovacion.estado)}`} className="capitalize text-xs">
                            {estadosRenovacion.find(e => e.value === renovacion.estado)?.label || renovacion.estado}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <div className="flex items-center gap-3 mb-4">
                      <Icon icon="solar:user-bold-duotone" className="w-5 h-5 text-green-600" />
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Información del Cliente
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Nombre:</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {renovacion.cliente}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Documento:</span>
                          <span className="text-sm text-gray-900 dark:text-white">
                            {renovacion.dni_cliente || 'N/A'}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Agente Asignado:</span>
                          <span className="text-sm text-gray-900 dark:text-white">
                            {renovacion.agente}
                          </span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Último Contacto:</span>
                          <span className="text-sm text-gray-900 dark:text-white">
                            {new Date(renovacion.ultimoContacto).toLocaleDateString('es-CO')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Sidebar de Acciones */}
                <div className="space-y-4">
                  <Card>
                    <div className="text-center space-y-4">
                      <div className="flex items-center justify-center w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/20 rounded-full">
                        <Badge
                          color={`light${getPrioridadBadge(renovacion.prioridad)}`}
                          className="capitalize text-lg px-3 py-1"
                        >
                          {prioridadRenovacion.find(p => p.value === renovacion.prioridad)?.label}
                        </Badge>
                      </div>
                      <div>
                        <h5 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Prioridad {prioridadRenovacion.find(p => p.value === renovacion.prioridad)?.label}
                        </h5>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Basada en días de vencimiento y valor de prima
                        </p>
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <h5 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Acciones Rápidas
                    </h5>
                    <div className="space-y-2">
                      <Button
                        color="primary"
                        className="w-full justify-start"
                        onClick={() => onRegistrarContacto?.(renovacion)}
                      >
                        <Icon icon="solar:phone-bold-duotone" className="w-4 h-4 mr-2" />
                        Registrar Contacto
                      </Button>
                      
                      {renovacion.estado !== 'RENOVADO' && (
                        <Button
                          color="success"
                          className="w-full justify-start"
                          onClick={() => onRenovar?.(renovacion)}
                        >
                          <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4 mr-2" />
                          Procesar Renovación
                        </Button>
                      )}

                      <Link to={`/apps/seguros/polizas/${renovacion.poliza_id}`}>
                        <Button
                          color="light"
                          className="w-full justify-start"
                        >
                          <Icon icon="solar:document-bold-duotone" className="w-4 h-4 mr-2" />
                          Ver Póliza Completa
                        </Button>
                      </Link>
                    </div>
                  </Card>

                  <Card>
                    <h5 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Resumen de Contactos
                    </h5>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Total intentos:</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {renovacion.intentosContacto}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Último contacto:</span>
                        <span className="text-sm text-gray-900 dark:text-white">
                          {new Date(renovacion.ultimoContacto).toLocaleDateString('es-CO')}
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>

              {/* Observaciones */}
              {renovacion.observaciones && (
                <Card>
                  <div className="flex items-center gap-3 mb-3">
                    <Icon icon="solar:notes-bold-duotone" className="w-5 h-5 text-yellow-600" />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Observaciones
                    </h4>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    {renovacion.observaciones}
                  </p>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'historial' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Historial de Contactos
                </h4>
                <Button
                  color="primary"
                  size="sm"
                  onClick={() => onRegistrarContacto?.(renovacion)}
                >
                  <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4 mr-2" />
                  Nuevo Contacto
                </Button>
              </div>

              {historialContactos.length > 0 ? (
                <div className="space-y-4">
                  {historialContactos.map((contacto) => (
                    <Card key={contacto.id} className="relative">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                            <Icon 
                              icon={getContactoIcon(contacto.tipo)} 
                              className="w-5 h-5 text-blue-600 dark:text-blue-400" 
                            />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <h5 className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
                                {contacto.tipo}
                              </h5>
                              <Badge color="lightinfo" className="text-xs">
                                {contacto.resultado}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(contacto.fecha).toLocaleDateString('es-CO')}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(contacto.fecha).toLocaleTimeString('es-CO', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                            {contacto.observaciones}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Registrado por: {contacto.agente}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Icon icon="solar:history-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No hay contactos registrados</p>
                  <Button
                    color="primary"
                    onClick={() => onRegistrarContacto?.(renovacion)}
                  >
                    <Icon icon="solar:phone-bold-duotone" className="w-4 h-4 mr-2" />
                    Registrar Primer Contacto
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'documentos' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Documentos de la Renovación
                </h4>
                <Button color="primary" size="sm">
                  <Icon icon="solar:upload-bold-duotone" className="w-4 h-4 mr-2" />
                  Subir Documento
                </Button>
              </div>

              {/* Lista de documentos simulada */}
              <div className="space-y-3">
                {[
                  { nombre: 'Póliza Original.pdf', fecha: '2024-07-15', tipo: 'PDF', tamaño: '2.4 MB' },
                  { nombre: 'Inspección Vehículo.jpg', fecha: '2024-07-18', tipo: 'Imagen', tamaño: '1.8 MB' },
                  { nombre: 'Documentos Cliente.zip', fecha: '2024-07-20', tipo: 'ZIP', tamaño: '5.2 MB' }
                ].map((doc, index) => (
                  <Card key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg">
                          <Icon 
                            icon={
                              doc.tipo === 'PDF' ? 'solar:file-text-bold-duotone' :
                              doc.tipo === 'Imagen' ? 'solar:gallery-bold-duotone' :
                              'solar:folder-bold-duotone'
                            } 
                            className="w-5 h-5 text-gray-600 dark:text-gray-400" 
                          />
                        </div>
                        <div>
                          <h6 className="text-sm font-medium text-gray-900 dark:text-white">
                            {doc.nombre}
                          </h6>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {doc.tamaño} • {new Date(doc.fecha).toLocaleDateString('es-CO')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button color="light" size="xs">
                          <Icon icon="solar:download-bold-duotone" className="w-4 h-4" />
                        </Button>
                        <Button color="light" size="xs">
                          <Icon icon="solar:eye-bold-duotone" className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default DetalleRenovacion;
