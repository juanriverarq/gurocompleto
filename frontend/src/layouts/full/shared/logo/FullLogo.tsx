

import { Link } from "react-router";
import { useUnifiedAuth } from "src/context/UnifiedAuthContext";
import LogoDefault from "/src/assets/images/logos/Logo.svg";

const FullLogo = () => {
  const { tenant } = useUnifiedAuth();
  
  // Resolver URL del logo (acepta URL absoluta o ruta relativa de storage)
  const rawLogo = (tenant as any)?.branding?.logo || (tenant as any)?.logo;
  let logoUrl: string = LogoDefault as any;
  if (typeof rawLogo === 'string' && rawLogo.length > 0) {
    if (rawLogo.startsWith('http')) {
      logoUrl = rawLogo;
    } else {
      const base = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8081/api';
      const path = rawLogo.replace(/^\/+/, '');
      logoUrl = `${base}/storage/${path}`;
    }
  }
  
  return (
    <Link to={"/"} className="flex items-center">
      <img
        src={logoUrl}
        alt={(tenant as any)?.name || (tenant as any)?.nombre || "Guro Logo"}
        className="h-12 w-auto max-w-[180px] object-contain"
        onError={(e) => {
          // Fallback al logo por defecto si falla la carga
          (e.target as HTMLImageElement).src = LogoDefault;
        }}
      />
    </Link>
  );
};

export default FullLogo;
