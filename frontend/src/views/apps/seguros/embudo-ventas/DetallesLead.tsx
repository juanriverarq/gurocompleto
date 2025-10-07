import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Icon } from "@iconify/react";
import { Card, Badge, Button, Modal, TextInput, Textarea, Spinner, Alert } from 'flowbite-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import {
  salesFunnelService,
  SalesFunnelLead,
  formatCurrency,
  formatDate,
  formatDateTime,
  getStageColor,
  getQualityColor,
  STAGES,
  INSURANCE_TYPES,
  LEAD_SOURCES,
  QUALITY_RATINGS,
  CONTACT_METHODS,
  ContactRecord
} from '../../../../services/salesFunnelService';

interface StageHistoryItem {
  stage: string;
  changed_at: string;
  changed_by: string;
  days_in_stage: number;
}

const DetallesLead: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Estados
  const [lead, setLead] = useState<SalesFunnelLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Modales
  const [showContactModal, setShowContactModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);

  // Estados de formularios
  const [contactForm, setContactForm] = useState({
    method: 'phone',
    notes: '',
    details: ''
  });

  const [followUpForm, setFollowUpForm] = useState({
    date: '',
    notes: ''
  });

  const [stageForm, setStageForm] = useState({
    stage: '',
    notes: ''
  });

  const [closeForm, setCloseForm] = useState({
    type: 'won',
    finalValue: 0,
    policyNumber: '',
    reason: '',
    notes: ''
  });

  useEffect(() => {
    if (id) {
      loadLead();
    }
  }, [id]);

  const loadLead = async () => {
    try {
      setLoading(true);
      setError(null);
      const leadData = await salesFunnelService.getLead(Number(id));
      setLead(leadData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el lead');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordContact = async () => {
    if (!lead || !contactForm.method) return;

    try {
      setSaving(true);
      await salesFunnelService.recordContact(
        lead.id,
        contactForm.method,
        contactForm.notes,
        contactForm.details ? JSON.parse(contactForm.details) : undefined
      );
      setShowContactModal(false);
      setContactForm({ method: 'phone', notes: '', details: '' });
      await loadLead();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar contacto');
    } finally {
      setSaving(false);
    }
  };

  const handleScheduleFollowUp = async () => {
    if (!lead || !followUpForm.date) return;

    try {
      setSaving(true);
      await salesFunnelService.scheduleFollowUp(
        lead.id,
        followUpForm.date,
        followUpForm.notes
      );
      setShowFollowUpModal(false);
      setFollowUpForm({ date: '', notes: '' });
      await loadLead();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al programar seguimiento');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveToStage = async () => {
    if (!lead || !stageForm.stage) return;

    try {
      setSaving(true);
      await salesFunnelService.moveToStage(lead.id, stageForm.stage, stageForm.notes);
      setShowStageModal(false);
      setStageForm({ stage: '', notes: '' });
      await loadLead();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar etapa');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseLead = async () => {
    if (!lead) return;

    try {
      setSaving(true);
      if (closeForm.type === 'won') {
        await salesFunnelService.closeAsWon(
          lead.id,
          closeForm.finalValue,
          closeForm.policyNumber,
          closeForm.notes
        );
      } else {
        await salesFunnelService.closeAsLost(lead.id, closeForm.reason, closeForm.notes);
      }
      setShowCloseModal(false);
      setCloseForm({ type: 'won', finalValue: 0, policyNumber: '', reason: '', notes: '' });
      await loadLead();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cerrar lead');
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToClient = async () => {
    if (!lead) return;

    try {
      setSaving(true);
      await salesFunnelService.convertToClient(lead.id);
      setShowConvertModal(false);
      await loadLead();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al convertir a cliente');
    } finally {
      setSaving(false);
    }
  };

  const getStageProgress = () => {
    const stageOrder = ['lead', 'contacted', 'qualified', 'presentation', 'proposal', 'negotiation', 'closed_won'];
    const currentIndex = stageOrder.indexOf(lead?.stage || '');
    return currentIndex >= 0 ? Math.round(((currentIndex + 1) / stageOrder.length) * 100) : 0;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
        <span className="ml-2 text-lg">Cargando lead...</span>
      </div>
    );
  }

  if (error && !lead) {
    return (
      <div className="text-center py-12">
        <Icon icon="solar:danger-triangle-bold-duotone" className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          Error al cargar el lead
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {error}
        </p>
        <div className="mt-6">
          <Button onClick={loadLead} className="bg-primary hover:bg-primary/90">
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <Icon icon="solar:user-cross-bold-duotone" className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          Lead no encontrado
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          El lead que buscas no existe o ha sido eliminado.
        </p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-4">
          <Alert color="failure" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/apps/seguros/embudo-ventas')}
              color="gray"
              className="p-2"
            >
              <Icon icon="solar:arrow-left-bold" className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {lead.first_name} {lead.last_name}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Lead ID: {lead.id} • Creado el {formatDate(lead.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(`/apps/seguros/embudo-ventas/${lead.id}/edit`)}
              color="blue"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Icon icon="solar:pen-bold-duotone" className="w-4 h-4 mr-2" />
              Editar
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Progreso del Lead</h3>
              <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-[10px] ${getStageColor(lead.stage)}`}>
                {STAGES[lead.stage as keyof typeof STAGES]}
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300" 
                style={{ width: `${getStageProgress()}%` }}
              />
            </div>
            
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {getStageProgress()}% completado • {lead.days_in_current_stage} días en esta etapa
            </div>
          </div>
        </Card>

        {/* Main Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Información Personal */}
          <Card className="lg:col-span-2">
            <div className="space-y-6">
              <h3 className="text-lg font-medium flex items-center">
                <Icon icon="solar:user-bold-duotone" className="w-5 h-5 mr-2 text-primary" />
                Información Personal
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nombre Completo
                  </label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {lead.first_name} {lead.last_name}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email
                  </label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {lead.email || 'No especificado'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Teléfono
                  </label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {lead.phone || 'No especificado'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Teléfono Secundario
                  </label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {lead.secondary_phone || 'No especificado'}
                  </p>
                </div>

                {lead.company_name && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Empresa
                      </label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {lead.company_name}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Cargo
                      </label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {lead.position || 'No especificado'}
                      </p>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Ciudad
                  </label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {lead.city || 'No especificada'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Departamento
                  </label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {lead.department || 'No especificado'}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Acciones Rápidas */}
          <Card>
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Acciones Rápidas</h3>
              
              <div className="space-y-2">
                <Button
                  onClick={() => setShowContactModal(true)}
                  color="blue"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <Icon icon="solar:phone-bold-duotone" className="w-4 h-4 mr-2" />
                  Registrar Contacto
                </Button>

                <Button
                  onClick={() => setShowFollowUpModal(true)}
                  color="purple"
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  <Icon icon="solar:calendar-add-bold-duotone" className="w-4 h-4 mr-2" />
                  Programar Seguimiento
                </Button>

                <Button
                  onClick={() => setShowStageModal(true)}
                  color="green"
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Icon icon="solar:arrow-right-bold-duotone" className="w-4 h-4 mr-2" />
                  Cambiar Etapa
                </Button>

                {lead.stage !== 'closed_won' && lead.stage !== 'closed_lost' && (
                  <>
                    <Button
                      onClick={() => setShowCloseModal(true)}
                      color="orange"
                      className="w-full bg-orange-600 hover:bg-orange-700"
                    >
                      <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 mr-2" />
                      Cerrar Lead
                    </Button>

                    <Button
                      onClick={() => setShowConvertModal(true)}
                      color="indigo"
                      className="w-full bg-indigo-600 hover:bg-indigo-700"
                    >
                      <Icon icon="solar:user-check-bold-duotone" className="w-4 h-4 mr-2" />
                      Convertir a Cliente
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Información del Seguro */}
        <Card>
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center">
              <Icon icon="solar:shield-check-bold-duotone" className="w-5 h-5 mr-2 text-primary" />
              Información del Seguro
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tipo de Seguro
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  {INSURANCE_TYPES[lead.insurance_type as keyof typeof INSURANCE_TYPES]}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Valor Potencial
                </label>
                <p className="mt-1 text-sm font-bold text-green-600">
                  {formatCurrency(lead.potential_value)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Probabilidad de Cierre
                </label>
                <div className="mt-1 flex items-center">
                  <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ width: `${lead.close_probability}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {lead.close_probability}%
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Fecha Esperada de Cierre
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  {lead.expected_close_date ? formatDate(lead.expected_close_date) : 'No definida'}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Lead Information */}
        <Card>
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center">
              <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 mr-2 text-primary" />
              Información del Lead
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Fuente del Lead
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  {LEAD_SOURCES[lead.lead_source as keyof typeof LEAD_SOURCES]}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Calidad del Lead
                </label>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-[10px] ${getQualityColor(lead.quality_rating)}`}>
                  {QUALITY_RATINGS[lead.quality_rating as keyof typeof QUALITY_RATINGS]}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Puntuación del Lead
                </label>
                <p className="mt-1 text-sm font-bold text-purple-600">
                  {lead.lead_score}/100
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Agente Asignado
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  {lead.assigned_agent ? 
                    `${lead.assigned_agent.first_name} ${lead.assigned_agent.last_name}` : 
                    'No asignado'
                  }
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Historial de Contacto */}
        {lead.contact_history && lead.contact_history.length > 0 && (
          <Card>
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center">
                <Icon icon="solar:history-bold-duotone" className="w-5 h-5 mr-2 text-primary" />
                Historial de Contacto
              </h3>

              <div className="space-y-3">
                {lead.contact_history.map((contact, index) => (
                  <div key={index} className="border-l-4 border-primary pl-4 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {CONTACT_METHODS[contact.method as keyof typeof CONTACT_METHODS] || contact.method}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDateTime(contact.datetime)}
                      </span>
                    </div>
                    {contact.notes && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {contact.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Notas */}
        {lead.notes && (
          <Card>
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center">
                <Icon icon="solar:notes-bold-duotone" className="w-5 h-5 mr-2 text-primary" />
                Notas
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                {lead.notes}
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Modal de Contacto */}
      <Modal show={showContactModal} onClose={() => setShowContactModal(false)}>
        <Modal.Header>Registrar Contacto</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Método de Contacto
              </label>
              <select
                value={contactForm.method}
                onChange={(e) => setContactForm(prev => ({ ...prev, method: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {Object.entries(CONTACT_METHODS).map(([key, value]) => (
                  <option key={key} value={key}>{value}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas del Contacto
              </label>
              <Textarea
                value={contactForm.notes}
                onChange={(e) => setContactForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Describe el contacto realizado..."
                rows={3}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleRecordContact} disabled={saving}>
            {saving ? <Spinner size="sm" className="mr-2" /> : null}
            Registrar Contacto
          </Button>
          <Button color="gray" onClick={() => setShowContactModal(false)}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Seguimiento */}
      <Modal show={showFollowUpModal} onClose={() => setShowFollowUpModal(false)}>
        <Modal.Header>Programar Seguimiento</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha y Hora de Seguimiento
              </label>
              <TextInput
                type="datetime-local"
                value={followUpForm.date}
                onChange={(e) => setFollowUpForm(prev => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas
              </label>
              <Textarea
                value={followUpForm.notes}
                onChange={(e) => setFollowUpForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Describe qué se debe hacer en el seguimiento..."
                rows={3}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleScheduleFollowUp} disabled={saving || !followUpForm.date}>
            {saving ? <Spinner size="sm" className="mr-2" /> : null}
            Programar Seguimiento
          </Button>
          <Button color="gray" onClick={() => setShowFollowUpModal(false)}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Cambio de Etapa */}
      <Modal show={showStageModal} onClose={() => setShowStageModal(false)}>
        <Modal.Header>Cambiar Etapa</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nueva Etapa
              </label>
              <select
                value={stageForm.stage}
                onChange={(e) => setStageForm(prev => ({ ...prev, stage: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Selecciona una etapa</option>
                {Object.entries(STAGES).map(([key, value]) => (
                  <option key={key} value={key} disabled={key === lead?.stage}>
                    {value} {key === lead?.stage ? '(Actual)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas del Cambio
              </label>
              <Textarea
                value={stageForm.notes}
                onChange={(e) => setStageForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Describe por qué se cambió la etapa..."
                rows={3}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleMoveToStage} disabled={saving || !stageForm.stage}>
            {saving ? <Spinner size="sm" className="mr-2" /> : null}
            Cambiar Etapa
          </Button>
          <Button color="gray" onClick={() => setShowStageModal(false)}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Cierre */}
      <Modal show={showCloseModal} onClose={() => setShowCloseModal(false)}>
        <Modal.Header>Cerrar Lead</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Cierre
              </label>
              <select
                value={closeForm.type}
                onChange={(e) => setCloseForm(prev => ({ ...prev, type: e.target.value as 'won' | 'lost' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="won">Ganado</option>
                <option value="lost">Perdido</option>
              </select>
            </div>

            {closeForm.type === 'won' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor Final
                  </label>
                  <TextInput
                    type="number"
                    value={closeForm.finalValue}
                    onChange={(e) => setCloseForm(prev => ({ ...prev, finalValue: Number(e.target.value) }))}
                    placeholder="Valor final del contrato"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Póliza
                  </label>
                  <TextInput
                    value={closeForm.policyNumber}
                    onChange={(e) => setCloseForm(prev => ({ ...prev, policyNumber: e.target.value }))}
                    placeholder="Número de póliza"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Razón de Pérdida
                </label>
                <TextInput
                  value={closeForm.reason}
                  onChange={(e) => setCloseForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="¿Por qué se perdió el lead?"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas de Cierre
              </label>
              <Textarea
                value={closeForm.notes}
                onChange={(e) => setCloseForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notas adicionales sobre el cierre..."
                rows={3}
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            onClick={handleCloseLead} 
            disabled={saving || (closeForm.type === 'lost' && !closeForm.reason)}
            color={closeForm.type === 'won' ? 'green' : 'red'}
          >
            {saving ? <Spinner size="sm" className="mr-2" /> : null}
            Cerrar como {closeForm.type === 'won' ? 'Ganado' : 'Perdido'}
          </Button>
          <Button color="gray" onClick={() => setShowCloseModal(false)}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Conversión a Cliente */}
      <Modal show={showConvertModal} onClose={() => setShowConvertModal(false)}>
        <Modal.Header>Convertir a Cliente</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex">
                <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-blue-400 mr-2 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-blue-800">
                    Conversión a Cliente
                  </h3>
                  <p className="mt-1 text-sm text-blue-700">
                    Al convertir este lead a cliente, se creará un registro en el módulo de clientes 
                    y el lead será marcado como cerrado exitosamente.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Cliente a crear:</label>
                <p className="text-sm text-gray-900">
                  {lead.first_name} {lead.last_name}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email:</label>
                <p className="text-sm text-gray-900">
                  {lead.email || 'No especificado'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Teléfono:</label>
                <p className="text-sm text-gray-900">
                  {lead.phone || 'No especificado'}
                </p>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={handleConvertToClient} disabled={saving} color="green">
            {saving ? <Spinner size="sm" className="mr-2" /> : null}
            Convertir a Cliente
          </Button>
          <Button color="gray" onClick={() => setShowConvertModal(false)}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default DetallesLead;
