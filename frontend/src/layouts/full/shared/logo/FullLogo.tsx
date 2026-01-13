import { useEffect, useState, useContext } from "react";
import { Link } from "react-router";
import { UnifiedAuthContext } from "src/context/UnifiedAuthContext";
import { saasApi } from "src/services/saasApi";
import LogoDefault from "/src/assets/images/logos/Logo.svg";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';

const FullLogo = () => {
  // Usar useContext directamente para evitar error si no hay provider (landing page)
  const authContext = useContext(UnifiedAuthContext);
  const tenant = authContext ? authContext.tenant : null;
  const [logoSrc, setLogoSrc] = useState<string>(LogoDefault);
  const [hasFetched, setHasFetched] = useState(false);

  // Siempre obtener el logo desde el backend (tabla brokers)
  useEffect(() => {
    if (!tenant?.id || hasFetched) return;

    const fetchBrokerLogo = async () => {
      try {
        const headers = await saasApi.getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/saas/informacion-agencia`, { headers });
        const data = await response.json();
        
        if (data?.success && data?.data?.logo_url) {
          setLogoSrc(data.data.logo_url);
        }
      } catch (error) {
        console.warn('Error fetching broker logo:', error);
      } finally {
        setHasFetched(true);
      }
    };

    fetchBrokerLogo();
  }, [tenant?.id, hasFetched]);

  return (
    <Link to={"/"} className="flex items-center">
      <img
        key={logoSrc}
        src={logoSrc}
        alt={(tenant as any)?.name || (tenant as any)?.nombre || "Guro Logo"}
        className="h-12 w-auto max-w-[180px] object-contain"
        width={180}
        height={48}
        onError={(e) => {
          console.warn('Error loading logo:', logoSrc);
          (e.target as HTMLImageElement).src = LogoDefault;
        }}
      />
    </Link>
  );
};

export default FullLogo;
