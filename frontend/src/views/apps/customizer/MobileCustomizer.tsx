import { useState } from 'react';
import { Button, TextInput, Textarea, FileInput, Label, Card } from 'flowbite-react';
import { Icon } from '@iconify/react';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { usePageMeta } from 'src/hooks/usePageMeta';
import { getPageMetadata } from 'src/config/pageMetadata';

const BCrumb = [
  {
    to: '/',
    title: 'Inicio',
  },
  {
    title: 'Customizador Móvil',
  },
];

const MobileCustomizer = () => {
  // Configurar metadatos de la página
  const metadata = getPageMetadata('customizer-mobile');
  usePageMeta(metadata);

  const [appConfig, setAppConfig] = useState({
    name: 'Guro',
    description: 'El futuro de la gestión de seguros, potenciado por IA',
    primaryColor: '#3B82F6',
    logoUrl: '',
    iconUrl: ''
  });

  const updateConfig = (field: string, value: string) => {
    setAppConfig(prev => ({ ...prev, [field]: value }));
  };

  const colorPresets = [
    { name: 'Azul', color: '#3B82F6' },
    { name: 'Verde', color: '#10B981' },
    { name: 'Púrpura', color: '#8B5CF6' },
    { name: 'Rojo', color: '#EF4444' },
    { name: 'Naranja', color: '#F59E0B' },
    { name: 'Rosa', color: '#EC4899' }
  ];

  return (
    <>
      <BreadcrumbComp title="Customizador de App Móvil" items={BCrumb} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Panel de Configuración - Izquierda */}
        <div className="space-y-6">
          {/* Header */}
          <Card>
            <div className="flex items-center gap-4 p-2">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Icon icon="solar:smartphone-bold-duotone" className="text-primary" width={32} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Personalizar App Móvil
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Configura la apariencia de tu aplicación móvil
                </p>
              </div>
            </div>
          </Card>

          {/* Información Básica */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Icon icon="solar:info-circle-bold-duotone" width={20} />
                Información Básica
              </h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="appName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nombre de la Aplicación
                  </Label>
                  <TextInput
                    id="appName"
                    value={appConfig.name}
                    onChange={(e) => updateConfig('name', e.target.value)}
                    placeholder="Ej: Guro"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Máximo 15 caracteres recomendado</p>
                </div>

                <div>
                  <Label htmlFor="appDescription" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Descripción
                  </Label>
                  <Textarea
                    id="appDescription"
                    value={appConfig.description}
                    onChange={(e) => updateConfig('description', e.target.value)}
                    placeholder="Describe tu aplicación..."
                    rows={3}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Aparecerá en la App Store</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Color Principal */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Icon icon="solar:palette-bold-duotone" width={20} />
                Color Principal
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.color}
                    onClick={() => updateConfig('primaryColor', preset.color)}
                    className={`h-16 rounded-lg border-2 flex items-center justify-center text-white text-sm font-medium transition-all hover:scale-105 ${
                      appConfig.primaryColor === preset.color 
                        ? 'border-gray-800 dark:border-white scale-105 ring-2 ring-offset-2 ring-gray-400' 
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    style={{ backgroundColor: preset.color }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={appConfig.primaryColor}
                  onChange={(e) => updateConfig('primaryColor', e.target.value)}
                  className="w-16 h-12 rounded-lg border border-gray-300 cursor-pointer"
                />
                <TextInput
                  value={appConfig.primaryColor}
                  onChange={(e) => updateConfig('primaryColor', e.target.value)}
                  placeholder="#3B82F6"
                  className="flex-1"
                />
              </div>
            </div>
          </Card>

          {/* Recursos Gráficos */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Icon icon="solar:gallery-bold-duotone" width={20} />
                Recursos Gráficos
              </h3>
              
              <div className="space-y-6">
                {/* Logo */}
                <div>
                  <Label htmlFor="logoUpload" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Logo de la App
                  </Label>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                      {appConfig.logoUrl ? (
                        <img src={appConfig.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Icon icon="solar:gallery-bold-duotone" className="text-gray-400" width={28} />
                      )}
                    </div>
                    <div className="flex-1">
                      <FileInput
                        id="logoUpload"
                        helperText="PNG, JPG (512x512px recomendado)"
                      />
                    </div>
                  </div>
                </div>

                {/* Icono */}
                <div>
                  <Label htmlFor="iconUpload" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Icono de la App
                  </Label>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-300">
                      {appConfig.iconUrl ? (
                        <img src={appConfig.iconUrl} alt="Icono" className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <Icon icon="solar:smartphone-bold-duotone" className="text-gray-400" width={28} />
                      )}
                    </div>
                    <div className="flex-1">
                      <FileInput
                        id="iconUpload"
                        helperText="PNG, JPG (1024x1024px recomendado)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Recomendaciones */}
          <Card>
            <div className="p-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <Icon icon="solar:lightbulb-bold-duotone" className="text-blue-500 mt-0.5" width={24} />
                  <div>
                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                      Consejos de Diseño
                    </h4>
                    <ul className="text-sm text-blue-700 dark:text-blue-200 space-y-1">
                      <li>• Usa colores que contrasten bien con el texto</li>
                      <li>• El icono debe ser simple y reconocible</li>
                      <li>• Prueba en ambos modos (claro/oscuro)</li>
                      <li>• Mantén consistencia con tu marca</li>
                      <li>• Evita texto pequeño en el icono</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Acciones */}
          <Card>
            <div className="p-6">
              <div className="flex flex-wrap gap-3">
                <Button color="primary" className="flex-1 min-w-fit">
                  <Icon icon="solar:diskette-bold" className="mr-2" width={16} />
                  Guardar Configuración
                </Button>
                <Button color="light" className="flex-1 min-w-fit">
                  <Icon icon="solar:download-bold" className="mr-2" width={16} />
                  Exportar
                </Button>
                <Button color="light" className="flex-1 min-w-fit">
                  <Icon icon="solar:refresh-bold" className="mr-2" width={16} />
                  Restablecer
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Preview de iPhone - Derecha */}
        <div className="lg:sticky lg:top-6">
          <Card className="h-fit">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 text-center flex items-center justify-center gap-2">
                <Icon icon="solar:eye-bold-duotone" width={20} />
                Vista Previa en iPhone
              </h3>
              
              <div className="flex justify-center">
                <div className="text-center">
                  <div className="relative">
                    {/* Sombra */}
                    <div className="absolute inset-0 bg-black/20 rounded-[2.5rem] blur-lg transform translate-y-2 scale-105"></div>
                    
                    {/* Marco iPhone */}
                    <div className="relative bg-black rounded-[2.5rem] p-1 shadow-xl">
                      {/* Pantalla */}
                      <div className="bg-white dark:bg-gray-900 rounded-[2rem] overflow-hidden relative w-[240px] h-[480px]">
                        {/* Notch */}
                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-24 h-6 bg-black rounded-b-xl z-10"></div>
                        
                        {/* Home Screen */}
                        <div className="p-6 pt-12 h-full" style={{ backgroundColor: appConfig.primaryColor + '10' }}>
                          {/* Status Bar */}
                          <div className="flex justify-between items-center text-sm text-gray-900 dark:text-white mb-8">
                            <span className="font-medium">9:41</span>
                            <div className="flex gap-1 items-center">
                              <Icon icon="solar:wifi-router-bold" width={14} className="text-gray-900 dark:text-white" />
                              <Icon icon="solar:battery-charge-minimalistic-bold" width={18} className="text-gray-900 dark:text-white" />
                            </div>
                          </div>
                          
                          {/* App Icon */}
                          <div className="flex justify-center mb-4">
                            <div 
                              className="w-24 h-24 rounded-xl shadow-lg flex items-center justify-center transition-all duration-300"
                              style={{ backgroundColor: appConfig.primaryColor }}
                            >
                              {appConfig.iconUrl ? (
                                <img src={appConfig.iconUrl} alt="App Icon" className="w-full h-full object-cover rounded-xl" />
                              ) : (
                                <Icon icon="solar:shield-check-bold" className="text-white" width={42} />
                              )}
                            </div>
                          </div>
                          
                          {/* App Name */}
                          <div className="text-center mb-10">
                            <p className="text-base font-medium text-gray-900 dark:text-white">
                              {appConfig.name}
                            </p>
                          </div>
                          
                          {/* Other Apps Grid */}
                          <div className="grid grid-cols-4 gap-4 mb-8">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                              <div key={i} className="w-14 h-14 bg-gray-300 dark:bg-gray-600 rounded-xl opacity-60"></div>
                            ))}
                          </div>
                          
                          {/* Dock */}
                          <div className="absolute bottom-10 left-6 right-6">
                            <div className="bg-white/20 dark:bg-black/20 backdrop-blur-sm rounded-2xl p-3">
                              <div className="flex justify-center gap-4">
                                {[1, 2, 3, 4].map((i) => (
                                  <div key={i} className="w-14 h-14 bg-gray-400 dark:bg-gray-500 rounded-xl opacity-80"></div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Info del dispositivo */}
                  <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                    <p>iPhone 14 Pro • iOS 17</p>
                    <p>Vista en tiempo real</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
};

export default MobileCustomizer; 