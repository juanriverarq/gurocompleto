import React, { useState } from 'react';
import { Badge, Table, Button, Tabs, Modal } from "flowbite-react";
import CardBox from 'src/components/shared/CardBox';
import Chart from 'react-apexcharts';
import ApexAreaChart from 'src/components/charts/ApexAreaChart';
import iconPhone from "/src/assets/images/svgs/icon-phone.svg";
import iconChat from "/src/assets/images/svgs/icon-dd-chat.svg";
import iconMessage from "/src/assets/images/svgs/icon-dd-message-box.svg";
import iconUser from "/src/assets/images/svgs/icon-user-male.svg";
import iconDatabase from "/src/assets/images/svgs/icon-database.svg";
import iconAccount from "/src/assets/images/svgs/icon-account.svg";
import iconOffice from "/src/assets/images/svgs/icon-office-bag.svg";
import iconConnect from "/src/assets/images/svgs/icon-connect.svg";
import iconBriefcase from "/src/assets/images/svgs/icon-briefcase.svg";
import iconDate from "/src/assets/images/svgs/icon-dd-date.svg";

const BCrumb = [
  {
    to: '/apps',
    title: 'Dashboard',
  },
  {
    to: '/apps/ia',
    title: 'IA',
  },
  {
    title: 'Gestión de Agentes',
  },
];

// Datos de ejemplo para estadísticas
const statsData = [
  {
    title: "Total de Minutos",
    value: "4,832",
    change: "+12.3%",
    color: "primary",
    icon: iconDate,
    chartData: [3200, 3450, 3800, 4100, 4250, 4500, 4832, 4950]
  },
  {
    title: "Número de Llamadas",
    value: "1,247",
    change: "+8.2%",
    color: "primary",
    icon: iconPhone,
    chartData: [800, 950, 1100, 1200, 1150, 1300, 1247, 1280]
  },
  {
    title: "Costo Total",
    value: "$2,189",
    change: "+5.7%",
    color: "primary",
    icon: iconOffice,
    chartData: [1500, 1750, 1900, 2100, 2000, 2250, 2189, 2350]
  },
  {
    title: "Costo Promedio por Llamada",
    value: "$1.75",
    change: "-2.1%",
    color: "primary",
    icon: iconAccount,
    chartData: [2.10, 1.95, 1.85, 1.78, 1.82, 1.77, 1.75, 1.73]
  },
];

// Datos para agentes (simplificados)
const agentsSimple = [
  {
    id: 1,
    name: "María González",
    status: "Activo",
    statusColor: "success",
    callsToday: 67,
    avatar: "/src/assets/images/profile/user-1.jpg"
  },
  {
    id: 2,
    name: "Carlos Rodríguez",
    status: "Ocupado",
    statusColor: "warning",
    callsToday: 45,
    avatar: "/src/assets/images/profile/user-2.jpg"
  },
  {
    id: 3,
    name: "Ana López",
    status: "Pausado",
    statusColor: "error",
    callsToday: 32,
    avatar: "/src/assets/images/profile/user-3.jpg"
  },
  {
    id: 4,
    name: "Diego Martínez",
    status: "Activo",
    statusColor: "success",
    callsToday: 78,
    avatar: "/src/assets/images/profile/user-4.jpg"
  },
];

// Datos para llamadas en curso
const activeCalls = [
  {
    id: 1,
    client: "Juan Pérez",
    agent: "María González",
    duration: "03:45",
    type: "Cotización",
    status: "En curso",
    phone: "+57 301 234 5678"
  },
  {
    id: 2,
    client: "Ana Martínez",
    agent: "Carlos Rodríguez",
    duration: "01:23",
    type: "Soporte",
    status: "En curso",
    phone: "+57 315 876 5432"
  },
  {
    id: 3,
    client: "Pedro Silva",
    agent: "Diego Martínez",
    duration: "05:12",
    type: "Renovación",
    status: "En curso",
    phone: "+57 300 987 6543"
  },
];

// Datos para llamadas pendientes
const pendingCalls = [
  {
    id: 1,
    client: "Laura Gómez",
    phone: "+57 302 456 7890",
    type: "Cotización",
    priority: "Alta",
    scheduled: "14:30",
    agent: "Pendiente"
  },
  {
    id: 2,
    client: "Ricardo Torres",
    phone: "+57 312 345 6789",
    type: "Seguimiento",
    priority: "Media",
    scheduled: "15:00",
    agent: "Pendiente"
  },
  {
    id: 3,
    client: "Carmen Ruiz",
    phone: "+57 318 765 4321",
    type: "Cobranza",
    priority: "Alta",
    scheduled: "15:30",
    agent: "Pendiente"
  },
];

// Datos para campañas
const campaigns = [
  {
    id: 1,
    name: "Campaña de Cobranza Q3",
    type: "Cobranza",
    status: "Activa",
    progress: 68,
    totalCalls: 1247,
    successRate: 34.5,
    startDate: "01/07/2024",
    endDate: "30/09/2024"
  },
  {
    id: 2,
    name: "Promoción Seguros Vehiculares",
    type: "Ventas",
    status: "Activa",
    progress: 85,
    totalCalls: 2156,
    successRate: 42.8,
    startDate: "15/06/2024",
    endDate: "15/08/2024"
  },
  {
    id: 3,
    name: "Soporte Post-Venta",
    type: "Soporte",
    status: "Programada",
    progress: 0,
    totalCalls: 0,
    successRate: 0,
    startDate: "01/08/2024",
    endDate: "31/08/2024"
  },
  {
    id: 4,
    name: "Renovación Pólizas Hogar",
    type: "Renovación",
    status: "Completada",
    progress: 100,
    totalCalls: 845,
    successRate: 78.2,
    startDate: "01/06/2024",
    endDate: "30/06/2024"
  },
];

// Datos para historial de llamadas
const callHistory = [
  {
    id: 1,
    client: "Miguel Hernández",
    agent: "María González",
    duration: "04:32",
    type: "Cotización",
    result: "Exitosa",
    time: "12:45",
    date: "Hoy"
  },
  {
    id: 2,
    client: "Sandra López",
    agent: "Carlos Rodríguez",
    duration: "02:18",
    type: "Soporte",
    result: "Exitosa",
    time: "11:30",
    date: "Hoy"
  },
  {
    id: 3,
    client: "José Ramírez",
    agent: "Ana López",
    duration: "01:45",
    type: "Información",
    result: "No contesta",
    time: "10:15",
    date: "Hoy"
  },
  {
    id: 4,
    client: "Laura Gómez",
    agent: "Diego Martínez",
    duration: "03:22",
    type: "Ventas",
    result: "Exitosa",
    time: "09:45",
    date: "Hoy"
  },
  {
    id: 5,
    client: "Ricardo Torres",
    agent: "María González",
    duration: "05:15",
    type: "Cobranza",
    result: "Exitosa",
    time: "14:20",
    date: "Ayer"
  },
];

// Detalles adicionales para las llamadas
const callDetails = {
  1: {
    client: "Miguel Hernández",
    agent: "María González",
    phone: "+57 301 234 5678",
    duration: "04:32",
    type: "Cotización",
    result: "Exitosa",
    date: "16/07/2024",
    time: "12:45",
    sentiment: "Positivo",
    satisfaction: "Alta",
    transcription: `Cliente: Buenas tardes, quisiera saber sobre las cotizaciones de seguros para mi vehículo.

Agente: Buenas tardes, gracias por contactar con nuestro servicio. ¿En qué puedo ayudarte hoy? Claro, será un placer ayudarte con la cotización de seguro vehicular.

Cliente: Tengo un automóvil modelo 2020, es un Toyota Corolla.

Agente: Perfecto, necesitaré algunos datos adicionales para generar la cotización. ¿Podrías proporcionarme el número de placa y cédula?

Cliente: Sí, claro. La placa es ABC-123 y mi cédula es 12345678.

Agente: Excelente, ya tengo la información. Te enviaré la cotización a tu correo electrónico en los próximos minutos.

Cliente: Muchas gracias, ha sido muy útil la atención.`,
    audio: "call_12345.mp3",
    notes: "Cliente muy satisfecho con el servicio. Interesado en cotización de servicio premium. Seguimiento programado para mañana.",
    tags: ["Cotización", "Vehicular", "Seguimiento"],
    callQuality: "Excelente",
    cost: "$0.45"
  },
  2: {
    client: "Sandra López",
    agent: "Carlos Rodríguez",
    phone: "+57 315 876 5432",
    duration: "02:18",
    type: "Soporte",
    result: "Exitosa",
    date: "16/07/2024",
    time: "11:30",
    sentiment: "Neutral",
    satisfaction: "Media",
    transcription: `Cliente: Hola, tengo problemas para acceder a mi póliza en línea.

Agente: Hola, ¿cómo puedo ayudarte con tu problema técnico? Entiendo que tienes dificultades para acceder a tu póliza.

Cliente: Sí, cuando intento ingresar me aparece un error.

Agente: Vamos a solucionarlo. ¿Podrías intentar limpiar el cache de tu navegador?

Cliente: Sí, ya lo hice y ahora funciona perfectamente.

Agente: Excelente, me alegra que hayamos resuelto el problema.`,
    audio: "call_12346.mp3",
    notes: "Problema técnico resuelto rápidamente. Cliente satisfecho con la solución.",
    tags: ["Soporte Técnico", "Plataforma", "Resuelto"],
    callQuality: "Buena",
    cost: "$0.23"
  },
  3: {
    client: "José Ramírez",
    agent: "Ana López",
    phone: "+57 300 987 6543",
    duration: "01:45",
    type: "Información",
    result: "No contesta",
    date: "16/07/2024",
    time: "10:15",
    sentiment: "Neutro",
    satisfaction: "Baja",
    transcription: `[Llamada no contestada - Se intentó contactar 3 veces]

Intento 1: 10:15 - No contesta
Intento 2: 10:18 - No contesta
Intento 3: 10:22 - No contesta

Se dejó mensaje de voz solicitando devolver la llamada.`,
    audio: "call_12347.mp3",
    notes: "Cliente no contestó la llamada. Se programó reintento para esta tarde.",
    tags: ["No contesta", "Reintento", "Mensaje"],
    callQuality: "N/A",
    cost: "$0.15"
  }
};

// Datos de ejemplo para agentes
const agentsData = [
  {
    id: 1,
    name: "María González",
    type: "Ventas",
    status: "Activo",
    statusColor: "success",
    callsToday: 67,
    successRate: 92.5,
    avgDuration: "4.2min",
    lastActive: "Hace 5 min",
    avatar: "/src/assets/images/profile/user-1.jpg"
  },
  {
    id: 2,
    name: "Carlos Rodríguez",
    type: "Soporte",
    status: "Ocupado",
    statusColor: "warning",
    callsToday: 45,
    successRate: 88.7,
    avgDuration: "3.8min",
    lastActive: "Activo ahora",
    avatar: "/src/assets/images/profile/user-2.jpg"
  },
  {
    id: 3,
    name: "Ana López",
    type: "Cobranza",
    status: "Pausado",
    statusColor: "error",
    callsToday: 32,
    successRate: 85.3,
    avgDuration: "5.1min",
    lastActive: "Hace 1 hora",
    avatar: "/src/assets/images/profile/user-3.jpg"
  },
  {
    id: 4,
    name: "Diego Martínez",
    type: "Ventas",
    status: "Activo",
    statusColor: "success",
    callsToday: 78,
    successRate: 94.1,
    avgDuration: "3.9min",
    lastActive: "Hace 2 min",
    avatar: "/src/assets/images/profile/user-4.jpg"
  },
  {
    id: 5,
    name: "Laura Sánchez",
    type: "Soporte",
    status: "Activo",
    statusColor: "success",
    callsToday: 56,
    successRate: 87.9,
    avgDuration: "4.5min",
    lastActive: "Activo ahora",
    avatar: "/src/assets/images/profile/user-5.jpg"
  },
];

// Datos para transacciones de créditos
const creditTransactions = [
  {
    type: "Recarga",
    amount: "+$500",
    description: "Recarga de créditos",
    time: "Hace 2 horas",
    icon: iconAccount,
    color: "primary"
  },
  {
    type: "Uso",
    amount: "-$245",
    description: "Llamadas realizadas",
    time: "Hace 4 horas",
    icon: iconPhone,
    color: "primary"
  },
  {
    type: "Recarga",
    amount: "+$1,000",
    description: "Recarga automática",
    time: "Ayer",
    icon: iconOffice,
    color: "primary"
  },
  {
    type: "Uso",
    amount: "-$189",
    description: "Servicios de IA",
    time: "Hace 1 día",
    icon: iconDatabase,
    color: "primary"
  },
];

// Componente para gráficos de estadísticas
const StatChart = ({ data, color }: { data: number[], color: string }) => {
  const chartOptions: any = {
    series: [{
      name: "",
      data: data,
    }],
    chart: {
      type: "area",
      fontFamily: `inherit`,
      foreColor: "#adb0bb",
      toolbar: {
        show: false,
      },
      sparkline: {
        enabled: true,
      },
      group: "sparklines",
    },
    colors: [`var(--color-${color})`],
    stroke: {
      curve: "smooth",
      width: 2,
    },
    fill: {
      type: "gradient",
      color: [`var(--color-${color})`],
      gradient: {
        shadeIntensity: 0,
        inverseColors: false,
        opacityFrom: 0.2,
        opacityTo: 0.8,
        stops: [100],
      },
    },
    tooltip: {
      theme: "dark",
      x: {
        format: "dd/MM/yy HH:mm",
      },
    },
  };

  return (
    <Chart
      options={chartOptions}
      series={chartOptions.series}
      type="area"
      height="100px"
      width="100%"
    />
  );
};

const ManageAIAgents = () => {
  const [showCallDetails, setShowCallDetails] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  const [showTransactions, setShowTransactions] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTimePeriod, setSelectedTimePeriod] = useState('7d');
  const campaignPerPage = 4;
  
  // Calcular campañas para la página actual
  const indexOfLastCampaign = currentPage * campaignPerPage;
  const indexOfFirstCampaign = indexOfLastCampaign - campaignPerPage;
  const currentCampaigns = campaigns.slice(indexOfFirstCampaign, indexOfLastCampaign);
  const totalPages = Math.ceil(campaigns.length / campaignPerPage);

  const handleOpenCallDetails = (callId) => {
    setSelectedCall(callDetails[callId]);
    setShowCallDetails(true);
  };

  const handleShowTransactions = () => {
    setShowTransactions(true);
  };

  const handleShowBalance = () => {
    setShowBalance(true);
  };

  const handleTimePeriodChange = (period) => {
    setSelectedTimePeriod(period);
  };

  const getTimePeriodLabel = () => {
    switch (selectedTimePeriod) {
      case '7d': return 'Últimos 7 días';
      case '1m': return 'Último mes';
      case '3m': return 'Último trimestre';
      case 'custom': return 'Fecha personalizada';
      default: return 'Últimos 7 días';
    }
  };

  // Datos simulados para el rendimiento de agentes según el período seleccionado
  const getAgentPerformanceData = () => {
    const baseData = {
      '7d': {
        categories: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
        series: [
          {
            name: 'María González (Cobranza)',
            data: [32, 28, 35, 29, 38, 31, 34]
          },
          {
            name: 'Ana Martínez (Ventas)',
            data: [145, 152, 138, 167, 159, 144, 161]
          },
          {
            name: 'Laura Sánchez (Soporte)',
            data: [101, 95, 108, 112, 98, 105, 103]
          },
          {
            name: 'Carmen López (Seguimiento)',
            data: [78, 82, 75, 89, 86, 79, 83]
          }
        ]
      },
      '1m': {
        categories: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
        series: [
          {
            name: 'María González (Cobranza)',
            data: [210, 198, 225, 234]
          },
          {
            name: 'Ana Martínez (Ventas)',
            data: [980, 1050, 1120, 1089]
          },
          {
            name: 'Laura Sánchez (Soporte)',
            data: [695, 720, 678, 712]
          },
          {
            name: 'Carmen López (Seguimiento)',
            data: [545, 578, 589, 567]
          }
        ]
      },
      '3m': {
        categories: ['Mes 1', 'Mes 2', 'Mes 3'],
        series: [
          {
            name: 'María González (Cobranza)',
            data: [867, 923, 889]
          },
          {
            name: 'Ana Martínez (Ventas)',
            data: [4239, 4567, 4321]
          },
          {
            name: 'Laura Sánchez (Soporte)',
            data: [2805, 2934, 2876]
          },
          {
            name: 'Carmen López (Seguimiento)',
            data: [2279, 2398, 2345]
          }
        ]
      },
      'custom': {
        categories: ['Período personalizado'],
        series: [
          {
            name: 'María González (Cobranza)',
            data: [450]
          },
          {
            name: 'Ana Martínez (Ventas)',
            data: [2156]
          },
          {
            name: 'Laura Sánchez (Soporte)',
            data: [1434]
          },
          {
            name: 'Carmen López (Seguimiento)',
            data: [1167]
          }
        ]
      }
    };
    
    return baseData[selectedTimePeriod] || baseData['7d'];
  };

  // Componente del gráfico de rendimiento de agentes
  const AgentPerformanceChart = () => {
    const chartData = getAgentPerformanceData();
    
    const chartOptions: any = {
      chart: {
        id: 'agent-performance-chart',
        type: 'area',
        fontFamily: 'inherit',
        foreColor: '#adb0bb',
        zoom: {
          enabled: true,
        },
        toolbar: {
          show: true,
          tools: {
            download: true,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true
          }
        },
      },
      dataLabels: {
        enabled: false,
      },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 0,
          inverseColors: false,
          opacityFrom: 0.2,
          opacityTo: 0.8,
          stops: [100]
        },
      },
      stroke: {
        width: 3,
        curve: 'smooth',
      },
      colors: ['#e74c3c', '#27ae60', '#f39c12', '#3498db'], // Colores para cada agente
      xaxis: {
        categories: chartData.categories,
        axisBorder: {
          color: "rgba(173,181,189,0.3)",
        },
        labels: {
          style: {
            colors: '#adb0bb'
          }
        }
      },
      yaxis: {
        opposite: false,
        labels: {
          show: true,
          style: {
            colors: '#adb0bb'
          }
        },
        title: {
          text: 'Llamadas Completadas',
          style: {
            color: '#adb0bb'
          }
        }
      },
      legend: {
        show: true,
        position: 'top',
        horizontalAlign: 'center',
        labels: {
          colors: '#adb0bb'
        }
      },
      grid: {
        show: true,
        borderColor: 'rgba(173,181,189,0.1)',
        strokeDashArray: 3,
      },
      tooltip: {
        theme: 'dark',
        fillSeriesColor: false,
        y: {
          formatter: function(val) {
            return val + ' llamadas';
          }
        }
      },
    };

    return (
      <Chart
        options={chartOptions}
        series={chartData.series}
        type="area"
        height="400"
        width="100%"
      />
    );
  };

  return (
    <>
      <div className="grid grid-cols-12 gap-[30px]">
        {/* Tarjetas de estadísticas */}
        <div className="col-span-12">
          <div className="grid grid-cols-12 gap-[30px]">
            {statsData.map((stat, index) => (
              <div key={index} className="lg:col-span-3 md:col-span-6 col-span-12">
                <CardBox className="p-0 overflow-hidden">
                  <div className="flex justify-between p-6 items-end">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-md flex justify-center items-center bg-lightprimary dark:bg-darkprimary">
                        <img src={stat.icon} alt="icon" className="h-6 w-6" style={{filter: 'invert(32%) sepia(72%) saturate(1945%) hue-rotate(258deg) brightness(96%) contrast(106%)'}} />
                      </div>
                      <div>
                        <h5 className="card-title">{stat.value}</h5>
                        <p className="card-subtitle">{stat.title}</p>
                      </div>
                    </div>
                    <span className={`text-${stat.color} text-sm font-medium`}>{stat.change}</span>
                  </div>
                  <StatChart data={stat.chartData} color={stat.color} />
                </CardBox>
              </div>
            ))}
          </div>
        </div>

        {/* Campañas Activas */}
        <div className="lg:col-span-8 col-span-12">
          <CardBox className="h-full">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h5 className="card-title">Campañas Activas</h5>
                <p className="card-subtitle">Gestión de campañas de llamadas</p>
              </div>
              <Button color="primary" size="sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Nueva Campaña
              </Button>
            </div>
            
            <div className="flex flex-col h-full">
              <div className="space-y-4 flex-1">
                {currentCampaigns.map((campaign) => (
                  <div key={campaign.id} className="border rounded-lg border-ld p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h6 className="text-base font-medium text-dark dark:text-white">{campaign.name}</h6>
                        <p className="text-sm text-bodytext">{campaign.startDate} - {campaign.endDate}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          color={campaign.status === 'Activa' ? 'lightsuccess' : campaign.status === 'Programada' ? 'lightwarning' : 'lightprimary'}
                          className="capitalize"
                        >
                          {campaign.status}
                        </Badge>
                        <Badge color="lightprimary">
                          {campaign.type}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-xs text-bodytext">Progreso</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                            <div 
                              className="bg-primary h-2 rounded-full transition-all duration-300" 
                              style={{ width: `${campaign.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-medium">{campaign.progress}%</span>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-bodytext">Total Llamadas</p>
                        <p className="text-base font-semibold text-dark dark:text-white">{campaign.totalCalls.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-bodytext">Tasa de Éxito</p>
                        <p className="text-base font-semibold text-success">{campaign.successRate}%</p>
                      </div>
                      <div className="text-center">
                        <Button size="xs" color="primary" outline>
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Detalles
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center mt-6 pt-4 border-t border-ld">
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      color="light" 
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </Button>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        size="sm"
                        color={currentPage === page ? "primary" : "light"}
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                    
                    <Button 
                      size="sm" 
                      color="light" 
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Button>
                  </div>
                  
                  <div className="ml-4 text-sm text-bodytext">
                    Página {currentPage} de {totalPages} • {campaigns.length} campañas en total
                  </div>
                </div>
              )}
            </div>
          </CardBox>
        </div>

        {/* Mini billetera y transacciones */}
        {/* Mini billetera y transacciones */}
        <div className="lg:col-span-4 col-span-12">
          <div className="space-y-[30px]">
            {/* Balance actual */}
            <CardBox className="relative">
              {/* Iconos de acciones - arriba a la derecha */}
              <div className="absolute top-4 right-4 flex gap-2">
                <div className="tooltip" data-tooltip="Ver historial">
                  <button 
                    onClick={handleShowTransactions}
                    className="h-10 w-10 rounded-full text-gray-500 hover:text-primary hover:bg-lightprimary flex items-center justify-center transition-colors"
                    title="Historial"
                  >
                    <img src={iconDate} alt="historial" className="h-5 w-5" />
                  </button>
                </div>
                <div className="tooltip" data-tooltip="Ver desglose">
                  <button 
                    onClick={handleShowBalance}
                    className="h-10 w-10 rounded-full text-gray-500 hover:text-primary hover:bg-lightprimary flex items-center justify-center transition-colors"
                    title="Desglose"
                  >
                    <img src={iconBriefcase} alt="desglose" className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              <div className="text-center">
                <div className={`h-16 w-16 rounded-full flex justify-center items-center bg-lightprimary dark:bg-darkprimary mx-auto mb-4`}>
                  <img src={iconOffice} alt="wallet" className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-bold text-dark dark:text-white mb-2">$2,847.50</h3>
                <p className="text-bodytext mb-6">Balance de créditos</p>
                
                <Button color="success" className="w-full">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Recargar Créditos
                </Button>
              </div>
            </CardBox>

            {/* Agentes de IA */}
            <CardBox>
              <div className="mb-6">
                <h5 className="card-title">Agentes de IA</h5>
                <p className="card-subtitle">Estado y rendimiento</p>
              </div>
              <div className="space-y-4">
                {[
                  { name: "María González", type: "Cobranza", status: "Activo", avatar: "/src/assets/images/profile/user-1.jpg", color: "error", calls: 32 },
                  { name: "Ana Martínez", type: "Ventas", status: "Activo", avatar: "/src/assets/images/profile/user-2.jpg", color: "success", calls: 145 },
                  { name: "Laura Sánchez", type: "Soporte", status: "Ocupado", avatar: "/src/assets/images/profile/user-3.jpg", color: "warning", calls: 101 },
                  { name: "Carmen López", type: "Seguimiento", status: "Activo", avatar: "/src/assets/images/profile/user-4.jpg", color: "primary", calls: 78 }
                ].map((agent, index) => (
                  <div key={index} className="flex gap-3.5 items-center">
                    <div className="h-11 w-11 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700">
                      <img src={agent.avatar} alt={agent.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <h6 className="text-base font-medium">{agent.name}</h6>
                      <p className="text-sm text-bodytext">{agent.type}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <Badge 
                          color={agent.status === 'Activo' ? 'lightsuccess' : 'lightwarning'}
                          className="capitalize"
                        >
                          {agent.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-bodytext mt-1">{agent.calls} llamadas</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardBox>

          </div>
        </div>

        {/* Historial de Llamadas */}
        <div className="col-span-12">
          <CardBox>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h5 className="card-title">Historial de Llamadas</h5>
                <p className="card-subtitle">Registro de llamadas completadas</p>
              </div>
              <Button color="primary" size="sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Nueva Llamada
              </Button>
            </div>
            <div className="border rounded-md border-ld overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="">
                  <Table.Head>
                    <Table.HeadCell className="text-base font-semibold py-3">
                      Cliente
                    </Table.HeadCell>
                    <Table.HeadCell className="text-base font-semibold py-3">
                      Agente
                    </Table.HeadCell>
                    <Table.HeadCell className="text-base font-semibold py-3">
                      Tipo
                    </Table.HeadCell>
                    <Table.HeadCell className="text-base font-semibold py-3">
                      Resultado
                    </Table.HeadCell>
                    <Table.HeadCell className="text-base font-semibold py-3">
                      Acciones
                    </Table.HeadCell>
                  </Table.Head>
                  <Table.Body className="divide-y divide-border dark:divide-darkborder">
                    {callHistory.map((call) => (
                      <Table.Row key={call.id}>
                        <Table.Cell className="whitespace-nowrap">
                          <div>
                            <h6 className="text-base font-medium">{call.client}</h6>
                            <p className="text-sm text-bodytext">{call.date} - {call.time}</p>
                          </div>
                        </Table.Cell>
                        <Table.Cell className="whitespace-nowrap">
                          <p className="text-bodytext text-base">{call.agent}</p>
                        </Table.Cell>
                        <Table.Cell className="whitespace-nowrap">
                          <Badge color="lightprimary" className="capitalize">
                            {call.type}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Badge 
                              color={call.result === 'Exitosa' ? 'lightsuccess' : 'lighterror'}
                              className="capitalize"
                            >
                              {call.result}
                            </Badge>
                            <span className="text-sm text-bodytext">{call.duration}</span>
                          </div>
                        </Table.Cell>
                        <Table.Cell className="whitespace-nowrap">
                          <Button 
                            size="xs" 
                            color="primary" 
                            onClick={() => handleOpenCallDetails(call.id)}
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Ver
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            </div>
          </CardBox>
        </div>

        {/* Gráfico de rendimiento */}
        <div className="col-span-12">
          <CardBox>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h5 className="card-title">Rendimiento de Agentes - {getTimePeriodLabel()}</h5>
                <p className="card-subtitle">Llamadas completadas por día</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={() => handleTimePeriodChange('7d')} 
                  color={selectedTimePeriod === '7d' ? 'primary' : 'light'}
                >
                  7 Días
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => handleTimePeriodChange('1m')} 
                  color={selectedTimePeriod === '1m' ? 'primary' : 'light'}
                >
                  Mes
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => handleTimePeriodChange('3m')} 
                  color={selectedTimePeriod === '3m' ? 'primary' : 'light'}
                >
                  Trimestre
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => handleTimePeriodChange('custom')} 
                  color={selectedTimePeriod === 'custom' ? 'primary' : 'light'}
                >
                  Personalizada
                </Button>
              </div>
            </div>
            <AgentPerformanceChart />
          </CardBox>
        </div>
      </div>

      {/* Modal para detalles de llamada */}
      <Modal show={showCallDetails} onClose={() => setShowCallDetails(false)} size="6xl">
        <Modal.Header>
          <h3 className="text-xl font-semibold">Detalles de Llamada</h3>
        </Modal.Header>
        <Modal.Body>
          {selectedCall && (
            <div className="space-y-6">
              {/* Información básica */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Información General</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Cliente:</span>
                        <span className="text-sm font-medium">{selectedCall.client}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Agente:</span>
                        <span className="text-sm font-medium">{selectedCall.agent}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Teléfono:</span>
                        <span className="text-sm font-medium">{selectedCall.phone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Fecha:</span>
                        <span className="text-sm font-medium">{selectedCall.date}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Hora:</span>
                        <span className="text-sm font-medium">{selectedCall.time}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Duración:</span>
                        <span className="text-sm font-medium">{selectedCall.duration}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Métricas</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Tipo:</span>
                        <Badge color="lightprimary">{selectedCall.type}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Resultado:</span>
                        <Badge color={selectedCall.result === 'Exitosa' ? 'lightsuccess' : 'lighterror'}>
                          {selectedCall.result}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Sentimiento:</span>
                        <span className="text-sm font-medium">{selectedCall.sentiment}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Satisfacción:</span>
                        <span className="text-sm font-medium">{selectedCall.satisfaction}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Calidad:</span>
                        <span className="text-sm font-medium">{selectedCall.callQuality}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Costo:</span>
                        <span className="text-sm font-medium text-green-600">{selectedCall.cost}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reproductor de audio */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Audio de la Llamada</h4>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <Button size="sm" color="primary">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h6l-3-3m0 6l3-3m-3 3V4" />
                      </svg>
                      Reproducir
                    </Button>
                    <div className="flex-1">
                      <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                        <div className="bg-primary h-2 rounded-full" style={{ width: '45%' }}></div>
                      </div>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">2:04 / {selectedCall.duration}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Archivo: {selectedCall.audio}</p>
                </div>
              </div>

              {/* Transcripción */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Transcripción</h4>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg max-h-60 overflow-y-auto">
                  <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
                    {selectedCall.transcription}
                  </pre>
                </div>
              </div>

              {/* Notas y etiquetas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Notas</h4>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{selectedCall.notes}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Etiquetas</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedCall.tags.map((tag, index) => (
                      <Badge key={index} color="lightprimary">{tag}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <div className="flex justify-end space-x-2">
            <Button color="gray" onClick={() => setShowCallDetails(false)}>
              Cerrar
            </Button>
            <Button color="primary">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m-6 1h6" />
              </svg>
              Descargar
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Modal para transacciones */}
      <Modal show={showTransactions} onClose={() => setShowTransactions(false)} size="4xl">
        <Modal.Header>
          <h3 className="text-xl font-semibold">Historial de Transacciones</h3>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            {creditTransactions.map((transaction, index) => (
              <div key={index} className="flex gap-3.5 items-center border-b border-gray-200 dark:border-gray-700 pb-4">
                <div className={`h-12 w-12 rounded-md flex justify-center items-center bg-light${transaction.color} dark:bg-dark${transaction.color}`}>
                  <img src={transaction.icon} alt="icon" className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h6 className="text-base font-medium">{transaction.type}</h6>
                  <p className="text-sm text-bodytext">{transaction.description}</p>
                  <p className="text-xs text-bodytext">{transaction.time}</p>
                </div>
                <div className={`font-medium text-lg ${transaction.color === 'success' || transaction.color === 'primary' ? 'text-success' : 'text-error'}`}>
                  {transaction.amount}
                </div>
              </div>
            ))}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex justify-end space-x-2">
            <Button color="gray" onClick={() => setShowTransactions(false)}>
              Cerrar
            </Button>
            <Button color="primary">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m-6 1h6" />
              </svg>
              Exportar
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Modal para desglose de balance */}
      <Modal show={showBalance} onClose={() => setShowBalance(false)} size="4xl">
        <Modal.Header>
          <h3 className="text-xl font-semibold">Desglose de Balance</h3>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-dark dark:text-white mb-2">$2,847.50</h2>
              <p className="text-bodytext">Balance actual de créditos</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Uso por Servicio</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Llamadas salientes</span>
                    <span className="text-sm font-medium">$1,234.50</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Procesamiento IA</span>
                    <span className="text-sm font-medium">$567.89</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Transcripción</span>
                    <span className="text-sm font-medium">$234.12</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">SMS</span>
                    <span className="text-sm font-medium">$45.67</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Estadísticas del Mes</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Gasto promedio diario</span>
                    <span className="text-sm font-medium">$89.50</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Días restantes</span>
                    <span className="text-sm font-medium">32 días</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Proyección mensual</span>
                    <span className="text-sm font-medium">$2,685.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Ahorro vs mes anterior</span>
                    <span className="text-sm font-medium text-success">+$156.30</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex justify-end space-x-2">
            <Button color="gray" onClick={() => setShowBalance(false)}>
              Cerrar
            </Button>
            <Button color="primary">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Recargar Créditos
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ManageAIAgents;
