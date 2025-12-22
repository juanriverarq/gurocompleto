import { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import { MODULES, ModuleKey } from 'src/components/landingpage/pricing-calculator/modules';
import Logo from 'src/layouts/full/shared/logo/Logo';

// Definir categorías de aplicaciones para el flujo de selección
type AppCategory = {
  id: string;
  name: string;
  apps: typeof MODULES;
};

// Organizar módulos por categorías
const getAppCategories = (): AppCategory[] => {
  const operaciones = MODULES.filter(m => 
    ['clientes', 'polizas', 'siniestros', 'renovaciones', 'automoviles', 'seguimiento'].includes(m.key)
  );
  
  const ventas = MODULES.filter(m => 
    ['crm', 'cartera', 'comisiones', 'reportes'].includes(m.key)
  );
  
  const marketing = MODULES.filter(m => 
    ['whatsapp', 'email', 'miniweb', 'marca_blanca', 'sitio_web'].includes(m.key)
  );
  
  const inteligenciaArtificial = MODULES.filter(m => 
    ['ia_chatbot', 'ia_callcenter', 'ia_predicciones', 'ia_ventas_cruzadas', 'lector_pdf_ia'].includes(m.key)
  );
  
  const finanzas = MODULES.filter(m => 
    ['facturacion_electronica', 'nomina_electronica'].includes(m.key)
  );
  
  const extras = MODULES.filter(m => 
    ['documentos', 'app_movil'].includes(m.key)
  );

  return [
    { id: 'operaciones', name: 'Operaciones', apps: operaciones },
    { id: 'ventas', name: 'Ventas', apps: ventas },
    { id: 'marketing', name: 'Marketing', apps: marketing },
    { id: 'ia', name: 'Inteligencia Artificial', apps: inteligenciaArtificial },
    { id: 'finanzas', name: 'Finanzas', apps: finanzas },
    { id: 'extras', name: 'Extras', apps: extras },
  ];
};

const MAX_APPS = 10;

const SelectAppsFlow = () => {
  const navigate = useNavigate();
  const [selectedApps, setSelectedApps] = useState<Set<ModuleKey>>(new Set());
  const categories = useMemo(() => getAppCategories(), []);

  const toggleApp = (key: ModuleKey) => {
    setSelectedApps(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else if (next.size < MAX_APPS) {
        next.add(key);
      }
      return next;
    });
  };

  const selectedModules = useMemo(() => {
    return MODULES.filter(m => selectedApps.has(m.key));
  }, [selectedApps]);

  const handleContinue = () => {
    // Guardar selección en localStorage
    localStorage.setItem('guro_selected_apps', JSON.stringify(Array.from(selectedApps)));
    // Navegar al registro
    navigate('/comenzar/registro');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-dark">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-dark border-b border-gray-200 dark:border-darkborder">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <div className="text-sm text-gray-500 font-medium">
            Paso 1 de 2
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Título */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-dark dark:text-white mb-3">
            Elige tus <span className="text-primary">Aplicaciones</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-base">
            Acceso gratis e instantáneo. No necesitas tarjeta de crédito.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Grid de aplicaciones */}
          <div className="lg:col-span-3">
            {categories.map(category => (
              <div key={category.id} className="mb-8">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">
                  {category.name}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {category.apps.map(app => {
                    const isSelected = selectedApps.has(app.key);
                    const isDisabled = !isSelected && selectedApps.size >= MAX_APPS;
                    
                    return (
                      <button
                        key={app.key}
                        onClick={() => !isDisabled && toggleApp(app.key)}
                        disabled={isDisabled}
                        className={`
                          relative flex items-center gap-3 p-4 rounded-xl border transition-all duration-200
                          ${isSelected 
                            ? 'border-primary bg-primary/5 shadow-sm' 
                            : 'border-gray-200 dark:border-darkborder bg-white dark:bg-darkgray hover:border-primary/50 hover:shadow-sm'
                          }
                          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        {/* Icono */}
                        <span className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${app.color}`}>
                          <Icon icon={app.icon} className="text-xl text-gray-700" />
                        </span>
                        
                        {/* Nombre */}
                        <span className="font-medium text-dark dark:text-white text-sm">{app.name}</span>
                        
                        {/* Check indicator */}
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <Icon 
                              icon="solar:check-circle-bold" 
                              className="text-primary text-lg"
                            />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Panel lateral - Resumen */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-white dark:bg-darkgray rounded-xl border border-gray-200 dark:border-darkborder p-5 shadow-sm">
              <h3 className="text-base font-bold text-dark dark:text-white mb-4">
                {selectedApps.size} Aplicaciones seleccionadas
              </h3>
              
              {/* Lista de apps seleccionadas */}
              <div className="space-y-2 mb-5 max-h-72 overflow-y-auto">
                {selectedModules.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    Selecciona hasta {MAX_APPS} aplicaciones para comenzar
                  </p>
                ) : (
                  selectedModules.map(app => (
                    <div key={app.key} className="flex items-center gap-2">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${app.color}`}>
                        <Icon icon={app.icon} className="text-base text-gray-700" />
                      </span>
                      <span className="text-sm font-medium text-dark dark:text-white">{app.name}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Info de prueba */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-4">
                <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                  Prueba gratuita de 7 días.
                </p>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                  No necesitas tarjeta de crédito.
                </p>
              </div>

              {/* Botón continuar */}
              <button
                onClick={handleContinue}
                disabled={selectedApps.size === 0}
                className={`
                  w-full py-3 px-6 rounded-xl font-semibold text-white transition-all text-sm
                  ${selectedApps.size > 0 
                    ? 'bg-secondary hover:bg-secondaryemphasis cursor-pointer' 
                    : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                  }
                `}
              >
                Continuar
              </button>

              {/* Contador */}
              <p className="text-center text-xs text-gray-500 mt-3">
                {selectedApps.size}/{MAX_APPS} aplicaciones
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectAppsFlow;
