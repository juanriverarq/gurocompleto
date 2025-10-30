import React, { useState, useEffect, useRef } from "react";
import Chart from "react-apexcharts";
import { Tabs, Table, Dropdown } from "flowbite-react";
import {
  Icon as IconifyIcon
} from '@iconify/react';
import CardBox from '../../../components/shared/CardBox';
import { Button } from "../../../components/shadcn-ui/Default-Ui/button";
import { Badge } from "../../../components/shadcn-ui/Default-Ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/shadcn-ui/Default-Ui/card";
import { Input } from "../../../components/shadcn-ui/Default-Ui/input";
import { Label } from "../../../components/shadcn-ui/Default-Ui/label";
import { Textarea } from "../../../components/shadcn-ui/Default-Ui/textarea";
import { Alert, AlertDescription } from "../../../components/shadcn-ui/Default-Ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/shadcn-ui/Default-Ui/dialog";
import { useToast } from "../../../hooks/use-toast";
import whatsappMicroservice, {
  WhatsAppConnection,
  WhatsAppStats
} from "../../../services/whatsappMicroservice";
import CreateCampaignWizard from "../../../components/campaigns/CreateCampaignWizard";
import campaignService from "../../../services/campaignService";
import whatsappInstanceService, { WhatsAppInstance, CreateInstanceRequest } from "../../../services/whatsappInstanceService";
import { useUnifiedAuth } from "../../../context/UnifiedAuthContext";
import { auth } from "../../../config/firebase";
import HeroMetricCard from "../../../components/campaigns/HeroMetricCard";
import SecondaryMetricCard from "../../../components/campaigns/SecondaryMetricCard";
import { useLocation, useNavigate } from "react-router-dom";

// Tipos locales mínimos para TS
type Contact = { phone: string; name: string; email?: string };
type Automation = {
  id?: number;
  name: string;
  trigger_type: 'keyword' | 'schedule' | 'webhook' | 'new_contact';
  trigger_value: string;
  message_template: string;
  active: boolean;
};
type NewInstanceForm = {
  phone_number: string;
  webhook_url: string;
  settings: Record<string, any>;
};

const ConfiguracionMasiva: React.FC = () => {
  const { toast } = useToast();
  const { user, usuarioSaas, tenant } = useUnifiedAuth();
  
  // Estados principales
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<WhatsAppConnection | null>(null);
  const [stats, setStats] = useState<WhatsAppStats | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  // Estados para contactos
  const [contacts, setContacts] = useState<any[]>([]);
  const [newContact, setNewContact] = useState({ phone: '', name: '', email: '' });
  
  // Estados para mensajes masivos
  const [bulkMessage, setBulkMessage] = useState({ message: '', selectedContacts: [] as string[] });
  
  // Estados para automatizaciones
  const [automations, setAutomations] = useState<any[]>([]);
  const [newAutomation, setNewAutomation] = useState<Automation>({
    name: '',
    trigger_type: 'keyword',
    trigger_value: '',
    message_template: '',
    active: true
  });
  
  // Estados para campañas
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<any | null>(null);
  const [isCampaignDetailOpen, setIsCampaignDetailOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<any | null>(null);
  const [isDeleteCampaignModalOpen, setIsDeleteCampaignModalOpen] = useState(false);
  const [showCampaignManager, setShowCampaignManager] = useState(false);
  
  // Estados para historial de envíos
  const [messageHistory, setMessageHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [totalMessages, setTotalMessages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [messagesPerPage] = useState(10);
  const [historyStats, setHistoryStats] = useState<{ sent_count?: number; delivered_count?: number; read_count?: number; failed_count?: number; pending_count?: number; total_messages?: number }>({});
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [chartLoading, setChartLoading] = useState(false);
  const [chartCategories, setChartCategories] = useState<string[]>([]);
  const [chartSeries, setChartSeries] = useState<Array<{ name: string; data: number[] }>>([]);
  const [campaignStats, setCampaignStats] = useState<any>(null);
  
  // Estados específicos de instancias WhatsApp (migrados de WhatsappInstancesSimple)
  const [instances, setInstances] = useState<any[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<any | null>(null);
  const [qrExpiry, setQrExpiry] = useState<string>('');
  const [refreshingInstances, setRefreshingInstances] = useState<number[]>([]);
  const [qrPollingInterval, setQrPollingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Estados para modal de detalles de mensaje
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null);
  const [isMessageDetailOpen, setIsMessageDetailOpen] = useState(false);
  const [instanceStats, setInstanceStats] = useState({
    total_instances: 0,
    connected_instances: 0,
    connecting_instances: 0,
    disconnected_instances: 0,
    error_instances: 0,
  });
  const [newInstance, setNewInstance] = useState<NewInstanceForm>({
    phone_number: '',
    webhook_url: '',
    settings: {}
  });
  const [creating, setCreating] = useState(false);
  
  // Costos (COP) calculados/reales
  const [totalCostCOPState, setTotalCostCOP] = useState(0);
  const [avgCostCOPState, setAvgCostCOP] = useState(0);
  

  // Deep-link desde buscador global: abrir detalles de campaña WhatsApp por ID
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openId = params.get('open_whatsapp_campaign_id');
    if (!openId) return;

    const open = async () => {
      try {
        if (!campaigns || campaigns.length === 0) {
          await loadCampaigns();
        }
        const c = (campaigns || []).find((x: any) => String(x.id) === String(openId));
        if (c) {
          setSelectedCampaign(c);
          setIsCampaignDetailOpen(true);
          try {
            await loadCampaignStats();
          } catch {}
        }
      } finally {
        params.delete('open_whatsapp_campaign_id');
        navigate(
          {
            pathname: location.pathname,
            search: params.toString() ? `?${params.toString()}` : '',
          },
          { replace: true },
        );
      }
    };
    open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Cargar estado inicial
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Rango de fechas para inicial (últimos 30 días)
      const now = new Date();
      const defaultTo = toDate || now.toISOString().slice(0, 10);
      const from = fromDate || new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      // Cargar datos en paralelo evitando duplicados (instancias, campañas, historial)
      const [instancesResp, campaignStatsResp, campaignsResp, historyResp] = await Promise.all([
        whatsappInstanceService.getInstances(),
        campaignService.getCampaignStats(),
        campaignService.getCampaigns(),
        campaignService.getSendHistory({ date_from: from, date_to: defaultTo, limit: 500, offset: 0 }),
      ]);

      // ===== Instancias / Conexión / Estadísticas de instancias
      if (instancesResp?.success && instancesResp.data) {
        const instancesData = instancesResp.data;

        const connectedInstances = instancesData.filter(
          (inst: any) => inst.status === 'connected' || inst.status === 'authenticated'
        );
        const isConnected = connectedInstances.length > 0;

        setConnectionStatus({
          success: true,
          connected: isConnected,
          qrCode: undefined,
        });

        const mappedInstances = instancesData.map((instance: any) => ({
          id: instance.id,
          instance_id: instance.instance_id,
          phone_number: instance.phone_number,
          status: instance.status || 'disconnected',
          is_active: instance.is_active,
          session_id: instance.session_id || 'N/A',
          last_activity_at: instance.last_activity_at || instance.updated_at,
          reconnect_attempts: instance.reconnect_attempts || 0,
          webhook_url: instance.webhook_url,
          settings: instance.settings,
        }));
        setInstances(mappedInstances);

        const stats = {
          total_instances: instancesData.length,
          connected_instances: instancesData.filter((i: any) => i.status === 'connected').length,
          connecting_instances: instancesData.filter((i: any) => i.status === 'connecting' || i.status === 'qr_pending').length,
          disconnected_instances: instancesData.filter((i: any) => i.status === 'disconnected').length,
          error_instances: instancesData.filter((i: any) => i.status === 'error').length,
        };
        setInstanceStats(stats);

        // Ajustar WhatsAppStats con el estado real de conexión
        if (campaignStatsResp?.success && campaignStatsResp.stats) {
          setStats({
            success: true,
            stats: {
              total_contacts: 0,
              total_messages: campaignStatsResp.stats.total_messages_sent || 0,
              total_automations: 0,
              whatsapp_connected: isConnected,
              uptime: 0,
            },
          });
        }
      } else {
        setConnectionStatus({ success: true, connected: false });
        setInstanceStats({
          total_instances: 0,
          connected_instances: 0,
          connecting_instances: 0,
          disconnected_instances: 0,
          error_instances: 0,
        });
      }

      // ===== Campañas
      if (campaignsResp?.success) {
        setCampaigns(campaignsResp.campaigns || []);
      } else {
        setCampaigns([]);
      }
      if (campaignStatsResp?.success && campaignStatsResp.stats) {
        setCampaignStats(campaignStatsResp.stats);
        if (!instancesResp?.success) {
          // Fallback de stats cuando no pudimos leer instancias
          setStats({
            success: true,
            stats: {
              total_contacts: 0,
              total_messages: campaignStatsResp.stats.total_messages_sent || 0,
              total_automations: 0,
              whatsapp_connected: false,
              uptime: 0,
            },
          });
        }
      }

      // ===== Historial y gráfico (usar misma data para ambos para evitar doble request)
      if (historyResp?.success) {
        const messages = historyResp.messages || [];

        // Listado inicial (página 1) y totales
        setMessageHistory(messages.slice(0, messagesPerPage));
        setTotalMessages(historyResp.total || messages.length || 0);
        setHistoryStats(historyResp.stats || {});

        // Construcción de gráfico a partir del mismo dataset
        const dates: string[] = [];
        const start = new Date(from);
        const end = new Date(defaultTo);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(d.toISOString().slice(0, 10));
        }

        const countByDate: Record<string, { sent: number; delivered: number; read: number; failed: number }> = {};
        dates.forEach(d => { countByDate[d] = { sent: 0, delivered: 0, read: 0, failed: 0 }; });

        messages.forEach((m: any) => {
          const dateStr = (m.sent_at || m.delivered_at || m.read_at || m.created_at || '').slice(0, 10);
          if (!dateStr || !countByDate[dateStr]) return;
          switch (m.status) {
            case 'sent':
              countByDate[dateStr].sent += 1;
              break;
            case 'delivered':
              countByDate[dateStr].delivered += 1;
              break;
            case 'read':
              countByDate[dateStr].read += 1;
              break;
            case 'failed':
              countByDate[dateStr].failed += 1;
              break;
          }
        });

        setChartCategories(dates);
        setChartSeries([
          { name: 'Enviados', data: dates.map(d => countByDate[d].sent) },
          { name: 'Entregados', data: dates.map(d => countByDate[d].delivered) },
          { name: 'Leídos', data: dates.map(d => countByDate[d].read) },
          { name: 'Fallidos', data: dates.map(d => countByDate[d].failed) },
        ]);
      } else {
        setMessageHistory([]);
        setTotalMessages(0);
        setHistoryStats({});
        setChartCategories([]);
        setChartSeries([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      initialLoadedRef.current = true;
    }
  };

  const loadCampaignStats = async () => {
    try {
      const result = await campaignService.getCampaignStats();
      if (result.success && result.stats) {
        setCampaignStats(result.stats);
      }
    } catch (error) {
      console.error('Error loading campaign stats:', error);
    }
  };

  const loadConnectionStatus = async () => {
    try {
      console.log('🔄 Cargando estado de conexión desde instancias reales...');
      
      // Obtener instancias reales de Laravel en lugar del microservicio directo
      const instancesResponse = await whatsappInstanceService.getInstances();
      
      if (instancesResponse.success && instancesResponse.data) {
        const connectedInstances = instancesResponse.data.filter(
          (inst: any) => inst.status === 'connected' || inst.status === 'authenticated'
        );
        
        // Simular el formato esperado por el componente
        const status: WhatsAppConnection = {
          success: true,
          connected: connectedInstances.length > 0,
          qrCode: undefined
        };
        
        console.log('📊 Estado calculado desde instancias:', status);
        setConnectionStatus(status);
      } else {
        // Si no hay instancias, marcar como desconectado
        setConnectionStatus({
          success: true,
          connected: false
        });
      }
    } catch (error) {
      console.error('❌ Error loading connection status:', error);
      setConnectionStatus({
        success: false,
        connected: false
      });
    }
  };

  const loadStats = async () => {
    try {
      console.log('🔄 Cargando estadísticas desde datos reales...');
      
      // Obtener estadísticas reales de campañas desde Laravel
      const campaignStatsResponse = await campaignService.getCampaignStats();
      
      if (campaignStatsResponse.success && campaignStatsResponse.stats) {
        // Adaptar al formato esperado por el componente
        const statsData: WhatsAppStats = {
          success: true,
          stats: {
            total_contacts: 0, // No disponible en campaign stats
            total_messages: campaignStatsResponse.stats.total_messages_sent || 0,
            total_automations: 0, // No disponible
            whatsapp_connected: connectionStatus?.connected || false,
            uptime: 0 // No disponible
          }
        };
        
        console.log('📊 Estadísticas adaptadas:', statsData);
        setStats(statsData);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      // Establecer stats por defecto en caso de error
      setStats({
        success: false,
        stats: {
          total_contacts: 0,
          total_messages: 0,
          total_automations: 0,
          whatsapp_connected: false,
          uptime: 0
        }
      });
    }
  };


  // Funciones auxiliares para cargar datos
  const loadContacts = async () => {
    try {
      const contactsData = await whatsappMicroservice.getContacts();
      if (contactsData.success) {
        setContacts(contactsData.contacts || []);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const loadAutomations = async () => {
    try {
      const automationsData = await whatsappMicroservice.getAutomations();
      if (automationsData.success) {
        setAutomations(automationsData.automations || []);
      }
    } catch (error) {
      console.error('Error loading automations:', error);
    }
  };

  // Cargar historial de mensajes con paginación y búsqueda
  const loadMessageHistory = async (page = currentPage, search = searchTerm) => {
    try {
      setHistoryLoading(true);
      const offset = (page - 1) * messagesPerPage;
      
      const messagesData = await campaignService.getSendHistory({
        limit: messagesPerPage,
        offset: offset,
        ...(search ? { phone: search } : {}),
        ...(fromDate ? { date_from: fromDate } : {}),
        ...(toDate ? { date_to: toDate } : {}),
      });

      if (messagesData.success) {
        setMessageHistory(messagesData.messages || []);
        setTotalMessages(messagesData.total || 0);
        setHistoryStats(messagesData.stats || {});
      }
    } catch (error) {
      console.error('Error loading message history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Cargar datos para gráfico (últimos 30 días o rango seleccionado)
  const loadChartData = async () => {
    try {
      setChartLoading(true);
      // Determinar rango por defecto (últimos 30 días)
      const now = new Date();
      const defaultTo = toDate || now.toISOString().slice(0, 10);
      const from = fromDate || new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const resp = await campaignService.getSendHistory({
        date_from: from,
        date_to: defaultTo,
        limit: 500,
        offset: 0,
      });

      const messages = (resp.success && resp.messages) ? resp.messages : [];
      // Construir mapa de días para mantener eje uniforme
      const dates: string[] = [];
      const start = new Date(from);
      const end = new Date(defaultTo);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().slice(0, 10));
      }

      const countByDate: Record<string, { sent: number; delivered: number; read: number; failed: number }> = {};
      dates.forEach(d => { countByDate[d] = { sent: 0, delivered: 0, read: 0, failed: 0 }; });

      messages.forEach((m: any) => {
        const dateStr = (m.sent_at || m.delivered_at || m.read_at || m.created_at || '').slice(0, 10);
        if (!dateStr || !countByDate[dateStr]) return;
        switch (m.status) {
          case 'sent':
            countByDate[dateStr].sent += 1;
            break;
          case 'delivered':
            countByDate[dateStr].delivered += 1;
            break;
          case 'read':
            countByDate[dateStr].read += 1;
            break;
          case 'failed':
            countByDate[dateStr].failed += 1;
            break;
        }
      });

      setChartCategories(dates);
      setChartSeries([
        { name: 'Enviados', data: dates.map(d => countByDate[d].sent) },
        { name: 'Entregados', data: dates.map(d => countByDate[d].delivered) },
        { name: 'Leídos', data: dates.map(d => countByDate[d].read) },
        { name: 'Fallidos', data: dates.map(d => countByDate[d].failed) },
      ]);
    } catch (error) {
      console.error('Error loading chart data:', error);
      setChartCategories([]);
      setChartSeries([]);
    } finally {
      setChartLoading(false);
    }
  };

  // Cargar costos desde wallet (o estimados si no hay detalle)
  const loadCosts = async () => {
    try {
      // Determinar rango igual al gráfico
      const now = new Date();
      const defaultTo = toDate || now.toISOString().slice(0, 10);
      const from = fromDate || new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      let sumCOP = 0;

      try {
        // Carga perezosa para evitar import estático cuando no se usa
        const { walletApi } = await import("../../../services/api/walletApi");
        const txResp: any = await walletApi.getTransactionHistory();
        const txs: any[] = (txResp && (txResp.data || txResp.transactions)) || [];

        const fromTime = new Date(from + 'T00:00:00');
        const toTime = new Date(defaultTo + 'T23:59:59');

        const matchWhatsApp = (t: any) => {
          const s = `${t?.category || ''} ${t?.type || ''} ${t?.description || ''} ${t?.concept || ''}`.toLowerCase();
          return s.includes('whatsapp') || s.includes('mensaje') || s.includes('message') || s.includes('campaña');
        };

        txs.forEach((t) => {
          const createdStr = t?.created_at || t?.date || t?.timestamp;
          const created = createdStr ? new Date(createdStr) : null;
          const withinRange = created ? (created >= fromTime && created <= toTime) : true;
          if (withinRange && matchWhatsApp(t)) {
            const amount = Number(t?.amount_cop ?? t?.amount ?? 0);
            if (isFinite(amount)) sumCOP += amount;
          }
        });
      } catch (e) {
        // Silenciar errores y usar fallback
      }

      // Fallback estimado si no hay transacciones relevantes
      if (!sumCOP || sumCOP < 0) {
        const perMessageEstimateCOP = 0; // Ajusta si deseas una estimación > 0
        sumCOP = perMessageEstimateCOP * (Number(historyStats.total_messages || 0));
      }

      const total = Math.max(0, Math.round(sumCOP * 100) / 100);
      const denom = Number(historyStats.total_messages || 0);
      const avg = denom > 0 ? Math.round((total / denom) * 100) / 100 : 0;

      setTotalCostCOP(total);
      setAvgCostCOP(avg);
    } catch {
      setTotalCostCOP(0);
      setAvgCostCOP(0);
    }
  };

  // Evitar recargas dobles/flasheos de gráficos: unificar triggers y saltar la primera ejecución
  const firstLoadRef = useRef(true);
  const initialLoadedRef = useRef(false);
  useEffect(() => {
    if (activeTab !== 'dashboard') return;

    // La primera carga ya la hace loadInitialData(); evitamos duplicar
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      return;
    }

    // Si cambian filtros de fecha, resetear a página 1 y cargar una sola vez
    const dateFiltersChanged = !!fromDate || !!toDate;
    const targetPage = dateFiltersChanged ? 1 : currentPage;
    if (dateFiltersChanged && currentPage !== 1) {
      setCurrentPage(1);
    }

    loadMessageHistory(targetPage, searchTerm);
    loadChartData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentPage, searchTerm, fromDate, toDate]);

  // Recalcular costos cuando cambian estadísticas o filtros
  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadCosts();
    }
  }, [historyStats, fromDate, toDate, activeTab]);
  
  // Handlers para paginación y búsqueda
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset a la primera página al buscar
  };

  const totalPages = Math.ceil(totalMessages / messagesPerPage);

  // Handlers para la conexión de WhatsApp
  const handleReconnect = async () => {
    try {
      setLoading(true);
      const result = await whatsappMicroservice.reconnect();
      
      if (result.success) {
        toast({
          title: "Éxito",
          description: result.message
        });
        setTimeout(() => loadConnectionStatus(), 2000);
      } else {
        toast({
          title: "Error",
          description: result.message || "Error al reconectar",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al reconectar WhatsApp",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      const result = await whatsappMicroservice.disconnect();
      
      if (result.success) {
        toast({
          title: "Éxito",
          description: "WhatsApp desconectado exitosamente"
        });
        setConnectionStatus(null);
        setQrCode(null);
      } else {
        toast({
          title: "Error",
          description: result.message || "Error al desconectar",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al desconectar WhatsApp",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetConnection = async () => {
    try {
      setLoading(true);
      const result = await whatsappMicroservice.resetConnection();
      
      if (result.success) {
        toast({
          title: "Éxito",
          description: "Conexión reiniciada exitosamente"
        });
        setTimeout(() => loadConnectionStatus(), 2000);
      } else {
        toast({
          title: "Error",
          description: result.message || "Error al reiniciar conexión",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al reiniciar conexión",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Handlers para contactos
  const handleAddContact = async () => {
    if (!newContact.phone || !newContact.name) {
      toast({
        title: "Error",
        description: "Teléfono y nombre son requeridos",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const result = await whatsappMicroservice.saveContact(newContact as Contact);
      
      if (result.success) {
        toast({
          title: "Éxito",
          description: "Contacto agregado exitosamente"
        });
        setNewContact({ phone: '', name: '', email: '' });
        loadContacts();
      } else {
        toast({
          title: "Error",
          description: "Error al agregar contacto",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al agregar contacto",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Handlers para mensajes masivos
  const handleSendBulkMessage = async () => {
    if (!bulkMessage.message || bulkMessage.selectedContacts.length === 0) {
      toast({
        title: "Error",
        description: "Debe seleccionar contactos y escribir un mensaje",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const contactsToSend = bulkMessage.selectedContacts.map(phone => ({ phone }));
      
      const result = await whatsappMicroservice.sendBulkMessages({
        contacts: contactsToSend,
        message: bulkMessage.message
      });
      
      if (result.success) {
        toast({
          title: "Éxito",
          description: result.message
        });
        setBulkMessage({ message: '', selectedContacts: [] });
      } else {
        toast({
          title: "Error",
          description: "Error al enviar mensajes",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al enviar mensajes masivos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };


  // Handlers para automatizaciones
  const handleCreateAutomation = async () => {
    if (!newAutomation.name || !newAutomation.message_template) {
      toast({
        title: "Error",
        description: "Nombre y mensaje son requeridos",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const result = await whatsappMicroservice.createAutomation({
        name: newAutomation.name,
        trigger_type: newAutomation.trigger_type,
        trigger_value: newAutomation.trigger_value,
        message_template: newAutomation.message_template,
        active: newAutomation.active,
      });
      
      if (result.success) {
        toast({
          title: "Éxito",
          description: "Automatización creada exitosamente"
        });
        setNewAutomation({
          name: '',
          trigger_type: 'keyword',
          trigger_value: '',
          message_template: '',
          active: true
        });
        loadAutomations();
      } else {
        toast({
          title: "Error",
          description: "Error al crear automatización",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al crear automatización",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutomation = async (id: number) => {
    try {
      const result = await whatsappMicroservice.toggleAutomation(id);
      
      if (result.success) {
        toast({
          title: "Éxito",
          description: result.message
        });
        loadAutomations();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cambiar estado de automatización",
        variant: "destructive"
      });
    }
  };

  // Función para cargar campañas desde Laravel
  const loadCampaigns = async () => {
    try {
      console.log('🔍 [DEBUG] Cargando campañas...');
      
      // Usar campaignService que maneja automáticamente la autenticación
      const result = await campaignService.getCampaigns();
      
      console.log('🔍 [DEBUG] Campaign service result:', result);
      
      if (result.success) {
        const campaigns = result.campaigns || [];
        setCampaigns(campaigns);
        console.log('🔍 [DEBUG] Campaigns set:', campaigns);
      } else {
        console.error('🔍 [DEBUG] Failed to load campaigns:', result);
        setCampaigns([]);
      }
    } catch (error) {
      console.error('🔍 [DEBUG] Error loading campaigns:', error);
      setCampaigns([]);
    }
  };
  
  const handleCreateCampaign = () => {};
  const handleUseTemplateForCampaign = () => {};

  const handleExecuteCampaign = async (campaignId: number) => {
    try {
      setLoading(true);
      const result = await campaignService.executeCampaignNow(campaignId);
      if (result.success) {
        toast({
          title: "Éxito",
          description: "Campaña ejecutada. Los mensajes están siendo enviados."
        });
        await loadCampaigns();
      } else {
        toast({
          title: "Error",
          description: result.message || "Error al ejecutar campaña",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Error al ejecutar campaña",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePauseCampaign = async (campaignId: number) => {
    try {
      const result = await campaignService.stopCampaign(campaignId);
      if (result.success) {
        toast({
          title: "Pausada",
          description: result.message || "Campaña detenida (pausada)"
        });
        await loadCampaigns();
      } else {
        toast({
          title: "Error",
          description: result.message || "No se pudo pausar la campaña",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Error al pausar campaña",
        variant: "destructive"
      });
    }
  };

  const handleResumeCampaign = async (campaignId: number) => {
    try {
      const result = await campaignService.activateCampaign(campaignId);
      if (result.success) {
        toast({
          title: "Reanudada",
          description: result.message || "Campaña activada"
        });
        await loadCampaigns();
      } else {
        toast({
          title: "Error",
          description: result.message || "No se pudo reanudar la campaña",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Error al reanudar campaña",
        variant: "destructive"
      });
    }
  };

  const handleCancelCampaign = async (campaignId: number) => {
    try {
      const result = await campaignService.cancelCampaign(campaignId);
      if (result.success) {
        toast({
          title: "Cancelada",
          description: result.message || "Campaña cancelada correctamente"
        });
        await loadCampaigns();
      } else {
        toast({
          title: "Error",
          description: result.message || "No se pudo cancelar la campaña",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Error al cancelar campaña",
        variant: "destructive"
      });
    }
  };

  // Funciones de campaña
  const handleViewCampaignDetails = (campaign: any) => {
    setSelectedCampaign(campaign);
    setIsCampaignDetailOpen(true);
  };

  const handleDeleteCampaign = (campaign: any) => {
    setCampaignToDelete(campaign);
    setIsDeleteCampaignModalOpen(true);
  };

  const confirmDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    
    try {
      setLoading(true);
      const result = await campaignService.deleteCampaign(campaignToDelete.id);
      
      if (result.success) {
        toast({
          title: "Éxito",
          description: "Campaña eliminada exitosamente"
        });
        setIsDeleteCampaignModalOpen(false);
        setCampaignToDelete(null);
        await loadCampaigns();
        await loadCampaignStats();
      } else {
        toast({
          title: "Error",
          description: result.message || "Error al eliminar la campaña",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al eliminar la campaña",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getCampaignStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'draft': 'BORRADOR',
      'scheduled': 'PROGRAMADA',
      'running': 'EN EJECUCIÓN',
      'active': 'ACTIVA',
      'sending': 'ENVIANDO',
      'paused': 'PAUSADA',
      'completed': 'FINALIZADA',
      'cancelled': 'CANCELADA',
      'failed': 'FALLIDA'
    };
    return statusMap[status] || status.toUpperCase();
  };

  // Tipo de campaña (label en español)
  const getCampaignTypeText = (type?: string) => {
    switch (type) {
      case 'immediate': return 'Inmediata';
      case 'scheduled': return 'Programada';
      case 'policy_reminder': return 'Recordatorio de Póliza';
      case 'expired_policy': return 'Póliza Vencida';
      case 'about_to_expire': return 'Por Vencer';
      default: return type ? String(type) : 'Inmediata';
    }
  };

  const handleResendCampaign = async (campaignId: number) => {
    try {
      setLoading(true);
      // Implementar lógica de reenvío
      toast({
        title: "Reenviando",
        description: "Reenviando campaña..."
      });
      
      // Aquí iría la llamada al servicio para reenviar
      // const result = await campaignService.resendCampaign(campaignId);
      
      await loadCampaigns();
      await loadCampaignStats();
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al reenviar la campaña",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // ========== FUNCIONES ESPECÍFICAS DE INSTANCIAS (migradas de WhatsappInstancesSimple) ==========
  
  // Función para crear nueva instancia usando el servicio Laravel
  const handleCreateInstance = async () => {
    if (!newInstance.phone_number.trim()) {
      toast({
        title: "Error",
        description: "El número de teléfono es requerido",
        variant: "destructive"
      });
      return;
    }
  
    setCreating(true);
    try {
      console.log('🔄 Creando nueva instancia con datos:', newInstance);
      
      // ✅ CORRECCIÓN: No necesitamos broker_id manual - Laravel lo obtiene del Firebase token
      const instanceData: CreateInstanceRequest = {
        phone_number: newInstance.phone_number.trim(),
        webhook_url: newInstance.webhook_url.trim() || undefined,
        settings: newInstance.settings || {}
        // broker_id se obtiene automáticamente en el backend desde Firebase token
      };
  
      console.log('📤 Enviando datos a Laravel:', instanceData);
      
      const result = await whatsappInstanceService.createInstance(instanceData);
      
      console.log('📥 Respuesta de Laravel:', result);
      
     if (result.success && result.data) {
       toast({
         title: "¡Éxito!",
         description: `Instancia creada exitosamente: ${result.data.phone_number}`
       });
        
        // Resetear formulario
        setNewInstance({
          phone_number: '',
          webhook_url: '',
          settings: {}
        });
        
        // Cerrar modal
        setIsCreateModalOpen(false);
        
        // Recargar lista de instancias para mostrar la nueva
        await loadInstances();
        await loadInstanceStats();
        
      } else {
        toast({
          title: "Error",
          description: result.message || 'Error al crear la instancia',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Error creating instance:', error);
      toast({
        title: "Error de conexión",
        description: 'No se pudo conectar con el servidor para crear la instancia',
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };
  
  // Función para cargar instancias reales desde Laravel
  const loadInstances = async () => {
    setLoading(true);
    try {
      console.log('🔄 Cargando instancias desde Laravel...');
      
      // Obtener instancias reales del servicio Laravel
      const response = await whatsappInstanceService.getInstances();
      console.log('📊 Respuesta del servicio Laravel:', response);
      
      if (response.success && response.data) {
        console.log('📊 Instancias recibidas desde Laravel:', response.data);
        
        // Mapear las instancias de Laravel al formato esperado
        const mappedInstances = response.data.map(instance => ({
          id: instance.id,
          instance_id: instance.instance_id,
          phone_number: instance.phone_number,
          status: instance.status || 'disconnected', 
          is_active: instance.is_active,
          session_id: instance.session_id || 'N/A',
          last_activity_at: instance.last_activity_at || instance.updated_at,
          reconnect_attempts: instance.reconnect_attempts || 0,
          webhook_url: instance.webhook_url,
          settings: instance.settings
        }));
        
        console.log('📊 Instancias mapeadas:', mappedInstances);
        setInstances(mappedInstances);
        
        toast({
          title: "Éxito",
          description: `${mappedInstances.length} instancia(s) cargada(s)`,
        });
      } else {
        console.error('❌ Response no exitosa desde Laravel:', response);
        
        // Si no hay instancias en Laravel, mostrar array vacío
        setInstances([]);
        
        if (response.message && !response.message.includes('No instances found')) {
          toast({
            title: "Error",
            description: response.message || 'Error al cargar instancias',
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('❌ Error loading instances:', error);
      setInstances([]);
      toast({
        title: "Error",
        description: 'Error de conexión al cargar instancias',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Función para cargar estadísticas de instancias basadas en datos reales
  const loadInstanceStats = async () => {
    try {
      console.log('🔄 Cargando estadísticas de instancias desde Laravel...');
      
      // Obtener instancias reales del servicio Laravel
      const response = await whatsappInstanceService.getInstances();
      
      if (response.success && response.data) {
        const instances = response.data;
        
        // Calcular estadísticas basadas en las instancias reales
        const totalInstances = instances.length;
        const connectedInstances = instances.filter(instance => instance.status === 'connected').length;
        const connectingInstances = instances.filter(instance => instance.status === 'connecting' || instance.status === 'qr_pending').length;
        const disconnectedInstances = instances.filter(instance => instance.status === 'disconnected').length;
        const errorInstances = instances.filter(instance => instance.status === 'error').length;
        
        const stats = {
          total_instances: totalInstances,
          connected_instances: connectedInstances,
          connecting_instances: connectingInstances,
          disconnected_instances: disconnectedInstances,
          error_instances: errorInstances,
        };
        
        console.log('📊 Estadísticas calculadas desde Laravel:', stats);
        setInstanceStats(stats);
      } else {
        console.log('⚠️ No hay instancias en Laravel, usando estadísticas vacías');
        
        // Si no hay instancias, mostrar estadísticas en cero
        setInstanceStats({
          total_instances: 0,
          connected_instances: 0,
          connecting_instances: 0,
          disconnected_instances: 0,
          error_instances: 0,
        });
      }
    } catch (error) {
      console.error('❌ Error loading instance stats:', error);
      
      // En caso de error, usar estadísticas vacías
      setInstanceStats({
        total_instances: 0,
        connected_instances: 0,
        connecting_instances: 0,
        disconnected_instances: 0,
        error_instances: 0,
      });
    }
  };

  // Función para mostrar QR de una instancia específica
  const handleShowQR = async (instance: any) => {
    if (!instance.id) return;

    // Forzar header detrás de la modal antes de abrir
    const header = document.querySelector('header');
    if (header) {
      header.style.zIndex = '0';
    }

    console.log('🔲 Obteniendo QR para instancia:', instance.id, instance.phone_number);

    setSelectedInstance(instance);
    setQrCode('');
    setIsQRModalOpen(true);

    try {
      // Usar el servicio específico de instancias de Laravel (NO el microservicio directo)
      const response = await whatsappInstanceService.getQRCode(instance.id);
      console.log('🔲 Respuesta QR de Laravel:', response);

      if (response.success && response.qr) {
        setQrCode(response.qr);
        setQrExpiry(response.expires_at || '');

        toast({
          title: "QR Generado",
          description: `QR código disponible para ${instance.phone_number}`,
        });
      } else if (!response.success && response.message) {
        // Caso específico: instancia ya conectada u otro error del microservicio
        console.log('ℹ️ Instancia no puede generar QR:', response.message);

        // Cerrar el modal de QR ya que no se puede mostrar
        setIsQRModalOpen(false);

        toast({
          title: "Información",
          description: response.message,
          variant: "default" // Usar variante default en lugar de destructive para mensajes informativos
        });

        // Actualizar el estado de la instancia por si cambió
        await handleRefreshStatus(instance.id);
      } else {
        console.error('❌ Error obteniendo QR:', response);
        toast({
          title: "Error",
          description: response.message || 'Error al obtener código QR de la instancia',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Error getting QR:', error);
      toast({
        title: "Error de Conexión",
        description: 'No se pudo conectar para obtener el código QR',
        variant: "destructive"
      });
    }

    // Iniciar polling para detectar cuando se conecte
    if (!qrPollingInterval && instance.id) {
      startQRPolling(instance.id);
    }
  };

  // Función para iniciar el polling de estado mientras el QR está abierto
  const startQRPolling = (instanceId: number) => {
    console.log('🔄 Iniciando polling para detectar conexión de instancia:', instanceId);
    
    const interval = setInterval(async () => {
      if (!isQRModalOpen || !selectedInstance) {
        console.log('🛑 Modal cerrado, deteniendo polling');
        stopQRPolling();
        return;
      }

      try {
        console.log('🔍 Verificando estado de instancia para auto-cerrar modal...');
        
        // Verificar estado de la instancia
        const response = await whatsappInstanceService.getStatus(instanceId);
        
        if (response.success && response.status === 'connected') {
          console.log('🎉 ¡Instancia conectada! Cerrando modal automáticamente');
          
          // Cerrar modal
          setIsQRModalOpen(false);
          stopQRPolling();
          
          // Actualizar estado local
          setInstances(prev => prev.map(instance => 
            instance.id === instanceId 
              ? { ...instance, status: 'connected' }
              : instance
          ));
          
          // Mostrar mensaje de éxito
          toast({
            title: "🎉 ¡Conectado Exitosamente!",
            description: "WhatsApp se ha conectado correctamente. El modal se cerró automáticamente.",
            variant: "default"
          });
          
          // Recargar instancias para obtener datos actualizados
          await loadInstances();
        } else if (response.success && (response.status === 'authenticated' || response.status === 'ready')) {
          // Algunos microservicios usan diferentes estados para "conectado"
          console.log('🎉 ¡Instancia autenticada! Cerrando modal automáticamente');
          
          setIsQRModalOpen(false);
          stopQRPolling();
          
          setInstances(prev => prev.map(instance => 
            instance.id === instanceId 
              ? { ...instance, status: 'connected' }
              : instance
          ));
          
          toast({
            title: "🎉 ¡Conectado Exitosamente!",
            description: "WhatsApp se ha autenticado correctamente. El modal se cerró automáticamente.",
            variant: "default"
          });
          
          await loadInstances();
        }
      } catch (error) {
        console.warn('⚠️ Error en polling QR (continuando...):', error);
        // No mostrar error al usuario, solo continuar con el polling
      }
    }, 3000); // Verificar cada 3 segundos

    setQrPollingInterval(interval);
  };

  // Función para detener el polling
  const stopQRPolling = () => {
    if (qrPollingInterval) {
      console.log('🛑 Deteniendo polling de QR');
      clearInterval(qrPollingInterval);
      setQrPollingInterval(null);
    }
  };

  // Efecto para limpiar polling cuando se cierre el modal
  useEffect(() => {
    if (!isQRModalOpen) {
      stopQRPolling();
    }
    
    // Cleanup cuando se desmonte el componente
    return () => {
      stopQRPolling();
    };
  }, [isQRModalOpen]);

  // Cargar instancias cuando el usuario/broker cambie
  useEffect(() => {
    // Debug Firebase Auth
    if (auth.currentUser) {
      console.log('✅ [CONFIGURACION] Firebase user autenticado:', {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        emailVerified: auth.currentUser.emailVerified
      });

      // Evitar doble carga durante la inicialización (ya la hace loadInitialData)
      if (!initialLoadedRef.current) {
        console.log('⏭️ [CONFIGURACION] Evitando carga duplicada de instancias (inicial en progreso)');
        return;
      }

      console.log('🚀 [CONFIGURACION] Cargando instancias por cambio de usuario...');
      loadInstances();
    } else {
      console.warn('❌ [CONFIGURACION] No hay Firebase user autenticado');
    }
  }, [user]); // Solo depender de user (Firebase), no userData

  // Función para actualizar estado de una instancia específica
  // Función para reconectar instancia
  const handleReconnectInstance = async (instanceId: number) => {
    if (!instanceId) return;

    // Buscar la instancia para obtener su instance_id real
    const instance = instances.find(inst => inst.id === instanceId);
    if (!instance?.instance_id) {
      toast({
        title: "Error",
        description: "No se pudo encontrar la instancia",
        variant: "destructive"
      });
      return;
    }

    try {
      setRefreshingInstances(prev => [...prev, instanceId]);

      toast({
        title: "Reconectando...",
        description: "Iniciando reconexión de la instancia de WhatsApp"
      });

      // Llamar al endpoint de restart en el microservicio usando el instance_id correcto
      const response = await fetch(`http://localhost:3000/api/v1/instances/${instance.instance_id}/restart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Éxito",
          description: "Instancia reconectándose. Actualiza el estado en unos segundos.",
        });

        // Actualizar estado después de un momento
        setTimeout(() => {
          handleRefreshStatus(instanceId);
        }, 3000);
      } else {
        toast({
          title: "Error",
          description: result.message || "Error al reconectar la instancia",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Error reconnecting instance:', error);
      toast({
        title: "Error",
        description: "Error de conexión al intentar reconectar",
        variant: "destructive"
      });
    } finally {
      setRefreshingInstances(prev => prev.filter(id => id !== instanceId));
    }
  };

  // Función para desconectar instancia
  const handleDisconnectInstance = async (instanceId: number) => {
    if (!instanceId) return;

    // Buscar la instancia para obtener su instance_id real
    const instance = instances.find(inst => inst.id === instanceId);
    if (!instance?.instance_id) {
      toast({
        title: "Error",
        description: "No se pudo encontrar la instancia",
        variant: "destructive"
      });
      return;
    }

    const confirmDisconnect = window.confirm(
      "¿Estás seguro de que quieres desconectar esta instancia de WhatsApp?\n\n" +
      "La instancia dejará de recibir y enviar mensajes hasta que la reconectes."
    );

    if (!confirmDisconnect) return;

    try {
      setRefreshingInstances(prev => [...prev, instanceId]);

      toast({
        title: "Desconectando...",
        description: "Desconectando la instancia de WhatsApp"
      });

      // Llamar al endpoint de disconnect en el microservicio usando el instance_id correcto
      const response = await fetch(`http://localhost:3000/api/v1/instances/${instance.instance_id}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Desconectada",
          description: "La instancia ha sido desconectada exitosamente",
        });

        // Actualizar estado
        await handleRefreshStatus(instanceId);
      } else {
        toast({
          title: "Error",
          description: result.message || "Error al desconectar la instancia",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Error disconnecting instance:', error);
      toast({
        title: "Error",
        description: "Error de conexión al intentar desconectar",
        variant: "destructive"
      });
    } finally {
      setRefreshingInstances(prev => prev.filter(id => id !== instanceId));
    }
  };

  // Función para eliminar instancia
  const handleDeleteInstance = async (instanceId: number) => {
    if (!instanceId) return;

    // Buscar la instancia para obtener su instance_id real
    const instance = instances.find(inst => inst.id === instanceId);
    if (!instance?.instance_id) {
      toast({
        title: "Error",
        description: "No se pudo encontrar la instancia",
        variant: "destructive"
      });
      return;
    }

    const confirmDelete = window.confirm(
      "⚠️ ATENCIÓN: ¿Estás seguro de que quieres ELIMINAR esta instancia?\n\n" +
      "Esta acción:\n" +
      "• Eliminará permanentemente la instancia\n" +
      "• Borrará todos los datos asociados\n" +
      "• NO se puede deshacer\n\n" +
      "¿Continuar con la eliminación?"
    );

    if (!confirmDelete) return;

    try {
      setRefreshingInstances(prev => [...prev, instanceId]);

      toast({
        title: "Eliminando...",
        description: "Eliminando la instancia de WhatsApp de forma permanente"
      });

      // Primero eliminar del microservicio usando el instance_id correcto
      try {
        await fetch(`http://localhost:3000/api/v1/instances/${instance.instance_id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        console.warn('Error eliminando del microservicio (puede no existir):', e);
      }

      // Luego eliminar de Laravel
      const deleteResult = await whatsappInstanceService.deleteInstance(instanceId);

      if (deleteResult.success) {
        toast({
          title: "Eliminada",
          description: "La instancia ha sido eliminada exitosamente",
        });

        // Recargar lista de instancias
        await loadInstances();
      } else {
        toast({
          title: "Error",
          description: deleteResult.message || "Error al eliminar la instancia",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Error deleting instance:', error);
      toast({
        title: "Error",
        description: "Error de conexión al intentar eliminar",
        variant: "destructive"
      });
    } finally {
      setRefreshingInstances(prev => prev.filter(id => id !== instanceId));
    }
  };

  const handleRefreshStatus = async (instanceId: number) => {
    setRefreshingInstances(prev => [...prev, instanceId]);
    
    try {
      console.log('🔄 Actualizando estado para instancia:', instanceId);
      
      // Usar el servicio específico de instancias de Laravel (NO el microservicio directo)
      const response = await whatsappInstanceService.getStatus(instanceId);
      console.log('📊 Respuesta estado de Laravel:', response);
      
      if (response.success && response.status) {
        // Actualizar estado de la instancia específica
        setInstances(prev => prev.map(instance => 
          instance.id === instanceId 
            ? { ...instance, status: response.status }
            : instance
        ));
        
        // Recargar estadísticas para reflejar cambios
        await loadInstanceStats();
        
        toast({
          title: "Estado Actualizado",
          description: `Estado de la instancia: ${response.status}`,
        });
      } else {
        console.error('❌ Error obteniendo estado:', response);
        
        // Si es un error de instancia desconectada, manejar graciosamente
        if (response.message && (response.message.includes('disconnected') || response.message.includes('Failed to get status'))) {
          // Marcar la instancia como desconectada localmente
          setInstances(prev => prev.map(instance => 
            instance.id === instanceId 
              ? { ...instance, status: 'disconnected' }
              : instance
          ));
          
          toast({
            title: "Instancia Desconectada",
            description: "La instancia de WhatsApp está desconectada del microservicio",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Error",
            description: response.message || 'Error al obtener estado de la instancia',
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('❌ Error refreshing status:', error);
      toast({
        title: "Error de Conexión",
        description: 'No se pudo conectar para obtener el estado',
        variant: "destructive"
      });
    } finally {
      setRefreshingInstances(prev => prev.filter(id => id !== instanceId));
    }
  };

  // Funciones auxiliares para las instancias
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'connected': { text: 'Conectado', color: 'bg-green-100 text-green-800' },
      'connecting': { text: 'Conectando', color: 'bg-blue-100 text-blue-800' },
      'disconnected': { text: 'Desconectado', color: 'bg-gray-100 text-gray-800' },
      'error': { text: 'Error', color: 'bg-red-100 text-red-800' },
      'qr_pending': { text: 'QR Pendiente', color: 'bg-yellow-100 text-yellow-800' }
    };
    const config = statusConfig[status as keyof typeof statusConfig] || { text: status, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  const formatLastActivity = (date?: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  const getCampaignStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'text-gray-600';
      case 'running': return 'text-blue-600';
      case 'completed': return 'text-green-600';
      case 'paused': return 'text-yellow-600';
      case 'cancelled': return 'text-red-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getCampaignStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'running': return 'default';
      case 'completed': return 'default';
      case 'paused': return 'secondary';
      case 'cancelled': return 'destructive';
      case 'failed': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-600';
      case 'stopped': return 'text-red-600';
      case 'initializing': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIconifyIcon = (status: string) => {
    switch (status) {
      case 'running': return 'solar:check-circle-bold';
      case 'stopped': return 'solar:close-circle-bold';
      case 'initializing': return 'solar:clock-circle-bold';
      default: return 'solar:question-circle-bold';
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  // Funciones auxiliares para la tabla de historial
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMessageStatusBadge = (status: string) => {
    switch (status) {
      case 'sent': return { 
        variant: 'default' as const, 
        text: 'Enviado', 
        className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' 
      };
      case 'delivered': return { 
        variant: 'default' as const, 
        text: 'Entregado', 
        className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' 
      };
      case 'read': return { 
        variant: 'default' as const, 
        text: 'Leído', 
        className: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800' 
      };
      case 'failed': return { 
        variant: 'destructive' as const, 
        text: 'Fallido', 
        className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' 
      };
      case 'pending': return { 
        variant: 'secondary' as const, 
        text: 'Pendiente', 
        className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800' 
      };
      default: return { 
        variant: 'secondary' as const, 
        text: 'Desconocido', 
        className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800' 
      };
    }
  };

  const truncateMessage = (message: string, maxLength = 50) => {
    if (!message) return 'N/A';
    return message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
  };

  // ===== Scroll Stats Widgets (estilo Voice AI) =====
  interface StatWidgetProps {
    title: string;
    value: string;
    subtitle: string;
    icon: string;
    iconColor: string;
    bgColor: string;
    chartColor: string;
    trend: string;
    trendColor: string;
    chartData: number[];
    chartType: 'area' | 'bar';
  }

  const StatWidget: React.FC<StatWidgetProps> = ({
    title, value, subtitle, icon, iconColor, bgColor, chartColor, trend, trendColor, chartData, chartType
  }) => {
    const ChartOptions: any = {
      series: [{ name: "", data: chartData }],
      chart: {
        type: chartType,
        fontFamily: 'inherit',
        foreColor: '#adb0bb',
        toolbar: { show: false },
        sparkline: { enabled: true },
        group: 'sparklines',
      },
      colors: [chartColor],
      stroke: { curve: 'smooth', width: 2 },
      fill: chartType === 'area'
        ? { type: 'gradient', gradient: { shadeIntensity: 0, inverseColors: false, opacityFrom: 0.2, opacityTo: 0.8, stops: [100] } }
        : { opacity: 0.8 },
      plotOptions: chartType === 'bar'
        ? { bar: { borderRadius: 4, columnWidth: '50%', distributed: true, endingShape: 'rounded' } }
        : {},
      dataLabels: { enabled: false },
      legend: { show: false },
      grid: { show: false, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
      xaxis: { labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { show: false } },
      tooltip: { theme: 'dark', y: { formatter: (val: number) => val.toString() } },
    };

    return (
      <CardBox className="p-0 overflow-hidden">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className={`w-8 h-8 ${bgColor} rounded-lg flex items-center justify-center`}>
              <IconifyIcon icon={icon} className={`w-4 h-4 ${iconColor}`} />
            </div>
            <span className={`text-xs font-medium ${trendColor}`}>{trend}</span>
          </div>
          <div className="mb-2">
            <h5 className="text-base font-bold text-gray-900 dark:text-white mb-1 leading-tight">
              {value}
            </h5>
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-tight">{subtitle}</p>
          </div>
        </div>
        <div className="px-3 pb-2">
          <Chart options={ChartOptions} series={ChartOptions.series} type={chartType} height="50px" width="100%" />
        </div>
      </CardBox>
    );
  };

  const formatCOP = (val: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2 }).format(Math.max(0, val || 0));

  const generateChartData = (baseValue: number, type: 'increasing' | 'decreasing' | 'stable') => {
    const data: number[] = [];
    for (let i = 0; i < 8; i++) {
      let value = baseValue;
      if (type === 'increasing') value = baseValue + (i * 2) + Math.random() * 5;
      else if (type === 'decreasing') value = baseValue - (i * 1) + Math.random() * 3;
      else value = baseValue + (Math.random() - 0.5) * 10;
      data.push(Math.max(0, Math.round(value)));
    }
    return data;
  };

  const calculateTrend = (currentValue: number, isCost = false): { trend: string; color: string } => {
    if (!currentValue || currentValue === 0) return { trend: '+0.0%', color: 'text-gray-500' };
    const variation = (Math.random() - 0.5) * 20; // ±10%
    const formatted = `${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%`;
    return { trend: formatted, color: isCost ? (variation <= 0 ? 'text-green-600' : 'text-red-600') : (variation >= 0 ? 'text-green-600' : 'text-red-600') };
  };

  // Datos derivados para widgets (usar historyStats y campaignStats)
  const totalMsgs = Number(historyStats.total_messages || campaignStats?.total_messages_sent || 0);
  const deliveredMsgs = Number(historyStats.delivered_count || campaignStats?.delivered_today || 0);
  const pendingMsgs = Number(historyStats.pending_count || campaignStats?.pending_messages || 0);
  const failedMsgs = Number(historyStats.failed_count || 0);
  const pendingFailedMsgs = pendingMsgs + failedMsgs;
  const successRate = totalMsgs > 0 ? Math.round((deliveredMsgs / totalMsgs) * 100) : Number(campaignStats?.delivery_rate_today || 0);

  // Métricas de campañas
  const deliveryRateToday = Number(campaignStats?.delivery_rate_today || 0);
  const deliveredToday = Number(campaignStats?.delivered_today || 0);
  const messagesToday = Number(campaignStats?.messages_today || 0);
  const messagesYesterday = Number(campaignStats?.messages_yesterday || 0);
  const activeCampaigns = campaigns.filter(c => c.status === 'running' || c.status === 'active').length;
  const totalCampaigns = campaigns.length;
  const completedCampaigns = campaigns.filter(c => c.status === 'completed').length;
  const pendingMessages = Number(campaignStats?.pending_messages || pendingMsgs);
  const completedCampaignsMonth = Number(campaignStats?.completed_campaigns || completedCampaigns);
  
  // Instancias
  const connectedInstances = instanceStats.connected_instances;
  const totalInstances = instanceStats.total_instances;

  // Costos
  const totalCostCOP = totalCostCOPState;

  // Calcular tendencias
  const deliveryTrend = calculateTrend(deliveryRateToday, false);
  const messagesTodayDiff = messagesToday - messagesYesterday;
  const messagesTodayPct = messagesYesterday > 0 ? ((messagesTodayDiff / messagesYesterday) * 100) : (messagesToday > 0 ? 100 : 0);
  const messagesTodayTrend = {
    trend: `${messagesTodayPct >= 0 ? '+' : ''}${messagesTodayPct.toFixed(1)}%`,
    color: messagesTodayPct >= 0 ? 'text-green-600' : 'text-red-600'
  };
  const campaignsTrend = calculateTrend(activeCampaigns, false);
  const instancesTrend = { trend: connectedInstances === totalInstances ? '+0.0%' : '-10.0%', color: connectedInstances === totalInstances ? 'text-green-600' : 'text-red-600' };
  const pendingTrend = calculateTrend(pendingMessages, true);
  const completedTrend = calculateTrend(completedCampaignsMonth, false);
  const totalCostTrend = calculateTrend(totalCostCOP, true);

  const statsWidgets = [
    {
      title: 'Tasa de Entrega',
      value: `${deliveryRateToday}%`,
      subtitle: `Entregados: ${deliveredToday} | Total: ${messagesToday}`,
      icon: 'solar:check-circle-bold-duotone',
      iconColor: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      chartColor: '#10B981',
      trend: deliveryTrend.trend,
      trendColor: deliveryTrend.color,
      chartData: generateChartData(Math.max(deliveryRateToday, 10), deliveryRateToday > 50 ? 'increasing' : 'stable'),
      chartType: 'area' as const
    },
    {
      title: 'Mensajes Hoy',
      value: messagesToday.toString(),
      subtitle: `Ayer: ${messagesYesterday} | Diferencia: ${messagesTodayDiff >= 0 ? '+' : ''}${messagesTodayDiff}`,
      icon: 'solar:chat-round-bold-duotone',
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      chartColor: '#3B82F6',
      trend: messagesTodayTrend.trend,
      trendColor: messagesTodayTrend.color,
      chartData: generateChartData(Math.max(messagesToday || 1, 5), messagesToday > messagesYesterday ? 'increasing' : 'decreasing'),
      chartType: 'area' as const
    },
    {
      title: 'Campañas Activas',
      value: activeCampaigns.toString(),
      subtitle: `Total: ${totalCampaigns} | Completadas: ${completedCampaigns}`,
      icon: 'solar:play-circle-bold-duotone',
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      chartColor: '#8B5CF6',
      trend: campaignsTrend.trend,
      trendColor: campaignsTrend.color,
      chartData: generateChartData(Math.max(activeCampaigns || 1, 5), 'stable'),
      chartType: 'bar' as const
    },
    {
      title: 'Instancias',
      value: `${connectedInstances}/${totalInstances}`,
      subtitle: connectedInstances === totalInstances ? 'Todas operativas' : `${totalInstances - connectedInstances} desconectadas`,
      icon: 'solar:smartphone-bold-duotone',
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      chartColor: '#3B82F6',
      trend: instancesTrend.trend,
      trendColor: instancesTrend.color,
      chartData: generateChartData(Math.max(connectedInstances || 1, 1), 'stable'),
      chartType: 'area' as const
    },
    {
      title: 'Mensajes Pendientes',
      value: pendingMessages.toString(),
      subtitle: 'En cola de envío',
      icon: 'solar:clock-circle-bold-duotone',
      iconColor: 'text-yellow-600',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      chartColor: '#F59E0B',
      trend: pendingTrend.trend,
      trendColor: pendingTrend.color,
      chartData: generateChartData(Math.max(pendingMessages || 1, 5), 'stable'),
      chartType: 'bar' as const
    },
    {
      title: 'Completadas (mes)',
      value: completedCampaignsMonth.toString(),
      subtitle: `${totalCampaigns} total`,
      icon: 'solar:check-square-bold-duotone',
      iconColor: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      chartColor: '#10B981',
      trend: completedTrend.trend,
      trendColor: completedTrend.color,
      chartData: generateChartData(Math.max(completedCampaignsMonth || 1, 5), 'increasing'),
      chartType: 'area' as const
    },
    {
      title: 'Costo total',
      value: `${formatCOP(totalCostCOP)}`,
      subtitle: 'Costo total (incluye costo operativo)',
      icon: 'solar:wallet-money-bold-duotone',
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      chartColor: '#8B5CF6',
      trend: totalCostTrend.trend,
      trendColor: totalCostTrend.color,
      chartData: generateChartData(100, 'increasing'),
      chartType: 'area' as const
    },
  ];

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
         
        </div>

        {/* Main Tabs Navigation */}
        <div className="grid grid-cols-12 gap-[30px]">
          <div className="col-span-12">
            <div className="p-6 bg-white dark:bg-darkgray rounded-lg">
              <Tabs aria-label="WhatsApp Control Center" variant="underline" onActiveTabChange={(tab) => setActiveTab(tab.toString())}>
              <Tabs.Item
                active
                title="Dashboard Principal"
                icon={() => <IconifyIcon icon="solar:graph-linear" height={20} />}
              >
                <div className="mt-6 space-y-6">
                  {/* Stats scroll row - estilo Voice AI */}
                  <div className="-mx-6 px-6">
                    <div className="overflow-x-auto pb-2">
                      <div className="flex gap-4 min-w-max">
                        {statsWidgets.map((w, idx) => (
                          <div key={idx} className="min-w-[240px]">
                            <StatWidget {...w} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Desliza para ver más estadísticas</div>
                  </div>

            {/* Gráfico de envíos por día (ApexCharts para replicar diseño Voice AI) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconifyIcon icon="solar:chart-2-bold" className="h-5 w-5 text-blue-600" />
                  Evolución de envíos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : chartCategories.length > 0 ? (
                  
                  <>
                  <div className="-mx-2">
                    <Chart
                      options={{
                        chart: {
                          id: 'wa-messages-area',
                          fontFamily: 'inherit',
                          foreColor: '#adb0bb',
                          zoom: { enabled: true },
                          toolbar: { show: false },
                          height: 350,
                          type: 'area'
                        },
                        dataLabels: { enabled: false },
                        fill: {
                          type: 'gradient',
                          gradient: {
                            shadeIntensity: 0,
                            inverseColors: false,
                            opacityFrom: 0.2,
                            opacity: 0.1,
                            stops: [100]
                          }
                        },
                        stroke: { width: 3, curve: 'smooth' },
                        colors: ['var(--color-primary)', 'var(--color-secondary)'],
                        xaxis: {
                          type: 'category',
                          categories: chartCategories,
                          axisBorder: { color: 'rgba(173,181,189,0.3)' },
                          labels: {
                            style: { fontSize: '12px' },
                            formatter: (val: any) => {
                              const s = typeof val === 'string' ? val : (val != null ? String(val) : '');
                              if (!s || s.indexOf('-') === -1) return s || '';
                              const parts = s.split('-');
                              if (parts.length < 3) return s;
                              const [y, m, d] = parts;
                              return `${d}/${m}`;
                            }
                          }
                        },
                        yaxis: {
                          opposite: false,
                          labels: {
                            show: true,
                            formatter: (val: number) => Math.round(val).toString()
                          },
                          title: {
                            text: 'Número de mensajes',
                            style: { fontSize: '12px', fontWeight: 500 }
                          }
                        },
                        legend: { show: true, position: 'bottom', width: '50px' },
                        grid: { show: false },
                        tooltip: {
                          theme: 'dark',
                          fillSeriesColor: false,
                          y: { formatter: (val: number) => `${val} mensajes` },
                          x: { formatter: (val: any) => (val != null ? String(val) : '') }
                        }
                      } as any}
                      series={[
                        { name: 'Enviados', data: chartSeries[0]?.data || [] },
                        { name: 'Entregados', data: chartSeries[1]?.data || [] }
                      ] as any}
                      type="area"
                      height="350px"
                      width="100%"
                    />
                  </div>
                  {(() => {
                    const sentTotal = (chartSeries[0]?.data || []).reduce((a: number, b: number) => a + (Number(b) || 0), 0);
                    const deliveredTotal = (chartSeries[1]?.data || []).reduce((a: number, b: number) => a + (Number(b) || 0), 0);
                    return (
                      <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
                          <span className="font-semibold text-gray-900 dark:text-white">{sentTotal}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Exitosos</span>
                          <span className="font-semibold text-gray-900 dark:text-white">{deliveredTotal}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Duración promedio</span>
                          <span className="font-semibold text-gray-900 dark:text-white">0:00</span>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          <span className="text-xs text-green-600 dark:text-green-400">Datos en tiempo real</span>
                        </div>
                      </div>
                    );
                  })()}
                  </>
                ) : (
                  <p className="text-center text-gray-500 dark:text-gray-400">Sin datos para el rango seleccionado.</p>
                )}
              </CardContent>
            </Card>


            {/* Historial de Envíos - estilo CallHistory */}
            <div className="bg-white dark:bg-darkgray shadow-md dark:shadow-none rounded-[10px]">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <IconifyIcon icon="solar:magnifer-bold-duotone" className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar por teléfono, mensaje..."
                        value={searchTerm}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-10 h-10 text-sm rounded-[10px] w-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <select className="h-10 text-sm rounded-[10px] border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3">
                      <option value="all">Todos los estados</option>
                      <option value="sent">Enviados</option>
                      <option value="delivered">Entregados</option>
                      <option value="read">Leídos</option>
                      <option value="failed">Fallidos</option>
                      <option value="pending">Pendientes</option>
                    </select>

                    <Button
                      onClick={() => loadMessageHistory()}
                      disabled={historyLoading}
                      className="h-10 px-4 bg-blue-600 hover:bg-blue-700 rounded-[10px]"
                    >
                      <IconifyIcon icon="solar:magnifer-bold-duotone" className="w-4 h-4 mr-2" />
                      Buscar
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <IconifyIcon icon="solar:chat-round-bold-duotone" className="w-4 h-4" />
                    <span>
                      Mostrando {((currentPage - 1) * messagesPerPage) + 1} a {Math.min(currentPage * messagesPerPage, totalMessages)} de {totalMessages} resultados
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla de mensajes - estilo CallHistory */}
            <Card className="overflow-visible">
              <div className="table-container-with-dropdowns overflow-x-auto">
                {historyLoading ? (
                  <div className="flex flex-col items-center justify-center h-64 space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-gray-600">Cargando historial...</p>
                  </div>
                ) : messageHistory.length === 0 ? (
                  <CardContent className="p-12 text-center">
                    <IconifyIcon icon="solar:chat-round-outline" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Sin mensajes registrados</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      No hay mensajes en el sistema. Los envíos aparecerán aquí cuando se ejecuten campañas.
                    </p>
                    <Button onClick={() => loadMessageHistory()} className="bg-blue-600 hover:bg-blue-700">
                      <IconifyIcon icon="solar:refresh-bold-duotone" className="w-4 h-4 mr-2" />
                      Actualizar
                    </Button>
                  </CardContent>
                ) : (
                  <Table hoverable className="shadow-md dark:shadow-none bg-white dark:bg-darkgray rounded-[10px]">
                    <Table.Head>
                      <Table.HeadCell>Destinatario</Table.HeadCell>
                      <Table.HeadCell>Campaña</Table.HeadCell>
                      <Table.HeadCell>Estado</Table.HeadCell>
                      <Table.HeadCell>Fecha</Table.HeadCell>
                      <Table.HeadCell className="text-right">Acciones</Table.HeadCell>
                    </Table.Head>
                    <Table.Body>
                      {messageHistory.map((message) => {
                        const { variant, text, className } = getMessageStatusBadge(message.status);
                        return (
                          <Table.Row key={message.id}>
                            <Table.Cell>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                                  <IconifyIcon icon="solar:user-bold-duotone" className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-white">{message.recipient_name || 'Sin nombre'}</div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">{message.recipient_phone}</div>
                                </div>
                              </div>
                            </Table.Cell>
                            <Table.Cell className="text-sm text-gray-600 dark:text-gray-400">
                              {message.campaign_name || '-'}
                            </Table.Cell>
                            <Table.Cell>
                              <Badge variant={variant} className={className}>{text}</Badge>
                            </Table.Cell>
                            <Table.Cell className="text-sm text-gray-600 dark:text-gray-400">
                              {formatDate(message.created_at || message.sent_at)}
                            </Table.Cell>
                            <Table.Cell className="whitespace-nowrap text-right">
                              <div className="relative inline-block">
                                <Dropdown
                                  label=""
                                  dismissOnClick={false}
                                  inline
                                  renderTrigger={() => (
                                    <span className="h-9 w-9 flex justify-center items-center rounded-full hover:bg-lightprimary hover:text-primary cursor-pointer">
                                      <IconifyIcon icon="solar:menu-dots-bold" className="w-5 h-5" />
                                    </span>
                                  )}
                                >
                                  <Dropdown.Item
                                    className="flex gap-3 w-full justify-start text-left whitespace-nowrap"
                                    onClick={() => {
                                      setSelectedMessage(message);
                                      setIsMessageDetailOpen(true);
                                    }}
                                  >
                                    <IconifyIcon icon="solar:eye-bold-duotone" height={18} />
                                    <span>Ver Detalles</span>
                                  </Dropdown.Item>
                                </Dropdown>
                              </div>
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table>
                )}
              </div>

              {/* Paginación inferior - estilo CallHistory */}
              {!historyLoading && messageHistory.length > 0 && totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4">
                  <div className="text-sm text-gray-500">
                    Mostrando {((currentPage - 1) * messagesPerPage) + 1} a {Math.min(currentPage * messagesPerPage, totalMessages)} de {totalMessages} resultados
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="rounded-[10px]"
                      variant="outline"
                    >
                      Anterior
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Página {currentPage}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="rounded-[10px]"
                      variant="outline"
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </Tabs.Item>

        <Tabs.Item
          title="Conexión WhatsApp"
          icon={() => <IconifyIcon icon="solar:whatsapp-bold" height={20} />}
        >
          <div className="mt-6 space-y-6 overflow-visible">
            {/* Header con búsqueda y acciones - estilo Voice AI */}
            <div className="bg-white dark:bg-darkgray shadow-md dark:shadow-none rounded-[10px]">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <IconifyIcon icon="solar:magnifer-bold-duotone" className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar por número, ID de instancia..."
                        className="pl-10 h-10 text-sm rounded-[10px] w-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="h-10 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-[10px] shadow-lg"
                    >
                      <IconifyIcon icon="solar:add-circle-bold" className="w-4 h-4 mr-2" />
                      Nueva Instancia
                    </Button>
                    
                    <Button
                      onClick={loadInstances}
                      disabled={loading}
                      className="h-10 px-4 bg-blue-600 hover:bg-blue-700 rounded-[10px]"
                    >
                      <IconifyIcon icon="solar:refresh-bold-duotone" className="w-4 h-4 mr-2" />
                      Actualizar
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <IconifyIcon icon="solar:smartphone-bold-duotone" className="w-4 h-4" />
                    <span>
                      {instances.length} instancia{instances.length !== 1 ? 's' : ''} total{instances.length !== 1 ? 'es' : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Estadísticas de instancias - estilo Voice AI */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Instancias</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{instanceStats.total_instances}</p>
                    </div>
                    <IconifyIcon icon="solar:smartphone-bold-duotone" className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Conectadas</p>
                      <p className="text-2xl font-bold text-green-600">{instanceStats.connected_instances}</p>
                    </div>
                    <IconifyIcon icon="solar:check-circle-bold-duotone" className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Desconectadas</p>
                      <p className="text-2xl font-bold text-gray-600">{instanceStats.disconnected_instances}</p>
                    </div>
                    <IconifyIcon icon="solar:close-circle-bold-duotone" className="w-8 h-8 text-gray-600" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Con Error</p>
                      <p className="text-2xl font-bold text-red-600">{instanceStats.error_instances}</p>
                    </div>
                    <IconifyIcon icon="solar:danger-triangle-bold-duotone" className="w-8 h-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabla de instancias - estilo Voice AI */}
            {loading ? (
              <Card>
                <CardContent className="flex items-center justify-center h-96">
                  <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-gray-600">Cargando instancias...</p>
                  </div>
                </CardContent>
              </Card>
            ) : instances.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <IconifyIcon icon="solar:smartphone-outline" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No hay instancias</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Comienza creando tu primera instancia de WhatsApp
                  </p>
                  <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
                  >
                    <IconifyIcon icon="solar:add-circle-bold" className="w-4 h-4 mr-2" />
                    Crear Primera Instancia
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-visible">
                <CardContent className="p-0 overflow-visible">
                  <div className="table-container-with-dropdowns overflow-x-auto">
                    <Table hoverable className="shadow-md dark:shadow-none bg-white dark:bg-darkgray rounded-[10px]">
                      <Table.Head>
                        <Table.HeadCell>Instancia</Table.HeadCell>
                        <Table.HeadCell>Estado</Table.HeadCell>
                        <Table.HeadCell>Session ID</Table.HeadCell>
                        <Table.HeadCell>Última Actividad</Table.HeadCell>
                        <Table.HeadCell>Reintentos</Table.HeadCell>
                        <Table.HeadCell className="text-right">Acciones</Table.HeadCell>
                      </Table.Head>
                      <Table.Body>
                        {instances.map((instance) => (
                          <Table.Row key={instance.id}>
                            <Table.Cell>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                                  <IconifyIcon icon="solar:smartphone-bold-duotone" className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-white">{instance.phone_number || instance.instance_id}</div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">{instance.instance_id}</div>
                                </div>
                              </div>
                            </Table.Cell>
                            <Table.Cell>
                              {getStatusBadge(instance.status)}
                            </Table.Cell>
                            <Table.Cell className="font-mono text-xs text-gray-600 dark:text-gray-400">
                              {instance.session_id || 'N/A'}
                            </Table.Cell>
                            <Table.Cell className="text-sm text-gray-600 dark:text-gray-400">
                              {formatLastActivity(instance.last_activity_at)}
                            </Table.Cell>
                            <Table.Cell className="text-sm text-gray-900 dark:text-white">
                              {instance.reconnect_attempts}
                            </Table.Cell>
                            <Table.Cell className="whitespace-nowrap text-right">
                              <div className="relative inline-block">
                                <Dropdown
                                  label=""
                                  dismissOnClick={false}
                                  inline
                                  renderTrigger={() => (
                                    <span className="h-9 w-9 flex justify-center items-center rounded-full hover:bg-lightprimary hover:text-primary cursor-pointer">
                                      <IconifyIcon icon="solar:menu-dots-bold" className="w-5 h-5" />
                                    </span>
                                  )}
                                >
                                  {(instance.status === 'qr_pending' || instance.status === 'disconnected') && (
                                    <Dropdown.Item className="flex gap-3 w-full justify-start text-left whitespace-nowrap" onClick={() => handleShowQR(instance)}>
                                      <IconifyIcon icon="solar:qr-code-bold" height={18} />
                                      <span>Mostrar QR</span>
                                    </Dropdown.Item>
                                  )}
                                  {instance.status === 'disconnected' && (
                                    <Dropdown.Item className="flex gap-3 w-full justify-start text-left whitespace-nowrap" onClick={() => handleReconnectInstance(instance.id)}>
                                      <IconifyIcon icon="solar:refresh-bold" height={18} />
                                      <span>Reconectar</span>
                                    </Dropdown.Item>
                                  )}
                                  {(instance.status === 'connected' || instance.status === 'connecting') && (
                                    <Dropdown.Item className="flex gap-3 w-full justify-start text-left whitespace-nowrap" onClick={() => handleDisconnectInstance(instance.id)}>
                                      <IconifyIcon icon="solar:power-bold" height={18} />
                                      <span>Desconectar</span>
                                    </Dropdown.Item>
                                  )}
                                  <Dropdown.Item className="flex gap-3 w-full justify-start text-left whitespace-nowrap" onClick={() => instance.id && handleRefreshStatus(instance.id)}>
                                    <IconifyIcon icon="solar:refresh-bold" height={18} />
                                    <span>Actualizar Estado</span>
                                  </Dropdown.Item>
                                  <Dropdown.Item className="flex gap-3 w-full justify-start text-left whitespace-nowrap" onClick={() => handleDeleteInstance(instance.id)}>
                                    <IconifyIcon icon="solar:trash-bin-trash-bold" height={18} />
                                    <span>Eliminar</span>
                                  </Dropdown.Item>
                                </Dropdown>
                              </div>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </Tabs.Item>

        <Tabs.Item
          title="Gestión de Campañas"
          icon={() => <IconifyIcon icon="solar:phone-calling-rounded-outline" height={20} />}
        >
          <div className="mt-6 space-y-6">
            {/* Header con búsqueda y acciones - estilo Voice AI */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Gestión de Campañas</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Crea y gestiona campañas de mensajería masiva por WhatsApp
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => setShowCampaignManager(true)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
                >
                  <IconifyIcon icon="solar:magic-stick-3-bold" className="w-4 h-4 mr-2" />
                  Nueva Campaña
                </Button>
              </div>
            </div>

            {/* Wizard de Creación de Campaña */}
            <CreateCampaignWizard
              open={showCampaignManager}
              onClose={() => setShowCampaignManager(false)}
              onCampaignCreated={(campaign) => {
                loadCampaigns();
                loadCampaignStats();
                setShowCampaignManager(false);
                toast({
                  title: "Campaña creada",
                  description: campaign?.name
                    ? `La campaña "${campaign.name}" se ha creado exitosamente`
                    : "La campaña se ha creado exitosamente"
                });
              }}
            />

            <div className="flex gap-2">
            </div>

            {/* Filtros - estilo Voice AI */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Buscar campañas..."
                      className="w-full"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select className="h-10 text-sm rounded-[10px] border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3">
                      <option value="all">Todos los estados</option>
                      <option value="draft">Borrador</option>
                      <option value="scheduled">Programada</option>
                      <option value="running">En ejecución</option>
                      <option value="paused">Pausada</option>
                      <option value="completed">Completada</option>
                      <option value="cancelled">Cancelada</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Estadísticas generales - estilo Voice AI */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Campañas</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{campaigns.length}</p>
                    </div>
                    <IconifyIcon icon="solar:target-bold-duotone" className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Activas</p>
                      <p className="text-2xl font-bold text-green-600">
                        {campaigns.filter(c => c.status === 'running' || c.status === 'active').length}
                      </p>
                    </div>
                    <IconifyIcon icon="solar:play-circle-bold-duotone" className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Programadas</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {campaigns.filter(c => c.status === 'scheduled').length}
                      </p>
                    </div>
                    <IconifyIcon icon="solar:calendar-bold-duotone" className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completadas</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {campaigns.filter(c => c.status === 'completed').length}
                      </p>
                    </div>
                    <IconifyIcon icon="solar:check-circle-bold-duotone" className="w-8 h-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabla de campañas - estilo Voice AI */}
            {campaigns.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <IconifyIcon icon="solar:target-outline" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No hay campañas</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Comienza creando tu primera campaña de mensajería masiva
                  </p>
                  <Button
                    onClick={() => {
                      toast({
                        title: "Próximamente",
                        description: "Funcionalidad de creación de campañas en desarrollo"
                      });
                    }}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
                  >
                    <IconifyIcon icon="solar:magic-stick-3-bold" className="w-4 h-4 mr-2" />
                    Crear Primera Campaña
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-visible">
                <CardContent className="p-0 overflow-visible">
                  <div className="table-container-with-dropdowns overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr className="text-left text-gray-600 dark:text-gray-300">
                          <th className="px-4 py-3">Campaña</th>
                          <th className="px-4 py-3">Estado</th>
                          <th className="px-4 py-3">Tipo</th>
                          <th className="px-4 py-3">Contactos</th>
                          <th className="px-4 py-3">Programada</th>
                          <th className="px-4 py-3">Avance</th>
                          <th className="px-4 py-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {campaigns.map((campaign) => {
                          // Calcular progreso basado en estadísticas de la campaña
                          const stats = campaign.stats || campaign.statistics || {};
                          const totalContacts = Number(stats.total_contacts || stats.total_targets || campaign.total_contacts || 0);
                          const sentMessages = Number(stats.sent_count || stats.messages_sent || campaign.sent_messages || 0);
                          const deliveredMessages = Number(stats.delivered_count || stats.messages_delivered || 0);
                          const failedMessages = Number(stats.failed_count || stats.messages_failed || 0);
                          const processedMessages = sentMessages + deliveredMessages + failedMessages;
                          const progress = totalContacts > 0 ? Math.round((processedMessages / totalContacts) * 100) : 0;
                          
                          return (
                            <tr key={campaign.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900 dark:text-white">{campaign.name}</div>
                                <div className="text-gray-500 dark:text-gray-400 truncate max-w-xs">{campaign.description || 'Sin descripción'}</div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                  campaign.status === 'running' || campaign.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                                  campaign.status === 'scheduled' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' :
                                  campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' :
                                  campaign.status === 'completed' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300' :
                                  campaign.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
                                }`}>
                                  {(campaign.status === 'running' || campaign.status === 'active') && <IconifyIcon icon="solar:play-bold" className="w-3.5 h-3.5" />}
                                  {campaign.status === 'scheduled' && <IconifyIcon icon="solar:calendar-bold" className="w-3.5 h-3.5" />}
                                  {campaign.status === 'paused' && <IconifyIcon icon="solar:pause-bold" className="w-3.5 h-3.5" />}
                                  {campaign.status === 'completed' && <IconifyIcon icon="solar:check-circle-bold" className="w-3.5 h-3.5" />}
                                  {campaign.status === 'cancelled' && <IconifyIcon icon="solar:close-circle-bold" className="w-3.5 h-3.5" />}
                                  {getCampaignStatusText(campaign.status)}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-gray-900 dark:text-white">{getCampaignTypeText((campaign as any).campaign_type || (campaign as any).type)}</td>
                              <td className="px-4 py-3 text-gray-900 dark:text-white">{totalContacts}</td>
                              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                {campaign.scheduled_at || campaign.scheduled_date
                                  ? new Date(campaign.scheduled_at || campaign.scheduled_date).toLocaleString('es-ES')
                                  : '-'}
                              </td>
                              <td className="px-4 py-3 w-56">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${progress}%` }}></div>
                                  </div>
                                  <span className="text-gray-700 dark:text-gray-300 tabular-nums w-10 text-right">{progress}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex justify-end">
                                  <Dropdown
                                    label=""
                                    dismissOnClick={false}
                                    inline
                                    renderTrigger={() => (
                                      <span className="h-9 w-9 flex justify-center items-center rounded-full hover:bg-lightprimary hover:text-primary cursor-pointer">
                                        <IconifyIcon icon="solar:menu-dots-bold" className="w-5 h-5" />
                                      </span>
                                    )}
                                  >
                                    <Dropdown.Item className="flex gap-3" onClick={() => handleViewCampaignDetails(campaign)}>
                                      <IconifyIcon icon="solar:eye-bold-duotone" height={18} />
                                      Ver detalles
                                    </Dropdown.Item>
                                    {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                                      <Dropdown.Item className="flex gap-3" onClick={() => handleExecuteCampaign(campaign.id)}>
                                        <IconifyIcon icon="solar:play-bold-duotone" height={18} />
                                        Iniciar
                                      </Dropdown.Item>
                                    )}
                                    {(campaign.status === 'running' || campaign.status === 'active' || campaign.status === 'sending') && (
                                      <Dropdown.Item className="flex gap-3" onClick={() => handlePauseCampaign(campaign.id)}>
                                        <IconifyIcon icon="solar:pause-bold-duotone" height={18} />
                                        Pausar
                                      </Dropdown.Item>
                                    )}
                                    {campaign.status === 'paused' && (
                                      <Dropdown.Item className="flex gap-3" onClick={() => handleResumeCampaign(campaign.id)}>
                                        <IconifyIcon icon="solar:play-bold-duotone" height={18} />
                                        Reanudar
                                      </Dropdown.Item>
                                    )}
                                    {campaign.status === 'completed' && (
                                      <Dropdown.Item className="flex gap-3" onClick={() => handleResendCampaign(campaign.id)}>
                                        <IconifyIcon icon="solar:restart-bold-duotone" height={18} />
                                        Reenviar
                                      </Dropdown.Item>
                                    )}
                                    {(campaign.status === 'running' || campaign.status === 'active' || campaign.status === 'sending' || campaign.status === 'paused') && (
                                      <Dropdown.Item className="flex gap-3" onClick={() => handleCancelCampaign(campaign.id)}>
                                        <IconifyIcon icon="solar:close-circle-bold" height={18} />
                                        Cancelar
                                      </Dropdown.Item>
                                    )}
                                    <Dropdown.Item className="flex gap-3" onClick={() => handleDeleteCampaign(campaign)}>
                                      <IconifyIcon icon="solar:trash-bin-trash-bold" height={18} />
                                      Eliminar
                                    </Dropdown.Item>
                                  </Dropdown>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </Tabs.Item>

        </Tabs>
             </div>
           </div>
         </div>
      </div>

      {/* Modal de Detalles de Campaña */}
      {isCampaignDetailOpen && selectedCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9998] p-4">
          <div className="bg-white dark:bg-darkgray rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto relative z-[9999]">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <IconifyIcon icon="solar:target-bold-duotone" className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Detalles de Campaña: {selectedCampaign.name}
                  </h3>
                </div>
                <Button
                  onClick={() => {
                    setIsCampaignDetailOpen(false);
                    setSelectedCampaign(null);
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-gray-600"
                >
                  <IconifyIcon icon="solar:close-circle-bold" className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Header con información básica */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {selectedCampaign.total_contacts || 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Contactos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {selectedCampaign.sent_messages || 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Enviados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {selectedCampaign.failed_messages || 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Fallidos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {selectedCampaign.total_contacts > 0
                        ? Math.round((selectedCampaign.sent_messages / selectedCampaign.total_contacts) * 100)
                        : 0}%
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Progreso</div>
                  </div>
                </div>
              </div>

              {/* Información de la campaña */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h4 className="font-medium mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                    <IconifyIcon icon="solar:document-text-bold" className="w-5 h-5 text-blue-600" />
                    Información General
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Estado:</span>
                      <Badge className={`${
                        selectedCampaign.status === 'running' || selectedCampaign.status === 'active' ? 'bg-green-100 text-green-800' :
                        selectedCampaign.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                        selectedCampaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                        selectedCampaign.status === 'completed' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {getCampaignStatusText(selectedCampaign.status)}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Tipo:</span>
                      <span className="text-gray-900 dark:text-white">{selectedCampaign.type || 'Inmediata'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Descripción:</span>
                      <span className="text-gray-900 dark:text-white text-right max-w-xs">{selectedCampaign.description || 'Sin descripción'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Creada:</span>
                      <span className="text-gray-900 dark:text-white">{selectedCampaign.created_at ? new Date(selectedCampaign.created_at).toLocaleString('es-ES') : '-'}</span>
                    </div>
                    {(selectedCampaign.scheduled_at || selectedCampaign.scheduled_date) && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Programada:</span>
                        <span className="text-gray-900 dark:text-white">{new Date(selectedCampaign.scheduled_at || selectedCampaign.scheduled_date).toLocaleString('es-ES')}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h4 className="font-medium mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                    <IconifyIcon icon="solar:chart-square-bold" className="w-5 h-5 text-green-600" />
                    Estadísticas
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Mensajes enviados:</span>
                      <span className="text-gray-900 dark:text-white">{selectedCampaign.sent_messages || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Mensajes entregados:</span>
                      <span className="text-gray-900 dark:text-white">{selectedCampaign.delivered_messages || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Mensajes fallidos:</span>
                      <span className="text-gray-900 dark:text-white">{selectedCampaign.failed_messages || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Mensajes pendientes:</span>
                      <span className="text-gray-900 dark:text-white">
                        {Math.max(0, (selectedCampaign.total_contacts || 0) - (selectedCampaign.sent_messages || 0))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Plantilla del mensaje */}
              {selectedCampaign.message_template && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h4 className="font-medium mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                    <IconifyIcon icon="solar:document-text-bold-duotone" className="w-5 h-5 text-blue-500" />
                    Plantilla del Mensaje
                  </h4>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                      {selectedCampaign.message_template}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <Button
                onClick={() => {
                  setIsCampaignDetailOpen(false);
                  setSelectedCampaign(null);
                }}
                variant="outline"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación de Campaña */}
      {isDeleteCampaignModalOpen && campaignToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9998] p-4">
          <div className="bg-white dark:bg-darkgray rounded-lg w-full max-w-md relative z-[9999]">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <IconifyIcon icon="solar:danger-triangle-bold" className="w-6 h-6 text-red-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confirmar Eliminación</h3>
              </div>
              
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                ¿Estás seguro de que deseas eliminar la campaña{' '}
                <span className="font-semibold text-gray-900 dark:text-white">
                  "{campaignToDelete.name}"
                </span>?
              </p>
              
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-6">
                <div className="flex items-start gap-2">
                  <IconifyIcon icon="solar:info-circle-bold" className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium mb-1">Esta acción no se puede deshacer</p>
                    <p>Se eliminarán todos los datos asociados a esta campaña.</p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsDeleteCampaignModalOpen(false);
                    setCampaignToDelete(null);
                  }}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={confirmDeleteCampaign}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {loading ? (
                    <>
                      <IconifyIcon icon="solar:refresh-circle-outline" className="w-4 h-4 mr-2 animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <IconifyIcon icon="solar:trash-bin-trash-bold" className="w-4 h-4 mr-2" />
                      Eliminar Campaña
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR */}
      <Dialog open={isQRModalOpen} onOpenChange={setIsQRModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Código QR - WhatsApp</DialogTitle>
          </DialogHeader>

          <div className="text-center">
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Escanea este código QR con WhatsApp Web en tu teléfono
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                <IconifyIcon icon="solar:refresh-bold" className="w-3 h-3 animate-spin z-[20] relative" />
                <span>Detectando conexión automáticamente...</span>
              </div>
            </div>

            {qrCode ? (
              <div>
                <div className="bg-white p-4 rounded-lg border mb-4">
                  <img
                    src={qrCode || ''}
                    alt="Código QR de WhatsApp"
                    className="w-64 h-64 mx-auto"
                  />
                </div>
                {qrExpiry && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Expira: {new Date(qrExpiry).toLocaleString()}
                  </p>
                )}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-left text-sm">
                  <p className="font-medium mb-2 text-blue-800 dark:text-blue-200">Instrucciones:</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-700 dark:text-gray-300">
                    <li>Abre WhatsApp en tu teléfono</li>
                    <li>Ve a Configuración → Dispositivos vinculados</li>
                    <li>Toca "Vincular un dispositivo"</li>
                    <li>Escanea este código QR</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="py-8">
                <div className="mb-4">
                  <IconifyIcon icon="solar:refresh-bold" className="w-16 h-16 text-blue-500 mx-auto animate-spin z-[20] relative" />
                </div>
                <p className="text-gray-600 dark:text-gray-400">Generando código QR...</p>
              </div>
            )}
          </div>

          <div className="flex justify-between mt-6">
            <Button
              onClick={() => {
                setIsQRModalOpen(false);
                stopQRPolling();
              }}
              variant="outline"
            >
              Cerrar
            </Button>
            {selectedInstance?.id && (
              <Button
                onClick={() => handleShowQR(selectedInstance)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <IconifyIcon icon="solar:refresh-bold" className="w-4 h-4 mr-2 z-[20] relative" />
                Actualizar QR
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalles de Mensaje - estilo CallHistory */}
      <Dialog open={isMessageDetailOpen} onOpenChange={() => {
        setIsMessageDetailOpen(false);
        setSelectedMessage(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconifyIcon icon="solar:chat-round-bold-duotone" className="w-5 h-5 text-blue-600" />
              Detalles del Mensaje
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
              {/* Header con información básica */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <IconifyIcon icon="solar:user-circle-bold-duotone" className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                        {selectedMessage?.recipient_name || 'Sin nombre'}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">{selectedMessage?.recipient_phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {(() => {
                      const { variant, text, className } = getMessageStatusBadge(selectedMessage?.status);
                      return <Badge variant={variant} className={className}>{text}</Badge>;
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 mb-1">Campaña</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedMessage?.campaign_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 mb-1">Instancia</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedMessage?.instance_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 mb-1">Enviado</p>
                    <p className="font-medium text-gray-900 dark:text-white">{formatDate(selectedMessage?.sent_at || selectedMessage?.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 mb-1">Entregado</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedMessage?.delivered_at ? formatDate(selectedMessage.delivered_at) : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Contenido del mensaje */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h4 className="font-medium mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                  <IconifyIcon icon="solar:document-text-bold-duotone" className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                  Contenido del Mensaje
                </h4>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {selectedMessage?.message_content || 'Sin contenido'}
                  </p>
                </div>
              </div>

              {/* Información adicional */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h4 className="font-medium mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                    <IconifyIcon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                    Información de Envío
                  </h4>
                  <div className="flex flex-col gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Estado:</span>
                      {(() => {
                        const { variant, text, className } = getMessageStatusBadge(selectedMessage?.status);
                        return <Badge variant={variant} className={className}>{text}</Badge>;
                      })()}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">ID del mensaje:</span>
                      <span className="text-gray-900 dark:text-white font-mono text-xs">{selectedMessage?.id}</span>
                    </div>
                    {selectedMessage?.whatsapp_message_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">WhatsApp ID:</span>
                        <span className="text-gray-900 dark:text-white font-mono text-xs">{selectedMessage.whatsapp_message_id}</span>
                      </div>
                    )}
                    {selectedMessage?.error_message && (
                      <div className="flex items-start justify-between">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">Error:</span>
                        <span className="text-red-600 dark:text-red-400 text-xs text-right max-w-xs">{selectedMessage.error_message}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h4 className="font-medium mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                    <IconifyIcon icon="solar:clock-circle-bold-duotone" className="w-5 h-5 text-green-500 dark:text-green-400" />
                    Línea de Tiempo
                  </h4>
                  <div className="flex flex-col gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Creado:</span>
                      <span className="text-gray-900 dark:text-white text-xs">{formatDate(selectedMessage?.created_at)}</span>
                    </div>
                    {selectedMessage?.sent_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">Enviado:</span>
                        <span className="text-gray-900 dark:text-white text-xs">{formatDate(selectedMessage.sent_at)}</span>
                      </div>
                    )}
                    {selectedMessage?.delivered_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">Entregado:</span>
                        <span className="text-gray-900 dark:text-white text-xs">{formatDate(selectedMessage.delivered_at)}</span>
                      </div>
                    )}
                    {selectedMessage?.read_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">Leído:</span>
                        <span className="text-gray-900 dark:text-white text-xs">{formatDate(selectedMessage.read_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Metadatos si existen */}
              {selectedMessage?.metadata && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <h4 className="font-medium mb-4 text-gray-900 dark:text-white">Metadatos</h4>
                  <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-4 rounded overflow-x-auto text-gray-700 dark:text-gray-300">
                    {JSON.stringify(selectedMessage.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

          <div className="flex justify-end">
            <Button
              onClick={() => {
                setIsMessageDetailOpen(false);
                setSelectedMessage(null);
              }}
              variant="outline"
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Crear Instancia */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Instancia WhatsApp</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="phone_number">Número de Teléfono</Label>
              <Input
                id="phone_number"
                type="text"
                placeholder="+57 300 123 4567"
                value={newInstance.phone_number}
                onChange={(e) => setNewInstance((prev: NewInstanceForm) => ({ ...prev, phone_number: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="webhook_url">Webhook URL (Opcional)</Label>
              <Input
                id="webhook_url"
                type="url"
                placeholder="https://tu-dominio.com/webhook"
                value={newInstance.webhook_url}
                onChange={(e) => setNewInstance((prev: NewInstanceForm) => ({ ...prev, webhook_url: e.target.value }))}
              />
            </div>

            <Alert>
              <IconifyIcon icon="solar:info-circle-bold" className="w-4 h-4" />
              <AlertDescription>
                La nueva instancia se creará y estará lista para ser configurada con el código QR.
              </AlertDescription>
            </Alert>
          </div>

          <div className="flex justify-between mt-6">
            <Button
              onClick={() => setIsCreateModalOpen(false)}
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateInstance}
              disabled={creating || !newInstance.phone_number}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {creating ? (
                <>
                  <IconifyIcon icon="solar:refresh-bold" className="w-4 h-4 mr-2 animate-spin z-[20] relative" />
                  Creando...
                </>
              ) : (
                <>
                  <IconifyIcon icon="solar:add-circle-bold" className="w-4 h-4 mr-2" />
                  Crear Instancia
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ConfiguracionMasiva;
