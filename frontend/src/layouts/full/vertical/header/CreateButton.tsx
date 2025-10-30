import { Icon } from "@iconify/react";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { useUnifiedAuth } from "../../../../context/UnifiedAuthContext";

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
    label: "Nuevo Cliente",
    icon: "solar:user-plus-bold-duotone",
    href: "/apps/seguros/clientes/nuevo",
    description: "Agregar cliente al sistema",
    iconBg: "bg-lightsuccess",
    iconColor: "text-success",
    module: "clientes",
  },
  {
    label: "Nueva Póliza",
    icon: "solar:document-add-bold-duotone",
    href: "/apps/seguros/polizas/nueva",
    description: "Crear póliza de seguro",
    iconBg: "bg-lightprimary",
    iconColor: "text-primary",
    module: "polizas",
  },
  {
    label: "Nuevo Siniestro",
    icon: "solar:danger-triangle-bold-duotone",
    href: "/apps/seguros/siniestros/nuevo",
    description: "Registrar reclamación",
    iconBg: "bg-lighterror",
    iconColor: "text-error",
    module: "siniestros",
  },
  {
    label: "Nuevo Lead",
    icon: "solar:user-heart-bold-duotone",
    href: "/apps/saas/sales-funnel/nuevo",
    description: "Registrar nuevo lead",
    iconBg: "bg-lightsecondary",
    iconColor: "text-secondary",
    module: "leads",
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
  } catch (error) {
  }

  // TEMPORAL: Desactivar filtrado de permisos para que siempre aparezca el botón
  const availableOptions = createOptions;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleOptionClick = (option: CreateOption) => {
    setIsOpen(false);
    if (option.href && option.href !== "#") {
      navigate(option.href);
    } else {
      // Para rutas que aún no están implementadas
      alert(`Próximamente: ${option.label}`);
    }
  };

  // TEMPORAL: Comentar la validación para que siempre aparezca el botón
  // if (availableOptions.length === 0) {
  //   return null;
  // }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón principal */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-[8px] flex items-center gap-2 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md text-sm font-medium"
        title="Crear nuevo elemento"
      >
        <Icon icon="solar:add-circle-bold-duotone" width="18" />
        <span className="hidden sm:inline">Crear</span>
        <Icon icon="solar:alt-arrow-down-line-duotone" width="14" className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full mt-2 w-80 sm:w-72 bg-white dark:bg-darkgray rounded-lg shadow-lg border border-ld dark:border-darkborder z-[30] left-0 sm:left-0 right-auto origin-top-left min-w-[280px] max-w-[calc(100vw-1rem)]">
          <div className="p-3">
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-ld mb-1">Crear Nuevo</h4>
              <p className="text-xs text-bodytext">Selecciona qué deseas crear</p>
            </div>
            <div className="space-y-1">
              {availableOptions.length > 0 ? (
                availableOptions.map((option, index) => (
                <div
                  key={index}
                  onClick={() => handleOptionClick(option)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-all duration-150 group"
                >
                  <span
                    className={`h-10 w-10 flex justify-center items-center rounded-lg ${option.iconBg} flex-shrink-0 group-hover:scale-105 transition-transform duration-150`}
                  >
                    <Icon
                      icon={option.icon}
                      height={18}
                      width={18}
                      className={`${option.iconColor}`}
                    />
                  </span>
                  <div className="flex-1 min-w-0">
                    <h6 className="font-medium text-sm text-ld group-hover:text-primary truncate">
                      {option.label}
                    </h6>
                    <p className="text-xs text-bodytext line-clamp-1">
                      {option.description}
                    </p>
                  </div>
                </div>
                ))
              ) : (
                <div className="p-3 text-center">
                  <p className="text-sm text-bodytext">No tienes permisos para crear elementos</p>
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
