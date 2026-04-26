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

  useEffect(() => {
    loadWalletData();
  }, []);

  const formatBalance = (amount: number, currency: 'COP' | 'USD' = 'COP'): string => {
    const locale = currency === 'USD' ? 'en-US' : 'es-CO';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const openWalletModal = () => {
    const now = Date.now();
    if (now - lastCloseAtRef.current < 200) return;
    setIsModalOpen(true);
  };

  const handleWalletClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openWalletModal();
  };

  const handleWalletUpdate = () => {
    loadWalletData();
  };

  const handleModalClose = () => {
    lastCloseAtRef.current = Date.now();
    setIsModalOpen(false);
  };

  const handleModalOpenChange = (open: boolean) => {
    if (!open) {
      lastCloseAtRef.current = Date.now();
    }
    setIsModalOpen(open);
  };

  const surfaceClass =
    'wallet-gradient-surface relative rounded-[12px] px-3.5 py-2 flex items-center gap-2 text-white overflow-hidden shadow-[0_0_20px_rgba(87,60,255,0.35),0_0_40px_rgba(251,146,60,0.12)] hover:shadow-[0_0_26px_rgba(87,60,255,0.45),0_0_48px_rgba(251,146,60,0.18)] transition-shadow';

  return (
    <>
      <style>{`
        @keyframes wallet-bg-flow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .wallet-gradient-surface {
          background-image: linear-gradient(
            125deg,
            #573CFF 0%,
            #7B61FF 22%,
            #A78BFA 42%,
            #fb923c 68%,
            #f97316 82%,
            #573CFF 100%
          );
          background-size: 220% 220%;
          animation: wallet-bg-flow 14s ease-in-out infinite;
        }
        .wallet-gradient-surface::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(
            180deg,
            rgba(255,255,255,0.12) 0%,
            transparent 45%,
            rgba(0,0,0,0.15) 100%
          );
          pointer-events: none;
        }
      `}</style>

      {loading && (
        <div className={`${surfaceClass} cursor-default`}>
          <div className="relative z-[1] flex items-center gap-2">
            <Icon icon="solar:wallet-bold-duotone" width={20} className="drop-shadow-md shrink-0" />
            <div className="flex flex-col text-left min-w-0">
              <span className="font-medium text-[11px] text-white/80 drop-shadow-sm">Cargando...</span>
              <span className="font-bold text-sm drop-shadow-sm">---</span>
            </div>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className={`${surfaceClass} cursor-pointer`} onClick={loadWalletData} title="Click para reintentar" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadWalletData(); } }}>
          <div className="relative z-[1] flex items-center gap-2">
            <Icon icon="solar:wallet-bold-duotone" width={20} className="drop-shadow-md shrink-0" />
            <div className="flex flex-col text-left min-w-0">
              <span className="font-medium text-[11px] text-white/85 drop-shadow-sm">Error</span>
              <span className="font-bold text-sm drop-shadow-sm">Reintentar</span>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          <div
            className={`${surfaceClass} cursor-pointer group`}
            onClick={handleWalletClick}
            title="Ver detalles del wallet"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openWalletModal();
              }
            }}
          >
            <div className="relative z-[1] flex items-center gap-2">
              <Icon icon="solar:wallet-bold-duotone" width={20} className="drop-shadow-md shrink-0 group-hover:scale-105 transition-transform" />
              <div className="flex flex-col text-left min-w-0">
                <span className="font-medium text-[11px] text-white/90 drop-shadow-sm">Mi Wallet</span>
                <span className="font-bold text-sm whitespace-nowrap drop-shadow-sm">
                  {walletData
                    ? `${formatBalance(
                        walletData.display_balance ?? walletData.balance_cop,
                        walletData.display_currency ?? 'COP'
                      )} ${walletData.display_currency ?? 'COP'}`
                    : '$0 COP'}
                </span>
              </div>
              {walletData && walletData.pending_balance > 0 && (
                <div className="relative z-[1] bg-black/25 text-white border border-white/25 text-[10px] px-2 py-0.5 rounded-full shrink-0 backdrop-blur-sm">
                  +{formatBalance(walletData.pending_balance)}
                </div>
              )}
            </div>
          </div>

          <WalletModal
            isOpen={isModalOpen}
            onClose={handleModalClose}
            onOpenChange={handleModalOpenChange}
            walletData={walletData}
            onWalletUpdate={handleWalletUpdate}
          />
        </>
      )}
    </>
  );
};

export default WalletWidget;
