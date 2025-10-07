import api from '../../config/api';

export interface WalletBalance {
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

export interface WalletResponse {
  success: boolean;
  data?: WalletBalance;
  message?: string;
  error?: string;
}

export interface AddFundsRequest {
  amount: number;
  currency?: 'COP' | 'USD';
  description?: string;
}

export interface WithdrawFundsRequest {
  amount: number;
  currency?: 'COP' | 'USD';
  description?: string;
}

export interface StartWompiCheckoutRequest {
  amountCOP: number;
  customerEmail: string;
  redirectUrl: string;
  reference: string;
}

export interface StartWompiCheckoutResponse {
  success: boolean;
  checkout_url?: string;
  provider?: 'wompi';
  message?: string;
}

export interface TransactionHistoryResponse {
  success: boolean;
  data?: Array<{
    id: number;
    type: 'debit' | 'credit' | 'hold' | 'release' | 'failed';
    amount_cop: number;
    currency: 'COP' | 'USD';
    description?: string;
    reference_type?: string;
    reference_id?: number;
    balance_cop_after?: number;
    created_at?: string;
    metadata?: any;
  }>;
  message?: string;
}

export const walletApi = {
  /**
   * Obtener saldo del wallet
   */
  async getBalance(): Promise<WalletResponse> {
    try {
      const response = await api.get('/saas/wallet/balance');
      return response.data;
    } catch (error: any) {
      console.error('Error getting wallet balance:', error);
      throw error;
    }
  },

  /**
   * Iniciar checkout de Wompi (Payment Link)
   */
  async startWompiCheckout(req: StartWompiCheckoutRequest): Promise<StartWompiCheckoutResponse> {
    try {
      const payload = {
        amount_cents: Math.round(req.amountCOP * 100),
        currency: 'COP',
        reference: req.reference,
        customer_email: req.customerEmail,
        redirect_url: req.redirectUrl,
      };
      const response = await api.post('/saas/wallet/checkout/wompi', payload);
      return response.data;
    } catch (error: any) {
      console.error('Error starting Wompi checkout:', error);
      throw error;
    }
  },

  /**
   * Retirar fondos del wallet
   */
  async withdrawFunds(request: WithdrawFundsRequest): Promise<WalletResponse> {
    try {
      const response = await api.post('/wallet/withdraw-funds', request);
      return response.data;
    } catch (error: any) {
      console.error('Error withdrawing funds:', error);
      throw error;
    }
  },

  /**
   * Obtener historial de transacciones
   */
  async getTransactionHistory(): Promise<TransactionHistoryResponse> {
    try {
      const response = await api.get('/saas/wallet/transactions');
      return response.data;
    } catch (error: any) {
      console.error('Error getting transaction history:', error);
      throw error;
    }
  },
};

export default walletApi;
