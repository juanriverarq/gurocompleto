import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Button, Alert, Badge, Modal, Spinner } from 'flowbite-react';
import { Icon as IconifyIcon } from '@iconify/react';
import { useToast } from 'src/hooks/use-toast';
import TitleCard from 'src/components/shared/TitleBorderCard';
import salesFunnelService, { SalesFunnelLead, STAGES, INSURANCE_TYPES, LEAD_SOURCES, QUALITY_RATINGS } from 'src/services/salesFunnelService';

// Estados dinámicos del negocio
const BUSINESS_STATES = {
  'nuevo': { label: 'Nuevo', color: 'bg-blue-100 text-blue-800', icon: 'solar:star-bold-duotone' },
  'contactado': { label: 'Contactado', color: 'bg-green-100 text-green-800', icon: 'solar:phone-bold-duotone' },
  'interesado': { label: 'Interesado', color: 'bg-orange-100 text-orange-800', icon: 'solar:heart-bold-duotone' },
  'negociando': { label: 'Negociando', color: 'bg-purple-100 text-purple-800', icon: 'solar:handshake-bold-duotone' },
  'cerrado': { label: 'Cerrado', color: 'bg-gray-100 text-gray-800', icon: 'solar:check-circle-bold-duotone' }
};

const DetalleLead: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<SalesFunnelLead | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para cambio de estado rápido
  const [showStateModal, setShowStateModal] = useState(false);
  const [newState, setNewState] = useState<string>('');
  const [changingState, setChangingState] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await salesFunnelService.getLead(Number(id));
        setLead(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar negocio');
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  // Función para cambiar estado del negocio
  const handleChangeState = () => {
    setNewState(lead?.business_state || 'nuevo');
    setShowStateModal(true);
  };

  // Confirmar cambio de estado
  const confirmStateChange = async () => {
    if (!lead || !newState) return;
    
    try {
      setChangingState(true);
      // Usar notes para almacenar el estado por ahora (hasta que se añada business_state al backend)
      await salesFunnelService.updateLead(lead.id, { 
        notes: `Estado: ${newState}` 
      });
      
      // Actualizar el lead local
      setLead(prev => prev ? { ...prev, business_state: newState } : null);
      
      const stateLabel = BUSINESS_STATES[newState as keyof typeof BUSINESS_STATES]?.label || newState;
      toast({
        title: "Estado actualizado",
        description: `El negocio ahora está en estado: ${stateLabel}`
      });
      
      setShowStateModal(false);
      setNewState('');
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error al cambiar estado",
        description: e instanceof Error ? e.message : 'No se pudo cambiar el estado'
      });
    } finally {
      setChangingState(false);
    }
  };

  const formatCurrency = (value: number) => {
    const numValue = Number(value) || 0;
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(numValue);
  };

  // Funciones para acciones de contacto
  const handleCall = () => {
    if (!lead?.phone) {
      toast({
        variant: "destructive",
        title: "Sin teléfono",
        description: "No hay número de teléfono registrado para este negocio"
      });
      return;
    }
    
    try {
      window.open(`tel:${lead.phone}`, '_self');
      toast({
        title: "Llamada iniciada",
        description: `Llamando a ${lead.phone}`
      });
    } catch (error) {
      toast({
        variant: "destructive", 
        title: "Error",
        description: "No se pudo iniciar la llamada"
      });
    }
  };

  const handleEmail = () => {
    if (!lead?.email) {
      toast({
        variant: "destructive",
        title: "Sin email",
        description: "No hay email registrado para este negocio"
      });
      return;
    }
    
    try {
      const subject = encodeURIComponent(`Seguimiento - Negocio #${lead.id}`);
      const body = encodeURIComponent(`Hola ${lead.first_name},\n\nMe comunico contigo para dar seguimiento a tu interés en nuestros seguros.\n\nSaludos cordiales.`);
      window.open(`mailto:${lead.email}?subject=${subject}&body=${body}`, '_self');
      toast({
        title: "Email abierto",
        description: `Enviando email a ${lead.email}`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error", 
        description: "No se pudo abrir el cliente de email"
      });
    }
  };

  const handleWhatsApp = () => {
    if (!lead?.phone) {
      toast({
        variant: "destructive",
        title: "Sin teléfono",
        description: "No hay número de teléfono registrado para este negocio"
      });
      return;
    }
    
    try {
      // Limpiar el número de teléfono (quitar espacios, guiones, etc.)
      const cleanPhone = lead.phone.replace(/\D/g, '');
      // Añadir código de país si no lo tiene (Colombia +57)
      const phoneWithCountry = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
      
      const message = encodeURIComponent(`Hola ${lead.first_name}, me comunico contigo para dar seguimiento a tu interés en nuestros seguros. ¿Cuándo podríamos conversar?`);
      window.open(`https://wa.me/${phoneWithCountry}?text=${message}`, '_blank');
      toast({
        title: "WhatsApp abierto",
        description: `Enviando mensaje a ${lead.phone}`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo abrir WhatsApp"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        <span className="ml-2">Cargando negocio...</span>
      </div>
    );
  }

  if (!lead || error) {
    return (
      <div className="p-6">
        <Alert color="failure">
          <div className="flex items-center">
            <IconifyIcon icon="solar:danger-circle-bold" className="w-5 h-5 mr-2" />
            <span>{error || 'Negocio no encontrado'}</span>
          </div>
        </Alert>
      </div>
    );
  }

  const currentState = lead.business_state || 'nuevo';
  const stateConfig = BUSINESS_STATES[currentState as keyof typeof BUSINESS_STATES] || BUSINESS_STATES.nuevo;

  return (
    <div className="space-y-6">
      {/* Header con información principal */}
      <div className="bg-white dark:bg-darkgray shadow-md dark:shadow-none rounded-[10px] p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <IconifyIcon icon="solar:user-bold-duotone" className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {lead.full_name || `${lead.first_name} ${lead.last_name}`}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <Badge className={`${stateConfig.color} px-3 py-1 rounded-full text-sm font-medium`}>
                  <IconifyIcon icon={stateConfig.icon} className="w-4 h-4 mr-1" />
                  {stateConfig.label}
                </Badge>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Etapa: {STAGES[lead.stage as keyof typeof STAGES] || lead.stage}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button color="light" onClick={() => navigate('/apps/saas/sales-funnel')} className="rounded-[10px]">
              <IconifyIcon icon="solar:arrow-left-bold" className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <Button 
              color="secondary" 
              onClick={handleChangeState} 
              className="rounded-[10px]"
            >
              <IconifyIcon icon="solar:refresh-circle-bold-duotone" className="w-4 h-4 mr-2" />
              Cambiar Estado
            </Button>
            <Button 
              onClick={() => navigate(`/apps/saas/sales-funnel/${lead.id}/editar`)} 
              color="primary" 
              className="rounded-[10px] bg-blue-600 hover:bg-blue-700"
            >
              <IconifyIcon icon="solar:pen-bold-duotone" className="w-4 h-4 mr-2" />
              Editar
            </Button>
          </div>
        </div>
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600">Valor Potencial</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(lead.potential_value || 0)}</p>
            </div>
            <IconifyIcon icon="solar:dollar-minimalistic-bold-duotone" className="w-8 h-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600">Probabilidad</p>
              <p className="text-lg font-bold text-blue-600">{lead.close_probability}%</p>
            </div>
            <IconifyIcon icon="solar:chart-square-bold-duotone" className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600">Días en Etapa</p>
              <p className="text-lg font-bold text-orange-600">{lead.days_in_current_stage || 0}</p>
            </div>
            <IconifyIcon icon="solar:clock-circle-bold-duotone" className="w-8 h-8 text-orange-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600">Calidad</p>
              <p className="text-sm font-bold text-purple-600">
                {QUALITY_RATINGS[lead.quality_rating as keyof typeof QUALITY_RATINGS] || lead.quality_rating}
              </p>
            </div>
            <IconifyIcon icon="solar:star-bold-duotone" className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Información detallada */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TitleCard title="Información de Contacto">
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <IconifyIcon icon="solar:user-bold-duotone" className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Nombre Completo</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {lead.full_name || `${lead.first_name} ${lead.last_name}`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <IconifyIcon icon="solar:letter-bold-duotone" className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Email</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{lead.email || 'No registrado'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <IconifyIcon icon="solar:phone-bold-duotone" className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Teléfono</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{lead.phone || 'No registrado'}</p>
              </div>
            </div>
          </div>
        </TitleCard>

        <TitleCard title="Detalles del Negocio">
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <IconifyIcon icon="solar:shield-check-bold-duotone" className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Ramo de Seguro</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {INSURANCE_TYPES[lead.insurance_type as keyof typeof INSURANCE_TYPES] || lead.insurance_type}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <IconifyIcon icon="solar:map-point-bold-duotone" className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Origen del Negocio</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {LEAD_SOURCES[lead.lead_source as keyof typeof LEAD_SOURCES] || lead.lead_source}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <IconifyIcon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Fecha de Creación</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {lead.created_at ? new Date(lead.created_at).toLocaleDateString('es-CO') : 'No disponible'}
                </p>
              </div>
            </div>
          </div>
        </TitleCard>
      </div>

      {/* Progreso y análisis */}
      <TitleCard title="Análisis del Negocio">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Progreso de Cierre</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Probabilidad de éxito</span>
                <span className="font-medium">{lead.close_probability}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${lead.close_probability}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Información Adicional</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">ID del Negocio:</span>
                <span className="font-medium">#{lead.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Última Actualización:</span>
                <span className="font-medium">
                  {lead.updated_at ? new Date(lead.updated_at).toLocaleDateString('es-CO') : 'No disponible'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Método de Contacto:</span>
                <span className="font-medium capitalize">{lead.preferred_contact_method || 'No especificado'}</span>
              </div>
            </div>
          </div>
        </div>
      </TitleCard>

      {/* Acciones rápidas */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Acciones Rápidas</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button 
              color="light" 
              className={`flex flex-col items-center p-4 h-auto rounded-[10px] ${!lead.phone ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-50'}`}
              onClick={handleCall}
              disabled={!lead.phone}
              title={!lead.phone ? 'No hay teléfono registrado' : `Llamar a ${lead.phone}`}
            >
              <IconifyIcon icon="solar:phone-bold-duotone" className="w-6 h-6 mb-2 text-green-600" />
              <span className="text-sm">Llamar</span>
            </Button>
            
            <Button 
              color="light" 
              className={`flex flex-col items-center p-4 h-auto rounded-[10px] ${!lead.email ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-50'}`}
              onClick={handleEmail}
              disabled={!lead.email}
              title={!lead.email ? 'No hay email registrado' : `Enviar email a ${lead.email}`}
            >
              <IconifyIcon icon="solar:letter-bold-duotone" className="w-6 h-6 mb-2 text-blue-600" />
              <span className="text-sm">Email</span>
            </Button>
            
            <Button 
              color="light" 
              className={`flex flex-col items-center p-4 h-auto rounded-[10px] ${!lead.phone ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-50'}`}
              onClick={handleWhatsApp}
              disabled={!lead.phone}
              title={!lead.phone ? 'No hay teléfono registrado' : `Enviar WhatsApp a ${lead.phone}`}
            >
              <IconifyIcon icon="solar:chat-round-bold-duotone" className="w-6 h-6 mb-2 text-green-600" />
              <span className="text-sm">WhatsApp</span>
            </Button>
            
            <Button 
              color="light" 
              className="flex flex-col items-center p-4 h-auto rounded-[10px] hover:bg-orange-50"
              onClick={handleChangeState}
            >
              <IconifyIcon icon="solar:refresh-circle-bold-duotone" className="w-6 h-6 mb-2 text-orange-600" />
              <span className="text-sm">Cambiar Estado</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Modal para cambiar estado */}
      <Modal show={showStateModal} onClose={() => setShowStateModal(false)} size="md">
        <Modal.Header>Cambiar Estado del Negocio</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                Selecciona el nuevo estado para: <strong>{lead.full_name || `${lead.first_name} ${lead.last_name}`}</strong>
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(BUSINESS_STATES).map(([key, state]) => (
                <div
                  key={key}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    newState === key 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => setNewState(key)}
                >
                  <div className="flex items-center gap-3">
                    <IconifyIcon icon={state.icon} className="w-5 h-5" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{state.label}</div>
                      <div className="text-xs text-gray-500">
                        {key === 'nuevo' && 'Negocio recién creado'}
                        {key === 'contactado' && 'Se ha establecido contacto inicial'}
                        {key === 'interesado' && 'Cliente muestra interés en el producto'}
                        {key === 'negociando' && 'En proceso de negociación activa'}
                        {key === 'cerrado' && 'Negocio finalizado (ganado o perdido)'}
                      </div>
                    </div>
                    {newState === key && (
                      <IconifyIcon icon="solar:check-circle-bold" className="w-5 h-5 text-blue-600 ml-auto" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="light" onClick={() => setShowStateModal(false)} disabled={changingState}>
            Cancelar
          </Button>
          <Button 
            color="primary" 
            onClick={confirmStateChange} 
            disabled={changingState || !newState}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {changingState ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Cambiando...
              </>
            ) : (
              'Cambiar Estado'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default DetalleLead;


