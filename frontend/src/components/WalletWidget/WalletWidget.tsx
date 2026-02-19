import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { walletApi } from '../../services/api/walletApi';
import WalletModal from './WalletModal';

interface WalletData {
  balance_cop: number;
  balance_usd: number;
  pending_balance: number;
  total_earnings: number;
  formatted_balance_cop: string;
  available_balance_cop: number;
  is_active: boolean;
  display_currency?: 'COP' | 'USD';
  display_balance?: number;
}

const WalletWidget: React.FC = () => {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const lastCloseAtRef = useRef<number>(0);

  // Función para cargar datos del wallet
  const loadWalletData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await walletApi.getBalance();
      
      if (response.success && response.data) {
        setWalletData(response.data);
      } else {
        setError('Error al cargar saldo');
      }
    } catch (err: any) {
      console.error('Error loading wallet data:', err);
      setError(err.response?.data?.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos al montar el componente
  useEffect(() => {
    loadWalletData();
  }, []);

  // Función para formatear el saldo
  const formatBalance = (amount: number, currency: 'COP' | 'USD' = 'COP'): string => {
    const locale = currency === 'USD' ? 'en-US' : 'es-CO';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Función para manejar click en el widget
  const handleWalletClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Evitar rebote: si se cerró hace <200ms, no reabrir
    const now = Date.now();
    if (now - lastCloseAtRef.current < 200) return;
    setIsModalOpen(true);
  };

  // Función para manejar actualización del wallet
  const handleWalletUpdate = () => {
    loadWalletData();
  };

  // Función para manejar el cierre del modal
  const handleModalClose = () => {
    lastCloseAtRef.current = Date.now();
    setIsModalOpen(false);
  };

  // Función para manejar cambios en el estado del modal
  const handleModalOpenChange = (open: boolean) => {
    if (!open) {
      lastCloseAtRef.current = Date.now();
    }
    setIsModalOpen(open);
  };

  if (loading) {
    return (
      <div
        className="relative text-white px-4 py-2 rounded-[10px] flex items-center gap-2 cursor-pointer shadow-sm hover:shadow-md"
        style={{
          backgroundImage: 'linear-gradient(135deg, #222283, #573CFF, #a25dae, #fa8e5b, #a25dae, #222283)',
          backgroundSize: '200% 200%',
          animation: 'hero-shimmer 16s ease-in-out infinite',
        }}
      >
        <Icon icon="solar:wallet-bold-duotone" width="20" />
        <div className="flex flex-col text-left">
          <span className="font-medium text-xs opacity-70">Cargando...</span>
          <span className="font-bold text-sm">---</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="relative text-white px-4 py-2 rounded-[10px] flex items-center gap-2 cursor-pointer shadow-sm hover:shadow-md"
        style={{
          backgroundImage: 'linear-gradient(135deg, #222283, #573CFF, #a25dae, #fa8e5b, #a25dae, #222283)',
          backgroundSize: '200% 200%',
          animation: 'hero-shimmer 16s ease-in-out infinite',
        }}
        onClick={loadWalletData}
        title="Click para reintentar"
      >
        <Icon icon="solar:wallet-bold-duotone" width="20" />
        <div className="flex flex-col text-left">
          <span className="font-medium text-xs opacity-70">Error</span>
          <span className="font-bold text-sm">Reintentar</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes hero-shimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
      <div
        className="relative text-white px-4 py-2 rounded-[10px] flex items-center gap-2 cursor-pointer shadow-sm hover:shadow-lg dark:shadow-purple-900/30 group animate-glow-pulse"
        style={{
          backgroundImage: 'linear-gradient(135deg, #222283, #573CFF, #a25dae, #fa8e5b, #a25dae, #222283)',
          backgroundSize: '200% 200%',
          animation: 'hero-shimmer 16s ease-in-out infinite',
        }}
        onClick={handleWalletClick}
        title="Ver detalles del wallet"
      >
      <Icon icon="solar:wallet-bold-duotone" width="20" className="group-hover:text-white text-white" />
      <div className="flex flex-col text-left">
        <span className="font-medium text-xs opacity-70 group-hover:opacity-100 group-hover:text-white dark:text-white dark:opacity-90">
          Mi Wallet
        </span>
        <span className="font-bold text-sm whitespace-nowrap group-hover:text-white dark:text-white">
          {walletData
            ? `${formatBalance(
                walletData.display_balance ?? walletData.balance_cop,
                walletData.display_currency ?? 'COP'
              )} ${walletData.display_currency ?? 'COP'}`
            : '$0 COP'}
        </span>
      </div>
      
      {/* Indicador de saldo pendiente */}
      {walletData && walletData.pending_balance > 0 && (
        <div className="bg-yellow-100 text-yellow-600 text-xs px-2 py-1 rounded-full">
          +{formatBalance(walletData.pending_balance)}
        </div>
      )}

      {/* Modal del Wallet */}
      <WalletModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onOpenChange={handleModalOpenChange}
        walletData={walletData}
        onWalletUpdate={handleWalletUpdate}
      />
      </div>
    </>
  );
};

export default WalletWidget;
