import React, { useState, useRef } from 'react';
import {
  Card,
  Button,
  Label,
  Select,
  Spinner,
  Progress,
  Modal,
  Tooltip,
} from 'flowbite-react';
import { Icon } from '@iconify/react';

interface VehicleData {
  placa: string;
  marca: string;
  linea: string;
  modelo: string;
  cilindraje: string;
  tipoVehiculo: string;
  uso: string;
  ciudad: string;
  valorComercial: string;
  nombre: string;
  celular: string;
  email: string;
}

interface InsuranceQuote {
  id: string;
  company: string;
  plan: string;
  monthlyPrice: number;
  annualPrice: number;
  deductible: string;
  coverage: string[];
  benefits: string[];
  exclusions: string[];
  rating: number;
  popular?: boolean;
  discount?: number;
  recommended?: boolean;
}

interface CompanyConfig {
  name: string;
  color: string;
  enabled: boolean;
  apiKey: string;
}

const COMPANY_LOGOS: Record<string, { url: string; color: string }> = {
  'SURA': { url: 'https://images.seeklogo.com/logo-png/32/1/sura-logo-png_seeklogo-328191.png', color: '#0033A0' },
  'Seguros Bolívar': { url: 'https://d1yjjnpx0p53s8.cloudfront.net/styles/logo-thumbnail/s3/032019/seguros_bolivar.jpg?Kv_sRIqG71PgCVryIyJxZ48DlEBN3xJt&itok=YAoRdSt8', color: '#00529B' },
  'HDI Seguros': { url: 'https://www.hdi.cl/media/506086/microsoftteams-image-58.png', color: '#006747' },
  'Allianz': { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Allianz.svg/1280px-Allianz.svg.png', color: '#003781' },
  'MAPFRE': { url: 'https://images.seeklogo.com/logo-png/19/1/mapfre-logo-png_seeklogo-192716.png', color: '#DA291C' },
  'AXA Colpatria': { url: 'https://1000logos.net/wp-content/uploads/2017/12/Color-Axa-logo.jpg', color: '#00008F' },
  'La Previsora': { url: 'https://www.funcionpublica.gov.co/documents/d/guest/logo-previsora_mesa-de-trabajo-1-png', color: '#1B4F72' },
  'Seguros Mundial': { url: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Logo_mundial_seguros.png', color: '#E74C3C' },
  'Seguros del Estado': { url: 'https://logo.clearbit.com/segurosdelestado.com', color: '#2E86AB' },
  'Equidad Seguros': { url: 'https://logo.clearbit.com/laequidadseguros.coop', color: '#27AE60' },
};

const CompanyLogo: React.FC<{ name: string; size?: 'sm' | 'md' | 'lg'; className?: string }> = ({ 
  name, 
  size = 'md',
  className = '' 
}) => {
  const [imageError, setImageError] = useState(false);
  const company = COMPANY_LOGOS[name];
  const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-14 h-14 text-lg',
    lg: 'w-16 h-16 text-xl',
  };

  if (!company || imageError) {
    return (
      <div 
        className={`${sizeClasses[size]} rounded-xl flex items-center justify-center font-bold text-white ${className}`}
        style={{ backgroundColor: company?.color || '#6366f1' }}
      >
        {name.split(' ').map(w => w[0]).join('').slice(0, 2)}
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center p-2 ${className}`}>
      <img
        src={company.url}
        alt={name}
        className="max-w-full max-h-full object-contain"
        onError={() => setImageError(true)}
      />
    </div>
  );
};

const INSURANCE_COMPANIES: InsuranceQuote[] = [
  {
    id: 'sura-1',
    company: 'SURA',
    plan: 'Plan Premium',
    monthlyPrice: 185000,
    annualPrice: 1998000,
    deductible: '0%',
    coverage: ['Todo riesgo', 'Asistencia 24/7', 'Vehículo de reemplazo', 'Cobertura internacional'],
    benefits: ['Sin deducible', 'Conductor elegido', 'Grúa ilimitada', 'Talleres premium', 'App móvil'],
    exclusions: ['Daños por guerra', 'Uso comercial no declarado', 'Conductor sin licencia'],
    rating: 4.8,
    popular: true,
    discount: 15,
    recommended: true,
  },
  {
    id: 'sura-2',
    company: 'SURA',
    plan: 'Plan Básico',
    monthlyPrice: 125000,
    annualPrice: 1350000,
    deductible: '10%',
    coverage: ['Daños a terceros', 'Robo total', 'Asistencia en carretera'],
    benefits: ['Asistencia vial básica', 'Grúa hasta 50km', 'Cerrajería'],
    exclusions: ['Daños propios', 'Pérdida parcial', 'Accesorios no declarados'],
    rating: 4.5,
  },
  {
    id: 'bolivar-1',
    company: 'Seguros Bolívar',
    plan: 'Auto Total Plus',
    monthlyPrice: 175000,
    annualPrice: 1890000,
    deductible: '5%',
    coverage: ['Todo riesgo', 'Asistencia vial', 'Conductor elegido', 'Grúa ilimitada'],
    benefits: ['Deducible bajo', 'Carro taller', 'Gastos de transporte', 'Amparo patrimonial'],
    exclusions: ['Daños intencionales', 'Carreras o competencias', 'Conductor ebrio'],
    rating: 4.7,
    discount: 10,
  },
  {
    id: 'bolivar-2',
    company: 'Seguros Bolívar',
    plan: 'Auto Esencial',
    monthlyPrice: 98000,
    annualPrice: 1058000,
    deductible: '15%',
    coverage: ['Responsabilidad civil', 'Robo total', 'Asistencia básica'],
    benefits: ['Precio económico', 'Cobertura esencial', 'Asistencia 24/7'],
    exclusions: ['Daños propios', 'Pérdida parcial', 'Accesorios'],
    rating: 4.3,
  },
  {
    id: 'hdi-1',
    company: 'HDI Seguros',
    plan: 'HDI Premium',
    monthlyPrice: 168000,
    annualPrice: 1814000,
    deductible: '5%',
    coverage: ['Todo riesgo', 'Asistencia 24/7', 'Amparo patrimonial', 'Gastos médicos'],
    benefits: ['Red de talleres amplia', 'Conductor elegido', 'Vehículo de reemplazo 15 días'],
    exclusions: ['Uso diferente al declarado', 'Modificaciones no autorizadas'],
    rating: 4.6,
    popular: true,
  },
  {
    id: 'hdi-2',
    company: 'HDI Seguros',
    plan: 'HDI Básico',
    monthlyPrice: 89000,
    annualPrice: 961000,
    deductible: '20%',
    coverage: ['Responsabilidad civil', 'Pérdida total', 'Asistencia vial'],
    benefits: ['Muy económico', 'Cobertura básica completa'],
    exclusions: ['Daños parciales', 'Accesorios', 'Gastos médicos'],
    rating: 4.2,
  },
  {
    id: 'allianz-1',
    company: 'Allianz',
    plan: 'Auto Integral',
    monthlyPrice: 195000,
    annualPrice: 2106000,
    deductible: '0%',
    coverage: ['Todo riesgo', 'Cobertura mundial', 'Vehículo sustituto', 'Conductor profesional'],
    benefits: ['Cobertura internacional', 'Sin deducible', 'Talleres certificados', 'App premium'],
    exclusions: ['Daños por guerra', 'Uso comercial no declarado'],
    rating: 4.9,
    discount: 20,
    recommended: true,
  },
  {
    id: 'mapfre-1',
    company: 'MAPFRE',
    plan: 'Auto Premium',
    monthlyPrice: 178000,
    annualPrice: 1922000,
    deductible: '5%',
    coverage: ['Todo riesgo', 'Asistencia global', 'Carro taller', 'Conductor elegido'],
    benefits: ['Respaldo internacional', 'Carro taller móvil', 'Conductor elegido 24/7'],
    exclusions: ['Uso comercial', 'Modificaciones estructurales'],
    rating: 4.6,
  },
  {
    id: 'axa-1',
    company: 'AXA Colpatria',
    plan: 'AXA Total',
    monthlyPrice: 165000,
    annualPrice: 1782000,
    deductible: '5%',
    coverage: ['Todo riesgo', 'Asistencia 24/7', 'Gastos médicos', 'Responsabilidad civil'],
    benefits: ['Gastos médicos ocupantes', 'Asistencia jurídica', 'Grúa ilimitada'],
    exclusions: ['Daños por negligencia', 'Accesorios no declarados'],
    rating: 4.4,
    discount: 12,
  },
  {
    id: 'previsora-1',
    company: 'La Previsora',
    plan: 'Auto Protegido',
    monthlyPrice: 135000,
    annualPrice: 1458000,
    deductible: '10%',
    coverage: ['Todo riesgo', 'Asistencia vial', 'Amparo patrimonial'],
    benefits: ['Precio competitivo', 'Amparo patrimonial', 'Red de talleres'],
    exclusions: ['Uso diferente al declarado', 'Conductor menor de edad'],
    rating: 4.3,
  },
  {
    id: 'mundial-1',
    company: 'Seguros Mundial',
    plan: 'Mundial Plus',
    monthlyPrice: 142000,
    annualPrice: 1534000,
    deductible: '10%',
    coverage: ['Todo riesgo', 'Asistencia en carretera', 'Gastos legales'],
    benefits: ['Gastos legales incluidos', 'Asistencia nacional', 'Precio accesible'],
    exclusions: ['Daños intencionales', 'Uso comercial'],
    rating: 4.2,
  },
];

type Step = 'placa' | 'datos' | 'loading' | 'results';
type ViewMode = 'grid' | 'list';

const MARCAS = [
  'Chevrolet', 'Renault', 'Mazda', 'Kia', 'Hyundai', 'Toyota', 'Nissan', 
  'Ford', 'Volkswagen', 'Suzuki', 'BMW', 'Mercedes-Benz', 'Audi', 'Honda',
  'Jeep', 'Mitsubishi', 'Peugeot', 'Citroën', 'Fiat', 'Chery', 'JAC'
];

const CIUDADES = [
  'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga',
  'Pereira', 'Manizales', 'Cúcuta', 'Ibagué', 'Santa Marta', 'Villavicencio'
];

const TIPOS_VEHICULO = [
  { value: 'automovil', label: 'Automóvil' },
  { value: 'camioneta', label: 'Camioneta' },
  { value: 'pickup', label: 'Pick Up' },
  { value: 'suv', label: 'SUV' },
  { value: 'moto', label: 'Motocicleta' },
];

const USOS = [
  { value: 'particular', label: 'Particular' },
  { value: 'publico', label: 'Servicio Público' },
  { value: 'comercial', label: 'Comercial' },
];

const LicensePlateInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isValid: boolean;
}> = ({ value, onChange, onSubmit, isValid }) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = value.padEnd(6, '').split('').slice(0, 6);

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newChars = [...chars];
      if (chars[index]) {
        // Si hay un carácter en el campo actual, borrarlo
        newChars[index] = '';
        onChange(newChars.join('').trimEnd());
      } else if (index > 0) {
        // Si el campo está vacío, ir al anterior y borrarlo
        newChars[index - 1] = '';
        onChange(newChars.join('').trimEnd());
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'Enter' && isValid) {
      onSubmit();
    }
  };

  const handleChange = (index: number, char: string) => {
    const newChar = char.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!newChar) return;
    
    const newChars = [...chars];
    newChars[index] = newChar.slice(-1);
    onChange(newChars.join(''));
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* Placa colombiana estilo realista */}
        <div 
          className="relative rounded-xl shadow-2xl"
          style={{
            background: '#F7C600',
            padding: '6px',
          }}
        >
          {/* Borde interior negro con esquinas redondeadas */}
          <div 
            className="rounded-lg px-4 py-3 relative"
            style={{
              background: '#F7C600',
              border: '3px solid #1a1a1a',
              borderRadius: '10px',
            }}
          >
            {/* Tornillos superiores */}
            <div className="absolute w-3 h-3 rounded-full bg-gray-800 opacity-50" style={{ top: '8px', left: '10px' }} />
            <div className="absolute w-3 h-3 rounded-full bg-gray-800 opacity-50" style={{ top: '8px', right: '10px' }} />
            
            {/* Inputs de la placa */}
            <div className="flex justify-center items-center" style={{ gap: '2px' }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-center"
                  style={{
                    width: '48px',
                    height: '60px',
                    backgroundColor: '#F7C600',
                  }}
                >
                  <input
                    ref={(el) => (inputRefs.current[i] = el)}
                    type="text"
                    maxLength={1}
                    value={chars[i] || ''}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    placeholder="A"
                    data-plate-input="true"
                    style={{ 
                      width: '100%',
                      height: '100%',
                      textAlign: 'center',
                      fontSize: '36px',
                      fontWeight: 900,
                      fontFamily: "'Arial Black', 'Impact', sans-serif",
                      color: '#1a1a1a',
                      backgroundColor: '#F7C600',
                      border: 'none',
                      outline: 'none',
                      textTransform: 'uppercase',
                      caretColor: '#1a1a1a',
                      padding: 0,
                    }}
                  />
                </div>
              ))}
              {/* Separador con logo Ministerio de Transporte */}
              <div style={{ width: '32px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7C600' }}>
                <img 
                  src="https://images.seeklogo.com/logo-png/9/2/miniterio-de-transporte-logo-png_seeklogo-93135.png" 
                  alt="MT"
                  style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                />
              </div>
              {[3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-center"
                  style={{
                    width: '48px',
                    height: '60px',
                    backgroundColor: '#F7C600',
                  }}
                >
                  <input
                    ref={(el) => (inputRefs.current[i] = el)}
                    type="text"
                    maxLength={1}
                    value={chars[i] || ''}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    placeholder="0"
                    data-plate-input="true"
                    style={{ 
                      width: '100%',
                      height: '100%',
                      textAlign: 'center',
                      fontSize: '36px',
                      fontWeight: 900,
                      fontFamily: "'Arial Black', 'Impact', sans-serif",
                      color: '#1a1a1a',
                      backgroundColor: '#F7C600',
                      border: 'none',
                      outline: 'none',
                      textTransform: 'uppercase',
                      caretColor: '#1a1a1a',
                      padding: 0,
                    }}
                  />
                </div>
              ))}
            </div>
            
            {/* Tornillos inferiores */}
            <div className="absolute w-3 h-3 rounded-full bg-gray-800 opacity-50" style={{ bottom: '8px', left: '10px' }} />
            <div className="absolute w-3 h-3 rounded-full bg-gray-800 opacity-50" style={{ bottom: '8px', right: '10px' }} />
          </div>
        </div>
        
        {/* Efecto de sombra diagonal */}
        <div 
          className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.08) 100%)',
          }}
        />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
        Ingresa tu placa para cotizar al instante
      </p>
    </div>
  );
};

const ComparadorSeguros: React.FC = () => {
  const [step, setStep] = useState<Step>('placa');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [quotes, setQuotes] = useState<InsuranceQuote[]>([]);
  const [sortBy, setSortBy] = useState<'price' | 'rating' | 'discount'>('price');
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedQuote, setSelectedQuote] = useState<InsuranceQuote | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [companyConfigs, setCompanyConfigs] = useState<CompanyConfig[]>(
    Object.entries(COMPANY_LOGOS).map(([name, data]) => ({
      name,
      color: data.color,
      enabled: true,
      apiKey: '',
    }))
  );

  const [form, setForm] = useState<VehicleData>({
    placa: '',
    marca: '',
    linea: '',
    modelo: '',
    cilindraje: '',
    tipoVehiculo: 'automovil',
    uso: 'particular',
    ciudad: '',
    valorComercial: '',
    nombre: '',
    celular: '',
    email: '',
  });

  const handleChange = (field: keyof VehicleData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const isPlacaValid = form.placa.length === 6;

  const simulateLoading = () => {
    setStep('loading');
    setLoadingProgress(0);
    
    const messages = [
      'Conectando con aseguradoras...',
      'Consultando SURA...',
      'Consultando Seguros Bolívar...',
      'Consultando HDI Seguros...',
      'Consultando Allianz...',
      'Consultando MAPFRE...',
      'Consultando AXA Colpatria...',
      'Consultando La Previsora...',
      'Consultando Seguros Mundial...',
      'Calculando mejores ofertas...',
      'Aplicando descuentos disponibles...',
      'Preparando resultados...',
    ];

    let progress = 0;
    let msgIndex = 0;

    const interval = setInterval(() => {
      progress += Math.random() * 12 + 3;
      if (progress > 100) progress = 100;
      setLoadingProgress(Math.floor(progress));
      
      if (msgIndex < messages.length && progress > (msgIndex + 1) * (100 / messages.length)) {
        setLoadingMessage(messages[msgIndex]);
        msgIndex++;
      }

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          // Randomize prices slightly based on vehicle data
          const randomizedQuotes = INSURANCE_COMPANIES.map((q) => ({
            ...q,
            monthlyPrice: Math.round(q.monthlyPrice * (0.85 + Math.random() * 0.3)),
            annualPrice: Math.round(q.annualPrice * (0.85 + Math.random() * 0.3)),
          }));
          setQuotes(randomizedQuotes);
          setStep('results');
        }, 500);
      }
    }, 200);
  };

  const sortedQuotes = [...quotes]
    .filter((q) => filterCompany === 'all' || q.company === filterCompany)
    .sort((a, b) => {
      if (sortBy === 'price') return a.monthlyPrice - b.monthlyPrice;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'discount') return (b.discount || 0) - (a.discount || 0);
      return 0;
    });

  const uniqueCompanies = [...new Set(quotes.map((q) => q.company))];

  const openDetails = (quote: InsuranceQuote) => {
    setSelectedQuote(quote);
    setShowDetails(true);
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Icon
          key={i}
          icon={i <= rating ? 'solar:star-bold' : 'solar:star-line-duotone'}
          className={i <= rating ? 'text-yellow-400' : 'text-gray-300'}
          width={16}
        />
      );
    }
    return stars;
  };

  const renderQuoteCard = (quote: InsuranceQuote, index: number) => {
    const isFirst = index === 0 && sortBy === 'price';
    
    if (viewMode === 'list') {
      return (
        <Card
          key={quote.id}
          className={`relative overflow-hidden transition-all hover:shadow-lg ${
            isFirst ? 'ring-2 ring-green-500' : ''
          } ${quote.recommended ? 'ring-2 ring-blue-500' : ''}`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Logo y info básica */}
            <div className="flex items-center gap-4 lg:w-64">
              <CompanyLogo name={quote.company} size="lg" className="flex-shrink-0 shadow-sm" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 dark:text-white">{quote.company}</h3>
                  {quote.recommended && (
                    <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[10px] font-bold rounded-full">
                      RECOMENDADO
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{quote.plan}</p>
                <div className="flex items-center gap-1 mt-1">
                  {renderStars(Math.round(quote.rating))}
                  <span className="text-xs text-gray-500 ms-1">({quote.rating})</span>
                </div>
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 lg:flex-1">
              {isFirst && (
                <span className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-xs font-bold rounded-full shadow-sm">
                  <Icon icon="solar:medal-ribbon-bold" className="me-1" width={14} />
                  MEJOR PRECIO
                </span>
              )}
              {quote.popular && (
                <span className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold rounded-full shadow-sm">
                  <Icon icon="solar:fire-bold" className="me-1" width={14} />
                  POPULAR
                </span>
              )}
              {quote.discount && (
                <span className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-rose-400 to-pink-500 text-white text-xs font-bold rounded-full shadow-sm">
                  <Icon icon="solar:tag-price-bold" className="me-1" width={14} />
                  {quote.discount}% OFF
                </span>
              )}
              <span className="inline-flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-full">
                Deducible: {quote.deductible}
              </span>
            </div>

            {/* Precio */}
            <div className="text-center lg:text-right lg:w-48">
              {quote.discount && (
                <span className="text-xs text-gray-400 line-through block">
                  {formatCurrency(quote.monthlyPrice * (1 + quote.discount / 100))}
                </span>
              )}
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(quote.monthlyPrice)}
              </span>
              <span className="text-sm text-gray-500">/mes</span>
              <p className="text-xs text-gray-400">{formatCurrency(quote.annualPrice)}/año</p>
            </div>

            {/* Acciones */}
            <div className="flex gap-2 lg:w-auto">
              <Tooltip content="Ver detalles del plan">
                <Button color="light" size="sm" onClick={() => openDetails(quote)}>
                  <Icon icon="solar:eye-bold" width={18} />
                </Button>
              </Tooltip>
              <Button gradientDuoTone="purpleToBlue" size="sm">
                <Icon icon="solar:download-bold" className="me-1" width={16} />
                Descargar cotización
              </Button>
            </div>
          </div>
        </Card>
      );
    }

    // Vista Grid
    return (
      <Card
        key={quote.id}
        className={`relative overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 ${
          isFirst ? 'ring-2 ring-green-500' : ''
        } ${quote.recommended ? 'ring-2 ring-blue-500' : ''}`}
      >
        {/* Badges superiores */}
        <div className="absolute top-0 left-0 right-0 flex justify-between">
          {isFirst && (
            <span className="px-3 py-1 bg-gradient-to-r from-green-400 to-emerald-500 text-white text-[10px] font-bold rounded-br-lg shadow-sm">
              <Icon icon="solar:medal-ribbon-bold" className="inline me-1" width={12} />
              MEJOR PRECIO
            </span>
          )}
          {quote.recommended && !isFirst && (
            <span className="px-3 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[10px] font-bold rounded-br-lg shadow-sm">
              <Icon icon="solar:star-bold" className="inline me-1" width={12} />
              RECOMENDADO
            </span>
          )}
          {quote.popular && (
            <span className="px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold rounded-bl-lg shadow-sm ml-auto">
              <Icon icon="solar:fire-bold" className="inline me-1" width={12} />
              POPULAR
            </span>
          )}
        </div>

        {/* Logo y compañía */}
        <div className="flex items-center gap-3 mb-4 mt-2">
          <CompanyLogo name={quote.company} size="lg" className="shadow-sm" />
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">{quote.company}</h3>
            <p className="text-sm text-gray-500">{quote.plan}</p>
            <div className="flex items-center gap-1 mt-1">
              {renderStars(Math.round(quote.rating))}
              <span className="text-xs text-gray-500 ms-1">({quote.rating})</span>
            </div>
          </div>
        </div>

        {/* Precio */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-4 mb-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-gray-500">Mensual</span>
            <div className="text-right">
              {quote.discount && (
                <span className="text-xs text-gray-400 line-through me-2">
                  {formatCurrency(quote.monthlyPrice * (1 + quote.discount / 100))}
                </span>
              )}
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(quote.monthlyPrice)}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-gray-500">Anual</span>
            <span className="font-medium">{formatCurrency(quote.annualPrice)}</span>
          </div>
        </div>

        {/* Badges de características */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className="inline-flex items-center px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-lg">
            <Icon icon="solar:shield-check-bold" className="me-1" width={12} />
            Deducible: {quote.deductible}
          </span>
          {quote.discount && (
            <span className="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-rose-100 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/30 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-lg">
              <Icon icon="solar:tag-price-bold" className="me-1" width={12} />
              {quote.discount}% OFF
            </span>
          )}
        </div>

        {/* Coberturas */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mb-4">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Coberturas incluidas:</p>
          <div className="flex flex-wrap gap-1">
            {quote.coverage.slice(0, 3).map((c, i) => (
              <span key={i} className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-[10px] font-medium rounded">
                {c}
              </span>
            ))}
            {quote.coverage.length > 3 && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-[10px] font-medium rounded">
                +{quote.coverage.length - 3} más
              </span>
            )}
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-2">
          <Button color="light" className="flex-1" onClick={() => openDetails(quote)}>
            <Icon icon="solar:eye-bold" className="me-1" width={16} />
            Detalles
          </Button>
          <Button className="flex-1" gradientDuoTone="purpleToBlue">
            <Icon icon="solar:download-bold" className="me-1" width={16} />
            Descargar cotización
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
            <Icon icon="solar:shield-check-bold" className="text-white" width={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Comparador de Seguros de Vehículos
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Compara y encuentra el mejor seguro para tu vehículo en segundos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip content="Insertar en tu web">
            <Button color="light" size="sm" onClick={() => setShowEmbed(true)}>
              <Icon icon="solar:code-bold" className="me-1" width={16} />
              Embed
            </Button>
          </Tooltip>
          <Tooltip content="Configurar compañías">
            <Button color="light" size="sm" onClick={() => setShowConfig(true)}>
              <Icon icon="solar:settings-bold" width={18} />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Logos de compañías aliadas */}
      {step === 'placa' && (
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
            Comparamos las mejores aseguradoras de Colombia
          </p>
          <div className="flex flex-wrap justify-center items-center gap-4">
            {Object.keys(COMPANY_LOGOS).slice(0, 8).map((name) => (
              <Tooltip key={name} content={name}>
                <CompanyLogo name={name} size="md" className="shadow-sm hover:shadow-md transition-shadow" />
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Placa */}
      {step === 'placa' && (
        <Card className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Cotiza tu seguro en segundos
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Ingresa la placa de tu vehículo y compara las mejores ofertas
            </p>
          </div>

          <div className="flex justify-center mb-8">
            <LicensePlateInput
              value={form.placa}
              onChange={(value) => handleChange('placa', value)}
              onSubmit={() => setStep('datos')}
              isValid={isPlacaValid}
            />
          </div>

          <Button
            size="xl"
            className="w-full"
            gradientDuoTone="purpleToBlue"
            disabled={!isPlacaValid}
            onClick={() => setStep('datos')}
          >
            <Icon icon="solar:arrow-right-bold" className="me-2" width={20} />
            Continuar
          </Button>

          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Icon icon="solar:shield-check-bold" className="text-green-500" width={16} />
              <span>100% Seguro</span>
            </div>
            <div className="flex items-center gap-1">
              <Icon icon="solar:clock-circle-bold" className="text-blue-500" width={16} />
              <span>Resultados en 30 seg</span>
            </div>
            <div className="flex items-center gap-1">
              <Icon icon="solar:wallet-bold" className="text-amber-500" width={16} />
              <span>Costo por uso</span>
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Datos adicionales */}
      {step === 'datos' && (
        <Card className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              {/* Mini placa - estilo colombiano */}
              <div 
                className="rounded-lg shadow-md relative"
                style={{
                  background: '#F7C600',
                  padding: '4px',
                }}
              >
                <div 
                  className="rounded-md px-3 py-1.5"
                  style={{
                    background: '#F7C600',
                    border: '2px solid #1a1a1a',
                  }}
                >
                  <p 
                    className="text-lg font-black text-gray-900 flex items-center"
                    style={{ fontFamily: "'Arial Black', 'Impact', sans-serif" }}
                  >
                    {form.placa.slice(0, 3)}<img src="https://images.seeklogo.com/logo-png/9/2/miniterio-de-transporte-logo-png_seeklogo-93135.png" alt="MT" className="mx-1 w-4 h-4 inline-block" />{form.placa.slice(3)}
                  </p>
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Completa los datos del vehículo
                </h2>
                <p className="text-sm text-gray-500">Información necesaria para cotizar</p>
              </div>
            </div>
            <Button color="light" size="sm" onClick={() => setStep('placa')}>
              <Icon icon="solar:pen-bold" className="me-1" width={16} />
              Cambiar placa
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label value="Marca *" htmlFor="marca" />
              <Select
                id="marca"
                value={form.marca}
                onChange={(e) => handleChange('marca', e.target.value)}
                required
              >
                <option value="">Selecciona una marca</option>
                {MARCAS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </div>

            <div>
              <Label value="Línea / Referencia *" htmlFor="linea" />
              <input
                id="linea"
                type="text"
                value={form.linea}
                onChange={(e) => handleChange('linea', e.target.value)}
                placeholder="Ej: Spark GT, Logan, CX-5"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                required
              />
            </div>

            <div>
              <Label value="Modelo (Año) *" htmlFor="modelo" />
              <Select
                id="modelo"
                value={form.modelo}
                onChange={(e) => handleChange('modelo', e.target.value)}
                required
              >
                <option value="">Selecciona el año</option>
                {Array.from({ length: 25 }, (_, i) => 2025 - i).map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </Select>
            </div>

            <div>
              <Label value="Tipo de Vehículo *" htmlFor="tipoVehiculo" />
              <Select
                id="tipoVehiculo"
                value={form.tipoVehiculo}
                onChange={(e) => handleChange('tipoVehiculo', e.target.value)}
                required
              >
                {TIPOS_VEHICULO.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </div>

            <div>
              <Label value="Ciudad *" htmlFor="ciudad" />
              <Select
                id="ciudad"
                value={form.ciudad}
                onChange={(e) => handleChange('ciudad', e.target.value)}
                required
              >
                <option value="">Selecciona tu ciudad</option>
                {CIUDADES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>

            <div>
              <Label value="Uso del Vehículo" htmlFor="uso" />
              <Select
                id="uso"
                value={form.uso}
                onChange={(e) => handleChange('uso', e.target.value)}
              >
                {USOS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </Select>
            </div>

            <div>
              <Label value="Cilindraje (cc)" htmlFor="cilindraje" />
              <input
                id="cilindraje"
                type="number"
                value={form.cilindraje}
                onChange={(e) => handleChange('cilindraje', e.target.value)}
                placeholder="Ej: 1600"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div>
              <Label value="Valor Comercial Estimado" htmlFor="valorComercial" />
              <input
                id="valorComercial"
                type="number"
                value={form.valorComercial}
                onChange={(e) => handleChange('valorComercial', e.target.value)}
                placeholder="Ej: 45000000"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Datos de contacto */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Icon icon="solar:user-bold" className="text-primary" width={20} />
              Datos de contacto
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label value="Nombre *" htmlFor="nombre" />
                <input
                  id="nombre"
                  type="text"
                  value={form.nombre}
                  onChange={(e) => handleChange('nombre', e.target.value)}
                  placeholder="Tu nombre completo"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required
                />
              </div>
              <div>
                <Label value="Celular *" htmlFor="celular" />
                <input
                  id="celular"
                  type="tel"
                  value={form.celular}
                  onChange={(e) => handleChange('celular', e.target.value)}
                  placeholder="300 123 4567"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required
                />
              </div>
              <div>
                <Label value="Correo *" htmlFor="email" />
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button color="light" onClick={() => setStep('placa')}>
              <Icon icon="solar:arrow-left-bold" className="me-2" width={20} />
              Volver
            </Button>
            <Button
              size="lg"
              gradientDuoTone="purpleToBlue"
              disabled={!form.marca || !form.linea || !form.modelo || !form.ciudad || !form.nombre || !form.celular || !form.email}
              onClick={simulateLoading}
            >
              <Icon icon="solar:magnifer-bold" className="me-2" width={20} />
              Comparar Seguros
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Loading */}
      {step === 'loading' && (
        <Card className="max-w-2xl mx-auto text-center py-12">
          <div className="mb-8">
            <div className="relative inline-block">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center animate-pulse">
                <Icon icon="solar:shield-check-bold" className="text-white" width={48} />
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg flex items-center justify-center">
                <Spinner size="md" />
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Buscando las mejores ofertas para {form.placa}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Estamos consultando con las principales aseguradoras de Colombia
          </p>

          {/* Barra de progreso mejorada */}
          <div className="w-full max-w-lg mx-auto mb-4">
            <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${loadingProgress}%`,
                  background: 'linear-gradient(90deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)',
                }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">{loadingProgress}%</p>
          </div>

          <p className="text-sm text-primary font-medium animate-pulse">
            {loadingMessage || 'Iniciando búsqueda...'}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {Object.keys(COMPANY_LOGOS).slice(0, 7).map((company, i) => (
              <div
                key={company}
                className={`relative transition-all duration-300 ${
                  loadingProgress > (i + 1) * 12
                    ? 'ring-2 ring-green-500 rounded-xl'
                    : 'opacity-50'
                }`}
              >
                <CompanyLogo name={company} size="sm" />
                {loadingProgress > (i + 1) * 12 && (
                  <Icon icon="solar:check-circle-bold" className="absolute -top-1 -right-1 text-green-500 bg-white rounded-full" width={16} />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Step 3: Results */}
      {step === 'results' && (
        <div className="space-y-6">
          {/* Summary Card */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Placa visual - estilo colombiano */}
                <div 
                  className="rounded-lg shadow-lg relative"
                  style={{
                    background: '#F7C600',
                    padding: '4px',
                  }}
                >
                  <div 
                    className="rounded-md px-3 py-2"
                    style={{
                      background: '#F7C600',
                      border: '2px solid #1a1a1a',
                    }}
                  >
                    <p 
                      className="text-xl font-black text-gray-900 flex items-center"
                      style={{ fontFamily: "'Arial Black', 'Impact', sans-serif" }}
                    >
                      {form.placa.slice(0, 3)}<img src="https://images.seeklogo.com/logo-png/9/2/miniterio-de-transporte-logo-png_seeklogo-93135.png" alt="MT" className="mx-1.5 w-5 h-5 inline-block" />{form.placa.slice(3)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-blue-600 dark:text-blue-400">Cotización para</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    Placa {form.placa}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Encontramos</p>
                <p className="text-3xl font-bold text-primary">{quotes.length}</p>
                <p className="text-sm text-gray-500">ofertas disponibles</p>
              </div>
            </div>
          </Card>

          {/* Filters & View Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label value="Ordenar:" className="text-sm" />
                <Select
                  sizing="sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'price' | 'rating' | 'discount')}
                >
                  <option value="price">Menor precio</option>
                  <option value="rating">Mejor calificación</option>
                  <option value="discount">Mayor descuento</option>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label value="Aseguradora:" className="text-sm" />
                <Select
                  sizing="sm"
                  value={filterCompany}
                  onChange={(e) => setFilterCompany(e.target.value)}
                >
                  <option value="all">Todas</option>
                  {uniqueCompanies.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-gray-700 shadow-sm text-primary'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon icon="solar:widget-bold" width={18} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-gray-700 shadow-sm text-primary'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon icon="solar:list-bold" width={18} />
                </button>
              </div>
              <Button color="light" size="sm" onClick={() => setStep('placa')}>
                <Icon icon="solar:refresh-bold" className="me-2" width={16} />
                Nueva cotización
              </Button>
            </div>
          </div>

          {/* Results */}
          <div className={viewMode === 'grid' ? 'grid md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-4'}>
            {sortedQuotes.map((quote, index) => renderQuoteCard(quote, index))}
          </div>

        </div>
      )}

      {/* Modal de Detalles */}
      <Modal show={showDetails} onClose={() => setShowDetails(false)} size="xl">
        <Modal.Header>
          <div className="flex items-center gap-3">
            {selectedQuote && (
              <>
                <CompanyLogo name={selectedQuote.company} size="md" />
                <div>
                  <h3 className="font-bold">{selectedQuote.company}</h3>
                  <p className="text-sm text-gray-500">{selectedQuote.plan}</p>
                </div>
              </>
            )}
          </div>
        </Modal.Header>
        <Modal.Body>
          {selectedQuote && (
            <div className="space-y-6">
              {/* Precio destacado */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 text-center">
                <p className="text-sm text-gray-500 mb-1">Precio mensual</p>
                {selectedQuote.discount && (
                  <span className="text-lg text-gray-400 line-through me-2">
                    {formatCurrency(selectedQuote.monthlyPrice * (1 + selectedQuote.discount / 100))}
                  </span>
                )}
                <p className="text-4xl font-bold text-primary">{formatCurrency(selectedQuote.monthlyPrice)}</p>
                <p className="text-sm text-gray-500 mt-1">{formatCurrency(selectedQuote.annualPrice)} / año</p>
                {selectedQuote.discount && (
                  <span className="inline-flex items-center mt-2 px-3 py-1 bg-gradient-to-r from-rose-400 to-pink-500 text-white text-sm font-bold rounded-full">
                    <Icon icon="solar:tag-price-bold" className="me-1" width={14} />
                    {selectedQuote.discount}% de descuento
                  </span>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Coberturas */}
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Icon icon="solar:shield-check-bold" className="text-green-500" width={20} />
                    Coberturas
                  </h4>
                  <ul className="space-y-2">
                    {selectedQuote.coverage.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Icon icon="solar:check-circle-bold" className="text-green-500" width={16} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Beneficios */}
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Icon icon="solar:gift-bold" className="text-blue-500" width={20} />
                    Beneficios
                  </h4>
                  <ul className="space-y-2">
                    {selectedQuote.benefits.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Icon icon="solar:star-bold" className="text-amber-500" width={16} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Exclusiones */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Icon icon="solar:danger-triangle-bold" className="text-red-500" width={20} />
                  Exclusiones
                </h4>
                <ul className="space-y-2">
                  {selectedQuote.exclusions.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Icon icon="solar:close-circle-bold" className="text-red-400" width={16} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Info adicional */}
              <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:shield-bold" className="text-gray-400" width={18} />
                  <span className="text-sm">Deducible: <strong>{selectedQuote.deductible}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  {renderStars(Math.round(selectedQuote.rating))}
                  <span className="text-sm text-gray-500">({selectedQuote.rating})</span>
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button color="light" onClick={() => setShowDetails(false)}>
            Cerrar
          </Button>
          <Button gradientDuoTone="purpleToBlue">
            <Icon icon="solar:phone-calling-bold" className="me-2" width={18} />
            Solicitar esta cotización
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Embed */}
      <Modal show={showEmbed} onClose={() => setShowEmbed(false)} size="lg">
        <Modal.Header>
          <div className="flex items-center gap-2">
            <Icon icon="solar:code-bold" className="text-primary" width={24} />
            <span>Insertar Cotizador en tu Web</span>
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Copia y pega el siguiente código en tu sitio web para mostrar el cotizador de seguros.
            </p>
            
            <div className="space-y-3">
              <Label value="Código iframe" />
              <div className="relative">
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
{`<iframe
  src="${window.location.origin}/embed/cotizador-seguros"
  width="100%"
  height="700"
  frameborder="0"
  style="border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);"
></iframe>`}
                </pre>
                <Button
                  size="xs"
                  color="light"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    navigator.clipboard.writeText(`<iframe src="${window.location.origin}/embed/cotizador-seguros" width="100%" height="700" frameborder="0" style="border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);"></iframe>`);
                  }}
                >
                  <Icon icon="solar:copy-bold" width={14} className="me-1" />
                  Copiar
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label value="Código JavaScript (Widget)" />
              <div className="relative">
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
{`<div id="guro-cotizador"></div>
<script src="${window.location.origin}/widget/cotizador.js"></script>
<script>
  GuroCotizador.init({
    container: '#guro-cotizador',
    theme: 'light'
  });
</script>`}
                </pre>
                <Button
                  size="xs"
                  color="light"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    navigator.clipboard.writeText(`<div id="guro-cotizador"></div>\n<script src="${window.location.origin}/widget/cotizador.js"></script>\n<script>\n  GuroCotizador.init({\n    container: '#guro-cotizador',\n    theme: 'light'\n  });\n</script>`);
                  }}
                >
                  <Icon icon="solar:copy-bold" width={14} className="me-1" />
                  Copiar
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Icon icon="solar:info-circle-bold" className="text-blue-600 dark:text-blue-400 mt-0.5" width={20} />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Personalización</p>
                  <p>Puedes personalizar el widget agregando parámetros como <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">theme</code>, <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">primaryColor</code>, y <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">companies</code>.</p>
                </div>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="light" onClick={() => setShowEmbed(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de Configuración */}
      <Modal show={showConfig} onClose={() => setShowConfig(false)} size="xl">
        <Modal.Header>
          <div className="flex items-center gap-2">
            <Icon icon="solar:settings-bold" className="text-primary" width={24} />
            <span>Configuración de Compañías</span>
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Selecciona las compañías que deseas incluir en el cotizador y configura sus API Keys para obtener cotizaciones en tiempo real.
            </p>

            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Icon icon="solar:info-circle-bold" className="text-amber-600 dark:text-amber-400 mt-0.5" width={20} />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium mb-1">Nota</p>
                  <p>Esta configuración se guarda localmente en tu navegador. Las API Keys son opcionales y se usarán cuando las integraciones estén disponibles.</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {companyConfigs.map((config, index) => (
                <div
                  key={config.name}
                  className={`border rounded-xl p-4 transition-all ${
                    config.enabled
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 dark:border-gray-700 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Logo */}
                    <CompanyLogo name={config.name} size="md" className="flex-shrink-0 shadow-sm" />

                    {/* Info y Toggle */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{config.name}</h4>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={config.enabled}
                            onChange={(e) => {
                              const newConfigs = [...companyConfigs];
                              newConfigs[index].enabled = e.target.checked;
                              setCompanyConfigs(newConfigs);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                        </label>
                      </div>

                      {/* API Key Input */}
                      {config.enabled && (
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            placeholder="API Key (opcional)"
                            value={config.apiKey}
                            onChange={(e) => {
                              const newConfigs = [...companyConfigs];
                              newConfigs[index].apiKey = e.target.value;
                              setCompanyConfigs(newConfigs);
                            }}
                            className="flex-1 text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                          {config.apiKey && (
                            <span className="inline-flex items-center px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded">
                              <Icon icon="solar:check-circle-bold" width={12} className="me-1" />
                              Configurada
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500">
                {companyConfigs.filter(c => c.enabled).length} de {companyConfigs.length} compañías habilitadas
              </p>
              <div className="flex gap-2">
                <Button
                  color="light"
                  size="sm"
                  onClick={() => {
                    setCompanyConfigs(companyConfigs.map(c => ({ ...c, enabled: true })));
                  }}
                >
                  Habilitar todas
                </Button>
                <Button
                  color="light"
                  size="sm"
                  onClick={() => {
                    setCompanyConfigs(companyConfigs.map(c => ({ ...c, enabled: false })));
                  }}
                >
                  Deshabilitar todas
                </Button>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button color="light" onClick={() => setShowConfig(false)}>
            Cancelar
          </Button>
          <Button
            gradientDuoTone="purpleToBlue"
            onClick={() => {
              localStorage.setItem('guro_company_configs', JSON.stringify(companyConfigs));
              setShowConfig(false);
            }}
          >
            <Icon icon="solar:diskette-bold" className="me-2" width={18} />
            Guardar Configuración
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ComparadorSeguros;
