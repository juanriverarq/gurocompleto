import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { API_BASE_URL } from '../config/api';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { clearCart } from 'src/utils/localCart';

const WalletReturn: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState<string>('Procesando pago...');
  const [reference, setReference] = useState<string>('');
  const [amount, setAmount] = useState<string>('');

  useEffect(() => {
    const ref = params.get('ref') || '';
    const txId = params.get('id') || '';
    const total = params.get('amount') || '';
    setReference(ref);
    setAmount(total);

    let unsub: (() => void) | null = null;

    const confirmWithToken = async (token: string | null) => {
      if (!ref) {
        setStatus('error');
        setMessage('Referencia inválida');
        return navigate('/apps');
      }

      try {
        setStatus('processing');
        setMessage('Confirmando tu pago con Wompi...');
        const resp = await fetch(`${API_BASE_URL}/saas/wallet/confirm/wompi`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ reference: ref, transaction_id: txId })
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.success) {
            setStatus('success');
            setMessage('Pago confirmado. ¡Gracias!');
            clearCart();
          } else {
            setStatus('processing');
            setMessage('Pago recibido. Estamos esperando confirmación final...');
          }
        } else if (resp.status === 401) {
          // sin token listo aún, esperar a onAuthStateChanged
          return;
        } else {
          setStatus('processing');
          setMessage('Pago recibido. Esperando confirmación del banco...');
        }
      } catch (e) {
        setStatus('processing');
        setMessage('Pago recibido. Esperando confirmación del banco...');
      } finally {
        setTimeout(() => navigate('/apps'), 3000);
      }
    };

    const ensureAuthAndConfirm = async () => {
      const current = auth.currentUser;
      if (current) {
        const token = await current.getIdToken();
        await confirmWithToken(token);
      } else {
        unsub = onAuthStateChanged(auth, async (u) => {
          if (u) {
            const token = await u.getIdToken();
            await confirmWithToken(token);
          }
        });
      }
    };

    ensureAuthAndConfirm();
    return () => { if (unsub) unsub(); };
  }, [params, navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md">
        {status === 'processing' && (
          <Icon icon="solar:loading-line-duotone" width="48" className="mx-auto animate-spin text-primary mb-4" />
        )}
        {status === 'success' && (
          <Icon icon="solar:check-circle-bold" width="48" className="mx-auto text-green-500 mb-4" />
        )}
        {status === 'error' && (
          <Icon icon="solar:danger-triangle-bold" width="48" className="mx-auto text-red-500 mb-4" />
        )}
        <h2 className="text-2xl font-bold mb-2">Estado de Pago</h2>
        <p className="text-bodytext">{message}</p>
        {reference && (
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
            <div><strong>Referencia:</strong> {reference}</div>
            {amount && <div><strong>Total:</strong> {amount}</div>}
          </div>
        )}
        <p className="text-xs text-bodytext mt-4">Serás redirigido automáticamente...</p>
      </div>
    </div>
  );
};

export default WalletReturn;


