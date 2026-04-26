// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { createBrowserRouter, Navigate } from 'react-router';
import Loadable from '../layouts/full/shared/loadable/Loadable';
import { lazyRetry } from '../utils/lazyRetry';
import TrialExpired from '../views/saas/billing/TrialExpired';
import FrontendLayout from 'src/layouts/blank/FrontendLayout';
import ProtectedRoute from '../components/ProtectedRoute';
import ForceLightMode from '../components/ForceLightMode';

/* ***Layouts**** */
const FullLayout = Loadable(lazyRetry(() => import('../layouts/full/FullLayout')));
const UnifiedProtectedFullLayout = Loadable(
  lazyRetry(() => import('../layouts/full/UnifiedProtectedFullLayout')),
);
const BlankLayout = Loadable(lazyRetry(() => import('../layouts/blank/BlankLayout')));

/* ****Pages***** */
const TerminosCondiciones = Loadable(lazyRetry(() => import('../views/pages/TerminosCondiciones')));
const PoliticaPrivacidad = Loadable(lazyRetry(() => import('../views/pages/PoliticaPrivacidad')));
const Regalo = Loadable(lazyRetry(() => import('../views/pages/Regalo')));
const TrabajaConNosotros = Loadable(lazyRetry(() => import('../views/pages/TrabajaConNosotros')));

/* ****Apps***** */
const CombinedDashboard = Loadable(lazyRetry(() => import('../views/combined/CombinedDashboard')));
const Inicio = Loadable(lazyRetry(() => import('../views/inicio/Inicio')));
const GuroHub = Loadable(lazyRetry(() => import('../views/hub/GuroHub')));

// authentication
const Login = Loadable(lazyRetry(() => import('../views/authentication/auth1/Login')));
const Register = Loadable(lazyRetry(() => import('../views/authentication/auth1/Register')));
const ForgotPassword = Loadable(lazyRetry(() => import('../views/authentication/auth1/ForgotPassword')));
const TwoSteps = Loadable(lazyRetry(() => import('../views/authentication/auth1/TwoSteps')));
const EmailVerification = Loadable(
  lazyRetry(() => import('../views/authentication/auth1/EmailVerification')),
);
const Maintainance = Loadable(lazyRetry(() => import('../views/authentication/Maintainance')));

// SaaS Authentication
const SaasLogin = Loadable(lazyRetry(() => import('../views/auth/Login')));

// Email Verification
const VerificationPrompt = Loadable(lazyRetry(() => import('../pages/VerificationPrompt')));
// Wallet Return
const WalletReturn = Loadable(lazyRetry(() => import('../pages/WalletReturn')));

// SaaS Transitional/Building screen
const DashboardBuilding = Loadable(lazyRetry(() => import('../views/saas/dashboard/DashboardBuilding')));

// SaaS Apps
const SaasDashboard = Loadable(lazyRetry(() => import('../views/saas/dashboard/Dashboard')));
const SaasNuevoCliente = Loadable(lazyRetry(() => import('../views/saas/clientes/NuevoCliente')));
const SaasDetalleCliente = Loadable(lazyRetry(() => import('../views/saas/clientes/DetalleCliente')));
const SaasEditarCliente = Loadable(lazyRetry(() => import('../views/saas/clientes/EditarCliente')));
const SaasListaEmpleados = Loadable(lazyRetry(() => import('../views/saas/empleados/ListaEmpleados')));
const SaasNuevoEmpleado = Loadable(lazyRetry(() => import('../views/saas/empleados/NuevoEmpleado')));
const SaasEditarEmpleado = Loadable(lazyRetry(() => import('../views/saas/empleados/EditarEmpleado')));
const SaasListaLeads = Loadable(lazyRetry(() => import('../views/saas/sales-funnel/ListaLeads')));
const SaasKanbanLeads = Loadable(
  lazyRetry(() => import('../views/saas/sales-funnel/SalesFunnelKanban')),
);
const SaasNuevoLead = Loadable(lazyRetry(() => import('../views/saas/sales-funnel/NuevoLead')));
const SaasDetalleLead = Loadable(lazyRetry(() => import('../views/saas/sales-funnel/DetalleLead')));
const SaasEditarLead = Loadable(lazyRetry(() => import('../views/saas/sales-funnel/EditarLead')));
const SaasListaTareas = Loadable(lazyRetry(() => import('../views/saas/commercial-tasks/ListaTareas')));
const SaasNuevaTarea = Loadable(lazyRetry(() => import('../views/saas/commercial-tasks/NuevaTarea')));
const SaasDetalleTarea = Loadable(
  lazyRetry(() => import('../views/saas/commercial-tasks/DetalleTarea')),
);
const SaasEditarTarea = Loadable(lazyRetry(() => import('../views/saas/commercial-tasks/EditarTarea')));
const ConfiguracionMasiva = Loadable(
  lazyRetry(() => import('../views/saas/configuracion-masiva/ConfiguracionMasiva')),
);

// Calendar
const CalendarPage = Loadable(lazyRetry(() => import('../views/apps/calendar/CalendarPage')));

// Pricing page
const PricingCalculatorPage = Loadable(lazyRetry(() => import('../views/pages/PricingCalculatorPage')));

// Checkout (Frontend)
const Checkout = Loadable(lazyRetry(() => import('../views/pages/frontend-pages/Checkout')));

// Onboarding Flow (Nuevo flujo de compra simplificado)
const SelectAppsFlow = Loadable(lazyRetry(() => import('../views/pages/onboarding/SelectAppsFlow')));
const SignupFlow = Loadable(lazyRetry(() => import('../views/pages/onboarding/SignupFlow')));

// Landing Page
const LandingPages = Loadable(lazyRetry(() => import('../views/pages/landingpages/LandingPages')));
const FramerLandingPage = Loadable(lazyRetry(() => import('../views/pages/landingpages/FramerLandingPage')));

const Error = Loadable(lazyRetry(() => import('../views/authentication/Error')));
const BlogSegurosSEO = Loadable(
  lazyRetry(() => import('../views/pages/frontend-pages/BlogSegurosSEO')),
);
const BlogIndex = Loadable(lazyRetry(() => import('../views/pages/frontend-pages/BlogIndex')));
const BlogArticle = Loadable(lazyRetry(() => import('../views/pages/frontend-pages/BlogArticle')));

// Seguros Apps
const Polizas = Loadable(lazyRetry(() => import('../views/apps/seguros/polizas/Polizas')));
const Automoviles = Loadable(lazyRetry(() => import('../views/apps/seguros/automoviles/Automoviles')));
const NuevaPoliza = Loadable(lazyRetry(() => import('../views/apps/seguros/polizas/NuevaPoliza')));
const NuevaPolizaColectiva = Loadable(
  lazyRetry(() => import('../views/apps/seguros/polizas/NuevaPolizaColectiva')),
);
const EditarPoliza = Loadable(lazyRetry(() => import('../views/apps/seguros/polizas/EditarPoliza')));
const Clientes = Loadable(lazyRetry(() => import('../views/apps/seguros/clientes/Clientes')));
const NuevoCliente = Loadable(lazyRetry(() => import('../views/apps/seguros/clientes/NuevoCliente')));
const EditarCliente = Loadable(lazyRetry(() => import('../views/apps/seguros/clientes/EditarCliente')));
const Siniestros = Loadable(lazyRetry(() => import('../views/apps/seguros/siniestros/Siniestros')));
const SiniestrosActivos = Loadable(
  lazyRetry(() => import('../views/apps/seguros/siniestros/SiniestrosActivos')),
);
const NuevoSiniestro = Loadable(
  lazyRetry(() => import('../views/apps/seguros/siniestros/NuevoSiniestroMejorado')),
);
const EditarSiniestro = Loadable(
  lazyRetry(() => import('../views/apps/seguros/siniestros/EditarSiniestro')),
);
const Renovaciones = Loadable(
  lazyRetry(() => import('../views/apps/seguros/renovaciones/Renovaciones')),
);
const Seguimiento = Loadable(lazyRetry(() => import('../views/apps/seguros/seguimiento/Seguimiento')));
const Cumplimiento = Loadable(lazyRetry(() => import('../views/apps/seguros/polizas/Cumplimiento')));

// IA Apps
const AsistenteIA = Loadable(lazyRetry(() => import('../views/apps/ia/asistente/AsistenteIA')));
const VentasCruzadas = Loadable(
  lazyRetry(() => import('../views/apps/ia/ventas-cruzadas/VentasCruzadas')),
);
const RecomendacionesProducto = Loadable(
  lazyRetry(() => import('../views/apps/ia/recomendaciones/RecomendacionesProducto')),
);
const Robots = Loadable(
  lazyRetry(() => import('../views/apps/ia/robots/Robots')),
);

// Voice AI
const VoiceAIDashboard = Loadable(lazyRetry(() => import('../views/voice-ai/VoiceAIDashboard')));
const Perfil = Loadable(lazyRetry(() => import('../views/apps/account/Perfil')));

// RRHH Apps
const RecursosHumanos = Loadable(lazyRetry(() => import('../views/apps/rrhh/RecursosHumanos')));
const NuevaVacante = Loadable(lazyRetry(() => import('../views/apps/rrhh/NuevaVacante')));
const EditarVacante = Loadable(lazyRetry(() => import('../views/apps/rrhh/EditarVacante')));
const Personas = Loadable(lazyRetry(() => import('../views/apps/rrhh/Personas')));
const Reclutamiento = Loadable(lazyRetry(() => import('../views/apps/rrhh/Reclutamiento')));
const Desempeno = Loadable(lazyRetry(() => import('../views/apps/rrhh/Desempeno')));
const Clima = Loadable(lazyRetry(() => import('../views/apps/rrhh/Clima')));

// Marketing Apps
const EnlacesCotizacion = Loadable(
  lazyRetry(() => import('../views/apps/marketing/enlaces-cotizacion/EnlacesCotizacion')),
);
const Plantillas = Loadable(lazyRetry(() => import('../views/apps/marketing/plantillas/Plantillas')));
const MiniWeb = Loadable(lazyRetry(() => import('../views/apps/marketing/mini-web/MiniWeb')));
const MiPaginaWeb = Loadable(lazyRetry(() => import('../views/apps/marketing/mi-web/MiPaginaWeb')));
const ComparadorSeguros = Loadable(
  lazyRetry(() => import('../views/apps/marketing/comparador-seguros/ComparadorSeguros')),
);
const CotizadorBolivarAutos = Loadable(
  lazyRetry(() => import('../views/apps/cotizadores/autos/CotizadorBolivar')),
);
const ComparadorAutos = Loadable(
  lazyRetry(() => import('../views/apps/cotizadores/autos/ComparadorAutos')),
);
const CreadorContenido = Loadable(
  lazyRetry(() => import('../views/apps/marketing/creador-contenido/CreadorContenido')),
);
const MiniWebPublic = Loadable(lazyRetry(() => import('../views/public/MiniWebPublic')));
const QuoteForm = Loadable(lazyRetry(() => import('../views/public/QuoteForm')));

// Admin Apps
const Usuarios = Loadable(lazyRetry(() => import('../views/apps/admin/usuarios/Usuarios')));
const ReportesUsuarios = Loadable(lazyRetry(() => import('../views/apps/admin/reportes-usuarios/ReportesUsuarios')));
const Roles = Loadable(lazyRetry(() => import('../views/apps/admin/roles/Roles')));
const DemoPermisosLoadable = Loadable(
  lazyRetry(() => import('../views/apps/admin/demo-permisos/DemoPermisos')),
);
const InformacionAgencia = Loadable(
  lazyRetry(() => import('../views/apps/admin/informacion-agencia/InformacionAgencia')),
);
const Sedes = Loadable(lazyRetry(() => import('../views/apps/admin/sedes/Sedes')));
const Aseguradoras = Loadable(lazyRetry(() => import('../views/apps/admin/aseguradoras/Aseguradoras')));
const Ramos = Loadable(lazyRetry(() => import('../views/apps/admin/ramos/Ramos')));
const Vendedores = Loadable(lazyRetry(() => import('../views/apps/admin/vendedores/Vendedores')));
const EstadosSiniestros = Loadable(
  lazyRetry(() => import('../views/apps/admin/estados-siniestros/EstadosSiniestros')),
);
const EstadosARL = Loadable(lazyRetry(() => import('../views/apps/admin/estados-arl/EstadosARL')));
const MotivosEstadosPoliza = Loadable(
  lazyRetry(() => import('../views/apps/admin/motivos-estados-poliza/MotivosEstadosPoliza')),
);
const TipoAfiliacion = Loadable(
  lazyRetry(() => import('../views/apps/admin/tipo-afiliacion/TipoAfiliacion')),
);
const Mensajeros = Loadable(lazyRetry(() => import('../views/apps/admin/mensajeros/Mensajeros')));
const Coberturas = Loadable(lazyRetry(() => import('../views/apps/admin/coberturas/Coberturas')));
const ImportacionMasiva = Loadable(lazyRetry(() => import('../views/apps/admin/ImportacionMasiva')));
const ImportacionMultiple = Loadable(lazyRetry(() => import('../views/apps/admin/ImportacionMultiple')));

// Configuración del Sistema Apps
const AuditoriaAccesos = Loadable(
  lazyRetry(() => import('../views/apps/admin/auditoria/AuditoriaAccesos')),
);
const FirmaElectronica = Loadable(lazyRetry(() => import('../views/apps/admin/firma/FirmaElectronica')));
const SeguridadDosFactores = Loadable(
  lazyRetry(() => import('../views/apps/admin/2fa/SeguridadDosFactores')),
);
const CopiasSeguridad = Loadable(lazyRetry(() => import('../views/apps/admin/backup/CopiasSeguridad')));

// Cartera unificada (nueva, reemplaza CarteraClientes/ComisionesPorPoliza/RecibosCuadreCaja)
const Cartera = Loadable(lazyRetry(() => import('../views/apps/cartera/Cartera')));
// Pilotos — NO TOCAR
const CarteraAseguradoras = Loadable(lazyRetry(() => import('../views/apps/cartera-aseguradoras/CarteraAseguradoras')));
const ComisionesAseguradoras = Loadable(lazyRetry(() => import('../views/apps/comisiones-aseguradoras/ComisionesAseguradoras')));

// Billing Apps
const MisFacturas = Loadable(lazyRetry(() => import('../views/apps/billing/MisFacturas')));
const MiSuscripcion = Loadable(lazyRetry(() => import('../views/apps/billing/MiSuscripcion')));
const UpgradePlan = Loadable(lazyRetry(() => import('../views/apps/billing/UpgradePlan')));

// Gestión Comercial Apps
const MetasObjetivos = Loadable(lazyRetry(() => import('../views/apps/comercial/MetasObjetivos')));
const EquiposVentas = Loadable(lazyRetry(() => import('../views/apps/comercial/EquiposVentas')));
const Rendimiento = Loadable(lazyRetry(() => import('../views/apps/comercial/rendimiento/Rendimiento')));

// Gestión Legal Apps
const Contratos = Loadable(lazyRetry(() => import('../views/apps/legal/contratos/Contratos')));
const DocumentosCliente = Loadable(
  lazyRetry(() => import('../views/apps/legal/documentos-cliente/DocumentosCliente')),
);
const DocumentosPoliza = Loadable(
  lazyRetry(() => import('../views/apps/seguros/documentos-poliza/DocumentosPoliza')),
);
const DocumentosSiniestro = Loadable(
  lazyRetry(() => import('../views/apps/seguros/documentos-siniestro/DocumentosSiniestro')),
);
const DocumentosInternos = Loadable(
  lazyRetry(() => import('../views/apps/legal/documentos-internos/DocumentosInternos')),
);

// Integraciones Apps
const ApisAseguradoras = Loadable(
  lazyRetry(() => import('../views/apps/integraciones/apis-aseguradoras/ApisAseguradoras')),
);
const Webhooks = Loadable(lazyRetry(() => import('../views/apps/integraciones/webhooks/Webhooks')));
const BasesDatos = Loadable(
  lazyRetry(() => import('../views/apps/integraciones/bases-datos/BasesDatos')),
);
const ServiciosTerceros = Loadable(
  lazyRetry(() => import('../views/apps/integraciones/servicios-terceros/ServiciosTerceros')),
);

// Mobile Auth
const MobileAuthPage = Loadable(lazyRetry(() => import('../pages/MobileAuth')));
const EmpleadoLogin = Loadable(lazyRetry(() => import('../views/auth/EmpleadoLogin')));

// WhatsApp Apps
const WhatsAppDashboard = Loadable(lazyRetry(() => import('../views/apps/whatsapp/WhatsAppDashboard')));
const WhatsAppConexiones = Loadable(lazyRetry(() => import('../views/apps/whatsapp/WhatsAppConexiones')));
const WhatsAppInbox = Loadable(lazyRetry(() => import('../views/apps/whatsapp/WhatsAppInboxPro')));
const ChatbotsList = Loadable(lazyRetry(() => import('../views/apps/whatsapp/ChatbotsList')));
const ChatbotFlowEditor = Loadable(lazyRetry(() => import('../views/apps/whatsapp/chatbot-editor/FlowEditorJointJS')));
const WhatsAppContactos = Loadable(lazyRetry(() => import('../views/apps/whatsapp/WhatsAppContactos')));
const WhatsAppPlantillas = Loadable(lazyRetry(() => import('../views/apps/whatsapp/WhatsAppPlantillas')));

// Test Components
const TestWelcomeModal = Loadable(lazyRetry(() => import('../components/TestWelcomeModal')));

// Master Panel (SUPERADMIN)
const MasterPanelLogin = Loadable(lazyRetry(() => import('../views/master-panel/MasterPanelLogin')));
const MasterPanelLayout = Loadable(lazyRetry(() => import('../views/master-panel/MasterPanelLayout')));
const MasterDashboardContent = Loadable(lazyRetry(() => import('../views/master-panel/MasterDashboardContent')));
const MasterBrokersPage = Loadable(lazyRetry(() => import('../views/master-panel/MasterBrokersPage')));
const MasterBrokerEditPage = Loadable(lazyRetry(() => import('../views/master-panel/MasterBrokerEditPage')));
const MasterUsuariosPage = Loadable(lazyRetry(() => import('../views/master-panel/MasterUsuariosPage')));
const MasterFinanzasPage = Loadable(lazyRetry(() => import('../views/master-panel/MasterFinanzasPage')));
const MasterLlamadasPage = Loadable(lazyRetry(() => import('../views/master-panel/MasterLlamadasPage')));
const MasterCampanasPage = Loadable(lazyRetry(() => import('../views/master-panel/MasterCampanasPage')));
const MasterConfiguracionPage = Loadable(lazyRetry(() => import('../views/master-panel/MasterConfiguracionPage')));
const MasterFacturacionPage = Loadable(lazyRetry(() => import('../views/master-panel/MasterFacturacionPage')));
const MasterBrokerDetailPage = Loadable(lazyRetry(() => import('../views/master-panel/MasterBrokerDetailPage')));
const MasterLogsPage = Loadable(lazyRetry(() => import('../views/master-panel/MasterLogsPage')));

const Router = [
  // Landing Page como página principal
  {
    path: '/',
    element: <BlankLayout />,
    children: [
      { path: '/', element: <ForceLightMode><FramerLandingPage /></ForceLightMode> },
      { path: '/landing-old', element: <LandingPages /> },
      { path: '/blog', element: <BlogIndex /> },
      { path: '/blog/software-seguros-colombia', element: <BlogSegurosSEO /> },
      { path: '/blog/:slug', element: <BlogArticle /> },
      { path: '/regalo', element: <Regalo /> },
      { path: '/trabaja-con-nosotros', element: <ForceLightMode><TrabajaConNosotros /></ForceLightMode> },
      { path: '/terminos-condiciones', element: <TerminosCondiciones /> },
      { path: '/politica-privacidad', element: <PoliticaPrivacidad /> },
      // Transitional route while SaaS contexto/tenant se termina de resolver
      { path: '/dashboard-building', element: <ForceLightMode><DashboardBuilding /></ForceLightMode> },
      { path: '/empleados/login', element: <EmpleadoLogin /> },
      { path: '/auth/login', element: <Login /> },
    ],
  },
  // Dashboard bajo /apps
  {
    path: '/apps',
    element: <UnifiedProtectedFullLayout />,
    children: [
      { path: '/apps/', exact: true, element: <Inicio /> },
      { path: '/apps/inicio', element: <Inicio /> },
      { path: '/apps/hub', element: <GuroHub /> },
      { path: '/apps/dashboard', element: <CombinedDashboard /> },

      // Seguros Routes
      { path: '/apps/seguros/polizas', element: <Polizas /> },
      { path: '/apps/seguros/automoviles', element: <Automoviles /> },

      { path: '/apps/seguros/polizas/nueva', element: <NuevaPoliza /> },
      { path: '/apps/seguros/polizas/nueva-colectiva', element: <NuevaPolizaColectiva /> },
      { path: '/apps/seguros/polizas/editar/:id', element: <EditarPoliza /> },
      { path: '/apps/seguros/clientes', element: <Clientes /> },
      { path: '/apps/seguros/clientes/nuevo', element: <NuevoCliente /> },
      { path: '/apps/seguros/clientes/editar/:id', element: <EditarCliente /> },
      { path: '/apps/seguros/siniestros', element: <Siniestros /> },
      { path: '/apps/seguros/siniestros/activos', element: <SiniestrosActivos /> },
      { path: '/apps/seguros/siniestros/nuevo', element: <NuevoSiniestro /> },
      { path: '/apps/seguros/siniestros/editar/:id', element: <EditarSiniestro /> },
      { path: '/apps/seguros/renovaciones', element: <Renovaciones /> },
      { path: '/apps/seguros/seguimiento', element: <Seguimiento /> },
      { path: '/apps/seguros/cumplimiento', element: <Cumplimiento /> },
      // Ruta removida: /apps/seguros/adjuntos-condiciones
      // Rutas de embudo de ventas eliminadas

      // RRHH Route
      { path: '/apps/recursos-humanos', element: <RecursosHumanos /> },
      { path: '/apps/recursos-humanos/personas', element: <Personas /> },
      { path: '/apps/recursos-humanos/reclutamiento', element: <Reclutamiento /> },
      { path: '/apps/recursos-humanos/desempeno', element: <Desempeno /> },
      { path: '/apps/recursos-humanos/clima', element: <Clima /> },
      { path: '/apps/recursos-humanos/nueva', element: <NuevaVacante /> },
      { path: '/apps/recursos-humanos/:id/editar', element: <EditarVacante /> },

      // Nuevas rutas de Gestión de Seguros
      // Rutas removidas: siniestros/documentos, siniestros/estadisticas

      // IA Routes
      { path: '/apps/ia/asistente', element: <AsistenteIA /> },
      { path: '/apps/ia/ventas-cruzadas', element: <VentasCruzadas /> },
      { path: '/apps/ia/recomendaciones-producto', element: <RecomendacionesProducto /> },
      { path: '/apps/ia/robots', element: <Robots /> },

      // ElevenLabs Dashboard Routes
      { path: '/apps/voice-ai/dashboard', element: <VoiceAIDashboard /> },
      // Cuenta / Perfil
      { path: '/apps/account/perfil', element: <Perfil /> },

      // Marketing Routes
      { path: '/apps/marketing/enlaces-cotizacion', element: <EnlacesCotizacion /> },
      { path: '/apps/marketing/plantillas', element: <Plantillas /> },
      { path: '/apps/marketing/mini-web', element: <MiniWeb /> },
      { path: '/apps/marketing/comparador-seguros', element: <ComparadorSeguros /> },
      { path: '/apps/marketing/creador-contenido', element: <CreadorContenido /> },
      { path: '/apps/marketing/mi-web', element: <MiPaginaWeb /> },

      // Cotizadores Routes
      { path: '/apps/cotizadores/autos/bolivar', element: <CotizadorBolivarAutos /> },
      { path: '/apps/cotizadores/autos/comparador', element: <ComparadorAutos /> },

      // Admin Routes
      { path: '/apps/admin/usuarios', element: <Usuarios /> },
      { path: '/apps/admin/usuarios/reportes', element: <ReportesUsuarios /> },
      { path: '/apps/admin/roles', element: <Roles /> },
      { path: '/apps/admin/demo-permisos', element: <DemoPermisosLoadable /> },
      { path: '/apps/admin/informacion-agencia', element: <InformacionAgencia /> },
      { path: '/apps/admin/sedes', element: <Sedes /> },
      { path: '/apps/admin/aseguradoras', element: <Aseguradoras /> },
      { path: '/apps/admin/ramos', element: <Ramos /> },
      { path: '/apps/admin/vendedores', element: <Vendedores /> },
      { path: '/apps/admin/estados-siniestros', element: <EstadosSiniestros /> },
      { path: '/apps/admin/estados-arl', element: <EstadosARL /> },
      { path: '/apps/admin/motivos-estados-poliza', element: <MotivosEstadosPoliza /> },
      { path: '/apps/admin/tipo-afiliacion', element: <TipoAfiliacion /> },
      { path: '/apps/admin/mensajeros', element: <Mensajeros /> },
      { path: '/apps/admin/coberturas', element: <Coberturas /> },

      // Configuración del Sistema Routes
      { path: '/apps/admin/auditoria', element: <AuditoriaAccesos /> },
      { path: '/apps/admin/firma', element: <FirmaElectronica /> },
      { path: '/apps/admin/2fa', element: <SeguridadDosFactores /> },
      { path: '/apps/admin/backup', element: <CopiasSeguridad /> },
      { path: '/apps/admin/importacion-masiva', element: <ImportacionMasiva /> },
      { path: '/apps/admin/importacion-multiple', element: <ImportacionMultiple /> },
      // Cartera unificada (nueva)
      { path: '/apps/cartera', element: <Cartera /> },
      // Pilotos (NO tocar)
      { path: '/apps/cartera/aseguradoras', element: <CarteraAseguradoras /> },
      { path: '/apps/comisiones/aseguradoras', element: <ComisionesAseguradoras /> },
      // Redirects para URLs viejas
      { path: '/apps/cartera/clientes', element: <Cartera /> },
      { path: '/apps/cartera/recibos-caja', element: <Cartera /> },
      { path: '/apps/comisiones/por-poliza', element: <Cartera /> },

      // Billing Routes
      { path: '/apps/billing/facturas', element: <MisFacturas /> },
      { path: '/apps/billing/suscripcion', element: <MiSuscripcion /> },
      { path: '/apps/billing/planes', element: <UpgradePlan /> },

      // Gestión Comercial Routes
      { path: '/apps/comercial/metas-objetivos', element: <MetasObjetivos /> },
      { path: '/apps/comercial/equipos-ventas', element: <EquiposVentas /> },
      // Eliminada ruta /apps/comercial/pipeline
      { path: '/apps/comercial/rendimiento', element: <Rendimiento /> },

      // Gestión Documental Routes
      { path: '/apps/legal/contratos', element: <Contratos /> },
      { path: '/apps/legal/documentos-cliente', element: <DocumentosCliente /> },
      { path: '/apps/seguros/documentos-poliza', element: <DocumentosPoliza /> },
      { path: '/apps/seguros/documentos-siniestro', element: <DocumentosSiniestro /> },
      { path: '/apps/legal/documentos-internos', element: <DocumentosInternos /> },

      // Integraciones Routes
      { path: '/apps/integraciones/apis-aseguradoras', element: <ApisAseguradoras /> },
      { path: '/apps/integraciones/webhooks', element: <Webhooks /> },
      { path: '/apps/integraciones/bases-datos', element: <BasesDatos /> },
      { path: '/apps/integraciones/servicios-terceros', element: <ServiciosTerceros /> },

      // SaaS Routes
      { path: '/apps/saas/dashboard', element: <SaasDashboard /> },
      { path: '/apps/saas/trial-expired', element: <TrialExpired /> },
      // { path: '/apps/saas/clientes', element: <SaasListaClientes /> }, // Página de lista SaaS removida
      { path: '/apps/saas/clientes/nuevo', element: <SaasNuevoCliente /> },
      { path: '/apps/saas/clientes/:id', element: <SaasDetalleCliente /> },
      { path: '/apps/saas/clientes/:id/editar', element: <SaasEditarCliente /> },
      { path: '/apps/saas/empleados', element: <SaasListaEmpleados /> },
      { path: '/apps/saas/empleados/nuevo', element: <SaasNuevoEmpleado /> },
      { path: '/apps/saas/empleados/:id/editar', element: <SaasEditarEmpleado /> },
      {
        path: '/apps/saas/sales-funnel',
        element: <Navigate to="/apps/saas/sales-funnel/kanban" />,
      },
      { path: '/apps/saas/sales-funnel/kanban', element: <SaasKanbanLeads /> },
      { path: '/apps/saas/sales-funnel/lista', element: <SaasListaLeads /> },
      { path: '/apps/saas/sales-funnel/nuevo', element: <SaasNuevoLead /> },
      { path: '/apps/saas/sales-funnel/:id', element: <SaasDetalleLead /> },
      { path: '/apps/saas/sales-funnel/:id/editar', element: <SaasEditarLead /> },
      { path: '/apps/saas/commercial-tasks', element: <SaasListaTareas /> },
      { path: '/apps/saas/commercial-tasks/nueva', element: <SaasNuevaTarea /> },
      { path: '/apps/saas/commercial-tasks/:id', element: <SaasDetalleTarea /> },
      { path: '/apps/saas/commercial-tasks/:id/editar', element: <SaasEditarTarea /> },
      { path: '/apps/saas/configuracion-masiva', element: <ConfiguracionMasiva /> },
      { path: '/apps/calendar', element: <CalendarPage /> },

      // WhatsApp Routes
      { path: '/apps/whatsapp/dashboard', element: <WhatsAppDashboard /> },
      { path: '/apps/whatsapp/conexiones', element: <WhatsAppConexiones /> },
      { path: '/apps/whatsapp/inbox', element: <WhatsAppInbox /> },
      { path: '/apps/whatsapp/campanas', element: <ConfiguracionMasiva /> },
      { path: '/apps/whatsapp/campanas/nueva', element: <ConfiguracionMasiva /> },
      { path: '/apps/whatsapp/programados', element: <ConfiguracionMasiva /> },
      { path: '/apps/whatsapp/plantillas', element: <WhatsAppPlantillas /> },
      { path: '/apps/whatsapp/chatbots', element: <ChatbotsList /> },
      { path: '/apps/whatsapp/chatbots/nuevo', element: <ChatbotsList /> },
      // { path: '/apps/whatsapp/chatbots/flujos', element: <ChatbotFlowEditor /> },
      { path: '/apps/whatsapp/chatbots/respuestas', element: <ChatbotsList /> },
      { path: '/apps/whatsapp/contactos', element: <WhatsAppContactos /> },
            { path: '/apps/whatsapp/reportes', element: <WhatsAppDashboard /> },

      { path: '*', element: <Navigate to="/auth/404" /> },
    ],
  },
  // Páginas adicionales
  {
    path: '/',
    element: <BlankLayout />,
    children: [
      // Flow Editor - Full screen sin header
      { path: '/apps/whatsapp/chatbots/flujos', element: <ChatbotFlowEditor /> },
      // Redirect público a la ubicación en dashboard
      { path: '/ayuda/faq', element: <Navigate to="/apps/ayuda/faq" /> },
      {
        path: '/precios',
        element: <Navigate to="/comenzar" />,
      },
      {
        path: '/checkout',
        element: <FrontendLayout />,
        children: [{ path: '', element: <Checkout /> }],
      },
      // Nuevo flujo de onboarding simplificado (nueva linea dark)
      { path: '/comenzar', element: <SelectAppsFlow /> },
      { path: '/comenzar/registro', element: <SignupFlow /> },
      // Variante con branding SURA
      { path: '/sura', element: <SelectAppsFlow /> },
      { path: '/sura/registro', element: <SignupFlow /> },
      { path: '/web/:slug', element: <MiniWebPublic /> },
      { path: '/web/:slug/:tipo', element: <QuoteForm /> },
      { path: '/empleados', element: <Navigate to="/empleados/login" /> },
      { path: '/empleados/login', element: <EmpleadoLogin /> },
      { path: '/auth/login', element: <Login /> },
      { path: '/auth/register', element: <Navigate to="/comenzar" replace /> },
      { path: '/auth/forgot-password', element: <ForceLightMode><ForgotPassword /></ForceLightMode> },
      { path: '/auth/two-steps', element: <TwoSteps /> },
      { path: '/auth/email-verification', element: <EmailVerification /> },

      // Email Verification
      { path: '/auth/verification-prompt', element: <VerificationPrompt /> },
      { path: '/wallet/return', element: <WalletReturn /> },

      // Mobile Auth
      { path: '/auth/mobile', element: <MobileAuthPage /> },

      { path: '/auth/auth1/login', element: <Login /> },
      { path: '/auth/auth1/register', element: <Navigate to="/comenzar" replace /> },
      { path: '/auth/maintenance', element: <Maintainance /> },
      { path: '/test/welcome-modal', element: <TestWelcomeModal /> },
      { path: '404', element: <Error /> },
      { path: '/auth/404', element: <Error /> },
      { path: '*', element: <Navigate to="/auth/404" /> },
    ],
  },
  // Rutas de autenticación (sin protección)
  {
    path: '/auth',
    element: <BlankLayout />,
    children: [
      { path: 'login', element: <ForceLightMode><Login /></ForceLightMode> },
      { path: 'register', element: <Navigate to="/comenzar" replace /> },
      { path: 'forgot-password', element: <ForceLightMode><ForgotPassword /></ForceLightMode> },
      { path: 'two-steps', element: <TwoSteps /> },
      { path: 'email-verification', element: <EmailVerification /> },
    ],
  },
  // Panel Master (SUPERADMIN) - Login sin layout
  {
    path: '/master-panel/login',
    element: <MasterPanelLogin />,
  },
  // Panel Master (SUPERADMIN) - Rutas con layout
  {
    path: '/master-panel',
    element: <MasterPanelLayout />,
    children: [
      { path: 'dashboard', element: <MasterDashboardContent /> },
      { path: 'brokers', element: <MasterBrokersPage /> },
      { path: 'brokers/:id/editar', element: <MasterBrokerEditPage /> },
      { path: 'usuarios', element: <MasterUsuariosPage /> },
      { path: 'finanzas', element: <MasterFinanzasPage /> },
      { path: 'llamadas', element: <MasterLlamadasPage /> },
      { path: 'campanas', element: <MasterCampanasPage /> },
      { path: 'configuracion', element: <MasterConfiguracionPage /> },
      { path: 'facturacion', element: <MasterFacturacionPage /> },
      { path: 'brokers/:id/detalle', element: <MasterBrokerDetailPage /> },
      { path: 'logs', element: <MasterLogsPage /> },
      { path: '', element: <Navigate to="/master-panel/dashboard" /> },
    ],
  },
];

const router = createBrowserRouter(Router);

export default router;
