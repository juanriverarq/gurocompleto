// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import Loadable from '../layouts/full/shared/loadable/Loadable';
import TrialExpired from '../views/saas/billing/TrialExpired';
import FrontendLayout from 'src/layouts/blank/FrontendLayout';
import ProtectedRoute from '../components/ProtectedRoute';

/* ***Layouts**** */
const FullLayout = Loadable(lazy(() => import('../layouts/full/FullLayout')));
const UnifiedProtectedFullLayout = Loadable(
  lazy(() => import('../layouts/full/UnifiedProtectedFullLayout')),
);
const BlankLayout = Loadable(lazy(() => import('../layouts/blank/BlankLayout')));

/* ****Pages***** */
const TerminosCondiciones = Loadable(lazy(() => import('../views/pages/TerminosCondiciones')));
const PoliticaPrivacidad = Loadable(lazy(() => import('../views/pages/PoliticaPrivacidad')));
const Regalo = Loadable(lazy(() => import('../views/pages/Regalo')));

/* ****Apps***** */
const CombinedDashboard = Loadable(lazy(() => import('../views/combined/CombinedDashboard')));

// authentication
const Login = Loadable(lazy(() => import('../views/authentication/auth1/Login')));
const Register = Loadable(lazy(() => import('../views/authentication/auth1/Register')));
const ForgotPassword = Loadable(lazy(() => import('../views/authentication/auth1/ForgotPassword')));
const TwoSteps = Loadable(lazy(() => import('../views/authentication/auth1/TwoSteps')));
const EmailVerification = Loadable(
  lazy(() => import('../views/authentication/auth1/EmailVerification')),
);
const Maintainance = Loadable(lazy(() => import('../views/authentication/Maintainance')));

// SaaS Authentication
const SaasLogin = Loadable(lazy(() => import('../views/auth/Login')));

// Email Verification
const VerificationPrompt = Loadable(lazy(() => import('../pages/VerificationPrompt')));
// Wallet Return
const WalletReturn = Loadable(lazy(() => import('../pages/WalletReturn')));

// SaaS Onboarding
const CreateBroker = Loadable(lazy(() => import('../views/saas/onboarding/CreateBroker')));

// SaaS Transitional/Building screen
const DashboardBuilding = Loadable(lazy(() => import('../views/saas/dashboard/DashboardBuilding')));

// SaaS Apps
const SaasDashboard = Loadable(lazy(() => import('../views/saas/dashboard/Dashboard')));
const SaasNuevoCliente = Loadable(lazy(() => import('../views/saas/clientes/NuevoCliente')));
const SaasDetalleCliente = Loadable(lazy(() => import('../views/saas/clientes/DetalleCliente')));
const SaasEditarCliente = Loadable(lazy(() => import('../views/saas/clientes/EditarCliente')));
const SaasListaEmpleados = Loadable(lazy(() => import('../views/saas/empleados/ListaEmpleados')));
const SaasNuevoEmpleado = Loadable(lazy(() => import('../views/saas/empleados/NuevoEmpleado')));
const SaasEditarEmpleado = Loadable(lazy(() => import('../views/saas/empleados/EditarEmpleado')));
const SaasListaLeads = Loadable(lazy(() => import('../views/saas/sales-funnel/ListaLeads')));
const SaasKanbanLeads = Loadable(
  lazy(() => import('../views/saas/sales-funnel/SalesFunnelKanban')),
);
const SaasNuevoLead = Loadable(lazy(() => import('../views/saas/sales-funnel/NuevoLead')));
const SaasDetalleLead = Loadable(lazy(() => import('../views/saas/sales-funnel/DetalleLead')));
const SaasEditarLead = Loadable(lazy(() => import('../views/saas/sales-funnel/EditarLead')));
const SaasListaTareas = Loadable(lazy(() => import('../views/saas/commercial-tasks/ListaTareas')));
const SaasNuevaTarea = Loadable(lazy(() => import('../views/saas/commercial-tasks/NuevaTarea')));
const SaasDetalleTarea = Loadable(
  lazy(() => import('../views/saas/commercial-tasks/DetalleTarea')),
);
const SaasEditarTarea = Loadable(lazy(() => import('../views/saas/commercial-tasks/EditarTarea')));
const ConfiguracionMasiva = Loadable(
  lazy(() => import('../views/saas/configuracion-masiva/ConfiguracionMasiva')),
);

// Calendar
const CalendarPage = Loadable(lazy(() => import('../views/apps/calendar/CalendarPage')));

// Pricing page
const PricingCalculatorPage = Loadable(lazy(() => import('../views/pages/PricingCalculatorPage')));

// Checkout (Frontend)
const Checkout = Loadable(lazy(() => import('../views/pages/frontend-pages/Checkout')));

// Onboarding Flow (Nuevo flujo de compra simplificado)
const SelectAppsFlow = Loadable(lazy(() => import('../views/pages/onboarding/SelectAppsFlow')));
const SignupFlow = Loadable(lazy(() => import('../views/pages/onboarding/SignupFlow')));

// Landing Page
const LandingPages = Loadable(lazy(() => import('../views/pages/landingpages/LandingPages')));

const Error = Loadable(lazy(() => import('../views/authentication/Error')));

// Seguros Apps
const Polizas = Loadable(lazy(() => import('../views/apps/seguros/polizas/Polizas')));
const Automoviles = Loadable(lazy(() => import('../views/apps/seguros/automoviles/Automoviles')));
const NuevaPoliza = Loadable(lazy(() => import('../views/apps/seguros/polizas/NuevaPoliza')));
const NuevaPolizaColectiva = Loadable(
  lazy(() => import('../views/apps/seguros/polizas/NuevaPolizaColectiva')),
);
const EditarPoliza = Loadable(lazy(() => import('../views/apps/seguros/polizas/EditarPoliza')));
const Clientes = Loadable(lazy(() => import('../views/apps/seguros/clientes/Clientes')));
const NuevoCliente = Loadable(lazy(() => import('../views/apps/seguros/clientes/NuevoCliente')));
const EditarCliente = Loadable(lazy(() => import('../views/apps/seguros/clientes/EditarCliente')));
const Siniestros = Loadable(lazy(() => import('../views/apps/seguros/siniestros/Siniestros')));
const SiniestrosActivos = Loadable(
  lazy(() => import('../views/apps/seguros/siniestros/SiniestrosActivos')),
);
const NuevoSiniestro = Loadable(
  lazy(() => import('../views/apps/seguros/siniestros/NuevoSiniestroMejorado')),
);
const EditarSiniestro = Loadable(
  lazy(() => import('../views/apps/seguros/siniestros/EditarSiniestro')),
);
const Renovaciones = Loadable(
  lazy(() => import('../views/apps/seguros/renovaciones/Renovaciones')),
);
const Seguimiento = Loadable(lazy(() => import('../views/apps/seguros/seguimiento/Seguimiento')));

// IA Apps
const AsistenteIA = Loadable(lazy(() => import('../views/apps/ia/asistente/AsistenteDeepSeek')));
const VentasCruzadas = Loadable(
  lazy(() => import('../views/apps/ia/ventas-cruzadas/VentasCruzadas')),
);
const Predicciones = Loadable(
  lazy(() => import('../views/apps/ia/analisis-predictivo/Predicciones')),
);
const AnalisisPrediccion = Loadable(
  lazy(() => import('../views/apps/ia/analisis-predictivo/AnalisisPrediccion')),
);
const RecomendacionesProducto = Loadable(
  lazy(() => import('../views/apps/ia/recomendaciones/RecomendacionesProducto')),
);

// Voice AI
const VoiceAIDashboard = Loadable(lazy(() => import('../views/voice-ai/VoiceAIDashboard')));
const Perfil = Loadable(lazy(() => import('../views/apps/account/Perfil')));

// RRHH Apps
const RecursosHumanos = Loadable(lazy(() => import('../views/apps/rrhh/RecursosHumanos')));
const NuevaVacante = Loadable(lazy(() => import('../views/apps/rrhh/NuevaVacante')));
const EditarVacante = Loadable(lazy(() => import('../views/apps/rrhh/EditarVacante')));
const Personas = Loadable(lazy(() => import('../views/apps/rrhh/Personas')));
const Reclutamiento = Loadable(lazy(() => import('../views/apps/rrhh/Reclutamiento')));
const Desempeno = Loadable(lazy(() => import('../views/apps/rrhh/Desempeno')));
const Clima = Loadable(lazy(() => import('../views/apps/rrhh/Clima')));

// Marketing Apps
const EnlacesCotizacion = Loadable(
  lazy(() => import('../views/apps/marketing/enlaces-cotizacion/EnlacesCotizacion')),
);
const Plantillas = Loadable(lazy(() => import('../views/apps/marketing/plantillas/Plantillas')));
const MiniWeb = Loadable(lazy(() => import('../views/apps/marketing/mini-web/MiniWeb')));
const MiniWebPublic = Loadable(lazy(() => import('../views/public/MiniWebPublic')));
const QuoteForm = Loadable(lazy(() => import('../views/public/QuoteForm')));

// Admin Apps
const Usuarios = Loadable(lazy(() => import('../views/apps/admin/usuarios/Usuarios')));
const Roles = Loadable(lazy(() => import('../views/apps/admin/roles/Roles')));
const DemoPermisosLoadable = Loadable(
  lazy(() => import('../views/apps/admin/demo-permisos/DemoPermisos')),
);
const InformacionAgencia = Loadable(
  lazy(() => import('../views/apps/admin/informacion-agencia/InformacionAgencia')),
);
const Sedes = Loadable(lazy(() => import('../views/apps/admin/sedes/Sedes')));
const Aseguradoras = Loadable(lazy(() => import('../views/apps/admin/aseguradoras/Aseguradoras')));
const Ramos = Loadable(lazy(() => import('../views/apps/admin/ramos/Ramos')));
const Vendedores = Loadable(lazy(() => import('../views/apps/admin/vendedores/Vendedores')));
const EstadosSiniestros = Loadable(
  lazy(() => import('../views/apps/admin/estados-siniestros/EstadosSiniestros')),
);
const EstadosARL = Loadable(lazy(() => import('../views/apps/admin/estados-arl/EstadosARL')));
const MotivosEstadosPoliza = Loadable(
  lazy(() => import('../views/apps/admin/motivos-estados-poliza/MotivosEstadosPoliza')),
);
const TipoAfiliacion = Loadable(
  lazy(() => import('../views/apps/admin/tipo-afiliacion/TipoAfiliacion')),
);
const Mensajeros = Loadable(lazy(() => import('../views/apps/admin/mensajeros/Mensajeros')));
const Coberturas = Loadable(lazy(() => import('../views/apps/admin/coberturas/Coberturas')));
const ImportacionMasiva = Loadable(lazy(() => import('../views/apps/admin/ImportacionMasiva')));
const ImportacionMultiple = Loadable(lazy(() => import('../views/apps/admin/ImportacionMultiple')));

// Configuración del Sistema Apps
const AuditoriaAccesos = Loadable(
  lazy(() => import('../views/apps/admin/auditoria/AuditoriaAccesos')),
);
const FirmaElectronica = Loadable(lazy(() => import('../views/apps/admin/firma/FirmaElectronica')));
const SeguridadDosFactores = Loadable(
  lazy(() => import('../views/apps/admin/2fa/SeguridadDosFactores')),
);
const CopiasSeguridad = Loadable(lazy(() => import('../views/apps/admin/backup/CopiasSeguridad')));

// Comisiones y Cartera Apps
const ComisionesPorPoliza = Loadable(
  lazy(() => import('../views/apps/comisiones/ComisionesPorPoliza')),
);
const AnticiposAjustes = Loadable(lazy(() => import('../views/apps/comisiones/AnticiposAjustes')));
const CarteraClientes = Loadable(lazy(() => import('../views/apps/cartera/CarteraClientes')));
const ReciboCaja = Loadable(lazy(() => import('../views/apps/cartera/ReciboCaja')));
const ReportesFinancieros = Loadable(
  lazy(() => import('../views/apps/cartera/ReportesFinancieros')),
);
const LiquidarVendedores = Loadable(lazy(() => import('../views/apps/cartera/LiquidarVendedores')));

// Billing Apps
const MisFacturas = Loadable(lazy(() => import('../views/apps/billing/MisFacturas')));
const MiSuscripcion = Loadable(lazy(() => import('../views/apps/billing/MiSuscripcion')));
const UpgradePlan = Loadable(lazy(() => import('../views/apps/billing/UpgradePlan')));

// Gestión Comercial Apps
const MetasObjetivos = Loadable(lazy(() => import('../views/apps/comercial/MetasObjetivos')));
const EquiposVentas = Loadable(lazy(() => import('../views/apps/comercial/EquiposVentas')));
const Rendimiento = Loadable(lazy(() => import('../views/apps/comercial/rendimiento/Rendimiento')));

// Gestión Legal Apps
const Contratos = Loadable(lazy(() => import('../views/apps/legal/contratos/Contratos')));
const DocumentosCliente = Loadable(
  lazy(() => import('../views/apps/legal/documentos-cliente/DocumentosCliente')),
);
const DocumentosPoliza = Loadable(
  lazy(() => import('../views/apps/seguros/documentos-poliza/DocumentosPoliza')),
);
const DocumentosSiniestro = Loadable(
  lazy(() => import('../views/apps/seguros/documentos-siniestro/DocumentosSiniestro')),
);
const DocumentosInternos = Loadable(
  lazy(() => import('../views/apps/legal/documentos-internos/DocumentosInternos')),
);

// Integraciones Apps
const ApisAseguradoras = Loadable(
  lazy(() => import('../views/apps/integraciones/apis-aseguradoras/ApisAseguradoras')),
);
const Webhooks = Loadable(lazy(() => import('../views/apps/integraciones/webhooks/Webhooks')));
const BasesDatos = Loadable(
  lazy(() => import('../views/apps/integraciones/bases-datos/BasesDatos')),
);
const ServiciosTerceros = Loadable(
  lazy(() => import('../views/apps/integraciones/servicios-terceros/ServiciosTerceros')),
);

// Mobile Auth
const MobileAuthPage = Loadable(lazy(() => import('../pages/MobileAuth')));
const EmpleadoLogin = Loadable(lazy(() => import('../views/auth/EmpleadoLogin')));

// Test Components
const TestWelcomeModal = Loadable(lazy(() => import('../components/TestWelcomeModal')));

const Router = [
  // Landing Page como página principal
  {
    path: '/',
    element: <BlankLayout />,
    children: [
      { path: '/', element: <LandingPages /> },
      { path: '/regalo', element: <Regalo /> },
      { path: '/terminos-condiciones', element: <TerminosCondiciones /> },
      { path: '/politica-privacidad', element: <PoliticaPrivacidad /> },
      // Transitional route while SaaS contexto/tenant se termina de resolver
      { path: '/dashboard-building', element: <DashboardBuilding /> },
    ],
  },
  // Dashboard bajo /apps
  {
    path: '/apps',
    element: <UnifiedProtectedFullLayout />,
    children: [
      { path: '/apps/', exact: true, element: <CombinedDashboard /> },

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
      { path: '/apps/ia/analisis-predictivo/predicciones', element: <Predicciones /> },
      { path: '/apps/ia/analisis-predictivo/predicciones/:id', element: <AnalisisPrediccion /> },
      { path: '/apps/ia/recomendaciones-producto', element: <RecomendacionesProducto /> },

      // ElevenLabs Dashboard Routes
      { path: '/apps/voice-ai/dashboard', element: <VoiceAIDashboard /> },
      // Cuenta / Perfil
      { path: '/apps/account/perfil', element: <Perfil /> },

      // Marketing Routes
      { path: '/apps/marketing/enlaces-cotizacion', element: <EnlacesCotizacion /> },
      { path: '/apps/marketing/plantillas', element: <Plantillas /> },
      { path: '/apps/marketing/mini-web', element: <MiniWeb /> },

      // Admin Routes
      { path: '/apps/admin/usuarios', element: <Usuarios /> },
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
      // Comisiones y Cartera Routes
      { path: '/apps/comisiones/por-poliza', element: <ComisionesPorPoliza /> },
      { path: '/apps/comisiones/anticipos-ajustes', element: <AnticiposAjustes /> },
      { path: '/apps/cartera/clientes', element: <CarteraClientes /> },
      { path: '/apps/cartera/liquidar-vendedores', element: <LiquidarVendedores /> },
      { path: '/apps/cartera/reportes-financieros', element: <ReportesFinancieros /> },

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

      { path: '*', element: <Navigate to="/auth/404" /> },
    ],
  },
  // Páginas adicionales
  {
    path: '/',
    element: <BlankLayout />,
    children: [
      // Recibo de Caja - Sin header para impresión
      { path: '/apps/cartera/recibo-caja/:id', element: <ReciboCaja /> },
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
      // Nuevo flujo de onboarding simplificado
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
      { path: '/auth/register', element: <Register /> },
      { path: '/auth/forgot-password', element: <ForgotPassword /> },
      { path: '/auth/two-steps', element: <TwoSteps /> },
      { path: '/auth/email-verification', element: <EmailVerification /> },

      // Email Verification
      { path: '/auth/verification-prompt', element: <VerificationPrompt /> },
      { path: '/wallet/return', element: <WalletReturn /> },

      // Mobile Auth
      { path: '/auth/mobile', element: <MobileAuthPage /> },

      // SaaS Onboarding (opcional)
      { path: '/onboarding/create-broker', element: <CreateBroker /> },

      { path: '/auth/auth1/login', element: <Login /> },
      { path: '/auth/auth1/register', element: <Register /> },
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
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'forgot-password', element: <ForgotPassword /> },
      { path: 'two-steps', element: <TwoSteps /> },
      { path: 'email-verification', element: <EmailVerification /> },
    ],
  },
];

const router = createBrowserRouter(Router);

export default router;
