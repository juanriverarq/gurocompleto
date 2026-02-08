import { Icon } from '@iconify/react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useUnifiedAuth } from '../../../../context/UnifiedAuthContext';

interface CreateOption {
  label: string;
  icon: string;
  href: string;
  description: string;
  iconBg: string;
  iconColor: string;
  module: string; // Módulo de permisos requerido
}

const createOptions: CreateOption[] = [
  {
    label: 'Nuevo Cliente',
    icon: 'solar:user-plus-bold-duotone',
    href: '/apps/seguros/clientes/nuevo',
    description: 'Agregar cliente al sistema',
    iconBg: 'bg-lightsuccess',
    iconColor: 'text-success',
    module: 'clientes',
  },
  {
    label: 'Nueva Póliza',
    icon: 'solar:document-add-bold-duotone',
    href: '/apps/seguros/polizas/nueva',
    description: 'Crear póliza de seguro',
    iconBg: 'bg-lightprimary',
    iconColor: 'text-primary',
    module: 'polizas',
  },
  {
    label: 'Nuevo Siniestro',
    icon: 'solar:danger-triangle-bold-duotone',
    href: '/apps/seguros/siniestros/nuevo',
    description: 'Registrar reclamación',
    iconBg: 'bg-lighterror',
    iconColor: 'text-error',
    module: 'siniestros',
  },
  {
    label: 'Nuevo Lead',
    icon: 'solar:user-heart-bold-duotone',
    href: '/apps/saas/sales-funnel/nuevo',
    description: 'Registrar nuevo lead',
    iconBg: 'bg-lightsecondary',
    iconColor: 'text-secondary',
    // Usa el mismo nombre de módulo que el sistema de permisos (embudo_ventas.*)
    module: 'embudo_ventas',
  },
];

const CreateButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState('right');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  // Intentar obtener el contexto de autenticación, con fallback si no está disponible
  let hasPermission: ((module: string, action: string) => boolean) | null = null;
  try {
    const authContext = useUnifiedAuth();
    hasPermission = authContext?.hasPermission || null;
  } catch (error) {}

  // Filtrar opciones por permiso de creación
  const availableOptions = hasPermission
    ? createOptions.filter((opt) => hasPermission!(opt.module, 'crear'))
    : [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOptionClick = (option: CreateOption) => {
    setIsOpen(false);
    if (option.href && option.href !== '#') {
      navigate(option.href);
    } else {
      // Para rutas que aún no están implementadas
      alert(`Próximamente: ${option.label}`);
    }
  };

  // Si no hay opciones disponibles para crear, no mostrar el botón
  if (availableOptions.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón principal */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative overflow-hidden bg-[#573CFF] hover:bg-[#4530d4] text-white px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md text-sm font-semibold"
        title="Crear nuevo elemento"
      >
        {/* Noise/grain overlay */}
        <span
          className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '128px 128px',
          }}
        />
        <Icon icon="solar:add-circle-bold-duotone" width="18" className="relative z-[1] text-white/90" />
        <span className="relative z-[1] hidden sm:inline">Crear</span>
        <Icon
          icon="solar:alt-arrow-down-line-duotone"
          width="14"
          className={`relative z-[1] text-white/50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="fixed sm:absolute top-auto sm:top-full left-1/2 sm:left-0 -translate-x-1/2 sm:translate-x-0 mt-2 w-[calc(100vw-2rem)] sm:w-72 bg-white dark:bg-darkgray rounded-2xl shadow-lg border border-gray-100 dark:border-darkborder z-[9999]">
          <div className="p-3">
            <div className="mb-3 px-1">
              <h4 className="text-sm font-bold text-[#0d0d0d] dark:text-white mb-0.5">Crear Nuevo</h4>
              <p className="text-xs text-gray-400">Selecciona qué deseas crear</p>
            </div>
            <div className="space-y-1">
              {availableOptions.length > 0 ? (
                availableOptions.map((option, index) => (
                  <div
                    key={index}
                    onClick={() => handleOptionClick(option)}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-all duration-150 group"
                  >
                    <span
                      className={`h-10 w-10 flex justify-center items-center rounded-xl ${option.iconBg} flex-shrink-0 group-hover:scale-105 transition-transform duration-150`}
                    >
                      <Icon
                        icon={option.icon}
                        height={18}
                        width={18}
                        className={`${option.iconColor}`}
                      />
                    </span>
                    <div className="flex-1 min-w-0">
                      <h6 className="font-semibold text-sm text-[#0d0d0d] dark:text-white group-hover:text-[#573CFF] truncate">
                        {option.label}
                      </h6>
                      <p className="text-xs text-gray-400 line-clamp-1">{option.description}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center">
                  <p className="text-sm text-gray-400">No tienes permisos para crear elementos</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateButton;
