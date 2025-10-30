import { Icon } from "@iconify/react";
import { Badge, Dropdown } from "flowbite-react";
import * as profileData from "./Data";
import { Link, useNavigate } from "react-router";
import { useUnifiedAuth } from "../../../../context/UnifiedAuthContext";
import { useState } from "react";

const Profile = () => {
  const { 
    user, 
    usuarioSaas, 
    empleado, 
    isEmpleado, 
    isEmailVerified, 
    logout,
    isAuthenticated 
  } = useUnifiedAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      navigate('/');
    } catch (error) {
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleMenuClick = (url: string, title: string) => {
    if (title === "Cerrar Sesión") {
      handleLogout();
    } else if (url && url !== "#") {
      navigate(url);
    }
  };

  // Manejar error de carga de imagen
  const handleImageError = () => {
    setImageError(true);
  };

  // Resetear error cuando cambia la URL de la foto
  const resetImageError = () => {
    setImageError(false);
  };

  // Obtener la primera letra del nombre para el avatar por defecto
  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  };

  // Determinar la información a mostrar según el tipo de usuario
  let displayName = 'Usuario';
  let email = '';
  let photoURL = null;
  let userRole = null;
  let needsVerification = false;

  const formatRole = (role: string | null) => {
    if (!role) return '';
    return role
      .toString()
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (isEmpleado && empleado) {
    // Usuario empleado
    displayName = `${empleado.nombres} ${empleado.apellidos || ''}`.trim();
    email = empleado.email;
    photoURL = empleado.avatar || null;
    userRole = empleado.rol?.nombre || 'Empleado';
    needsVerification = false; // Los empleados no necesitan verificación de email
  } else if (user) {
    // Usuario Firebase (Admin/Broker)
    displayName = usuarioSaas?.nombre 
      ? `${usuarioSaas.nombre} ${usuarioSaas.apellidos || ''}`.trim()
      : user.displayName || user.email?.split('@')[0] || 'Usuario';
    email = usuarioSaas?.email || user.email || '';
    photoURL = usuarioSaas?.avatar || user.photoURL;
    userRole = usuarioSaas?.rol || 'Administrador';
    needsVerification = !isEmailVerified;
  }

  // Si no hay usuario autenticado, no mostrar el componente
  if (!isAuthenticated || !email) {
    return null;
  }

  return (
    <div className="relative">
      <Dropdown
        label=""
        className="w-screen sm:w-[360px] pb-4 rounded-sm z-[30]"
        dismissOnClick={false}
        renderTrigger={() => (
          <div className="flex items-center gap-1">
            <span className="h-10 w-10 hover:text-primary rounded-full flex justify-center items-center cursor-pointer group-hover/menu:bg-lightprimary group-hover/menu:text-primary">
              {photoURL && !imageError ? (
                <img
                  src={photoURL}
                  alt="avatar"
                  height="35"
                  width="35"
                  className="rounded-full object-cover"
                  onError={handleImageError}
                  onLoad={resetImageError}
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="h-8 w-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-semibold">
                  {getInitials(displayName)}
                </div>
              )}
            </span>
            <Icon
              icon="solar:alt-arrow-down-bold"
              className="hover:text-primary dark:text-primary group-hover/menu:text-primary"
              height={12}
            />
          </div>
        )}
      >
        <div className="py-4">
          <div className="flex items-center gap-6 pb-5 border-b dark:border-darkborder mt-5 mb-3 px-6">
            <div className="flex-shrink-0">
              {photoURL && !imageError ? (
                <img
                  src={photoURL}
                  alt="avatar"
                  height="56"
                  width="56"
                  className="rounded-full h-14 w-14 object-cover"
                  onError={handleImageError}
                  onLoad={resetImageError}
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="h-14 w-14 bg-primary text-white rounded-full flex items-center justify-center text-xl font-semibold">
                  {getInitials(displayName)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <h5 className="text-15 font-semibold truncate">{displayName}</h5>
                {!needsVerification && (
                  <Icon
                    icon="solar:check-circle-bold"
                    className="text-success"
                    height={14}
                  />
                )}
                {isEmpleado && <span className="text-blue-500">👨‍💼</span>}
              </div>
              <p className="text-sm text-ld opacity-80 truncate">{email}</p>
              {needsVerification && (
                <p className="text-xs text-warning">Email no verificado</p>
              )}
              {userRole && (
                <div className="mt-1">
                  <Badge color={"lightprimary"}>{formatRole(userRole as string)}</Badge>
                </div>
              )}
              {isEmpleado && empleado?.cargo && (
                <p className="text-xs text-gray-500">{empleado.cargo}</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="px-2">
          {profileData.profileDD.map((items, index) => {
            // Filtrar algunas opciones para empleados
            if (isEmpleado && (
              items.title === "Suscripción" || 
              items.title === "Mis Facturas"
            )) {
              return null;
            }

            return (
              <div key={index} className="px-6 mb-2">
                <Dropdown.Item
                  onClick={() => handleMenuClick(items.url, items.title)}
                  className="px-3 py-2 flex justify-between items-center bg-hover group/link w-full rounded-md cursor-pointer"
                >
                  <div className="flex items-center w-full">
                    <div className="flex gap-3 w-full items-center">
                      <Icon 
                        icon={items.icon} 
                        className="text-lg group-hover/link:text-primary" 
                      />
                      <h5 className="text-15 font-normal group-hover/link:text-primary">
                        {items.title}
                      </h5>
                      {items.url === "/apps/invoice" && !isEmpleado && (
                        <Badge color={"lightprimary"}>4</Badge>
                      )}
                      {items.title === "Cerrar Sesión" && isLoggingOut && (
                        <Icon 
                          icon="solar:loading-line-duotone" 
                          className="animate-spin text-sm" 
                        />
                      )}
                    </div>
                  </div>
                </Dropdown.Item>
              </div>
            );
          })}
        </div>
      </Dropdown>
    </div>
  );
};

export default Profile;
