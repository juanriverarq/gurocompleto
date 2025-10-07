// Servicio de integración con datos del sistema
// Conecta ElevenLabs con la información de clientes, cartera, pólizas, etc.

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Interceptor para agregar token de autenticación
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interfaces para datos del sistema
export interface Customer {
  id: string;
  name: string;
  lastName: string;
  email: string;
  phone: string;
  identification: string;
  address: string;
  city: string;
  birthDate: string;
  customerType: 'individual' | 'company';
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface Policy {
  id: string;
  policyNumber: string;
  customerId: string;
  productType: 'auto' | 'home' | 'life' | 'health' | 'business';
  status: 'active' | 'expired' | 'cancelled' | 'suspended';
  startDate: string;
  endDate: string;
  premium: number;
  coverage: number;
  paymentFrequency: 'monthly' | 'quarterly' | 'biannual' | 'annual';
  nextPaymentDate: string;
  agent: string;
  createdAt: string;
  updatedAt: string;
}

export interface Debt {
  id: string;
  customerId: string;
  policyId: string;
  amount: number;
  originalAmount: number;
  dueDate: string;
  status: 'pending' | 'overdue' | 'paid' | 'partial';
  daysPastDue: number;
  paymentHistory: PaymentRecord[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  paymentDate: string;
  method: 'cash' | 'card' | 'transfer' | 'check';
  reference: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface Claim {
  id: string;
  claimNumber: string;
  policyId: string;
  customerId: string;
  claimType: 'accident' | 'theft' | 'damage' | 'medical' | 'death';
  status: 'reported' | 'investigating' | 'approved' | 'rejected' | 'closed';
  reportDate: string;
  incidentDate: string;
  description: string;
  estimatedAmount: number;
  approvedAmount?: number;
  adjuster: string;
  documents: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CallContext {
  customer: Customer;
  policies: Policy[];
  debts: Debt[];
  claims: Claim[];
  lastInteractions: CallInteraction[];
  preferences: CustomerPreferences;
}

export interface CallInteraction {
  id: string;
  customerId: string;
  type: 'call' | 'email' | 'sms' | 'chat';
  direction: 'inbound' | 'outbound';
  agent: string;
  duration: number;
  outcome: 'success' | 'follow_up' | 'not_interested' | 'callback';
  notes: string;
  createdAt: string;
}

export interface CustomerPreferences {
  preferredContactTime: string;
  preferredContactMethod: 'phone' | 'email' | 'sms';
  language: 'es' | 'en';
  doNotCall: boolean;
  specialInstructions: string;
}

export interface CallPurpose {
  type: 'renewal' | 'collection' | 'claims_follow_up' | 'sales' | 'customer_service';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline?: string;
  targetOutcome: string;
  scriptTemplate: string;
}

// Funciones para obtener datos del sistema
export const getCustomerByPhone = async (phone: string): Promise<Customer | null> => {
  try {
    const response = await apiClient.get(`/customers/by-phone/${phone}`);
    return response.data;
  } catch (error) {
    return null;
  }
};

export const getCustomerById = async (customerId: string): Promise<Customer | null> => {
  try {
    const response = await apiClient.get(`/customers/${customerId}`);
    return response.data;
  } catch (error) {
    return null;
  }
};

export const getCustomerPolicies = async (customerId: string): Promise<Policy[]> => {
  try {
    const response = await apiClient.get(`/customers/${customerId}/policies`);
    return response.data;
  } catch (error) {
    return [];
  }
};

export const getCustomerDebts = async (customerId: string): Promise<Debt[]> => {
  try {
    const response = await apiClient.get(`/customers/${customerId}/debts`);
    return response.data;
  } catch (error) {
    return [];
  }
};

export const getCustomerClaims = async (customerId: string): Promise<Claim[]> => {
  try {
    const response = await apiClient.get(`/customers/${customerId}/claims`);
    return response.data;
  } catch (error) {
    return [];
  }
};

export const getCustomerInteractions = async (
  customerId: string,
  limit: number = 10,
): Promise<CallInteraction[]> => {
  try {
    const response = await apiClient.get(`/customers/${customerId}/interactions?limit=${limit}`);
    return response.data;
  } catch (error) {
    return [];
  }
};

export const getCustomerPreferences = async (customerId: string): Promise<CustomerPreferences> => {
  try {
    const response = await apiClient.get(`/customers/${customerId}/preferences`);
    return response.data;
  } catch (error) {
    return {
      preferredContactTime: '09:00-18:00',
      preferredContactMethod: 'phone',
      language: 'es',
      doNotCall: false,
      specialInstructions: '',
    };
  }
};

// Función principal para obtener contexto completo del cliente
export const getCallContext = async (phone: string): Promise<CallContext | null> => {
  try {
    const customer = await getCustomerByPhone(phone);
    if (!customer) {
      return null;
    }

    const [policies, debts, claims, interactions, preferences] = await Promise.all([
      getCustomerPolicies(customer.id),
      getCustomerDebts(customer.id),
      getCustomerClaims(customer.id),
      getCustomerInteractions(customer.id),
      getCustomerPreferences(customer.id),
    ]);

    return {
      customer,
      policies,
      debts,
      claims,
      lastInteractions: interactions,
      preferences,
    };
  } catch (error) {
    return null;
  }
};

// Funciones para generar contexto personalizado para agentes
export const generateAgentPrompt = (context: CallContext, purpose: CallPurpose): string => {
  const { customer, policies, debts, claims } = context;

  let prompt = `
INFORMACIÓN DEL CLIENTE:
- Nombre: ${customer.name} ${customer.lastName}
- Teléfono: ${customer.phone}
- Email: ${customer.email}
- Identificación: ${customer.identification}
- Tipo: ${customer.customerType === 'individual' ? 'Persona Natural' : 'Empresa'}
- Estado: ${customer.status}

PÓLIZAS ACTIVAS:
`;

  policies.forEach((policy) => {
    prompt += `
- Póliza ${policy.policyNumber} (${policy.productType})
  - Estado: ${policy.status}
  - Prima: $${policy.premium.toLocaleString()}
  - Vencimiento: ${policy.endDate}
  - Próximo pago: ${policy.nextPaymentDate}
`;
  });

  if (debts.length > 0) {
    prompt += `
DEUDAS PENDIENTES:
`;
    debts.forEach((debt) => {
      prompt += `
- Deuda por $${debt.amount.toLocaleString()}
  - Vencimiento: ${debt.dueDate}
  - Días vencidos: ${debt.daysPastDue}
  - Estado: ${debt.status}
`;
    });
  }

  if (claims.length > 0) {
    prompt += `
SINIESTROS ACTIVOS:
`;
    claims.forEach((claim) => {
      prompt += `
- Siniestro ${claim.claimNumber}
  - Tipo: ${claim.claimType}
  - Estado: ${claim.status}
  - Fecha: ${claim.incidentDate}
  - Monto: $${claim.estimatedAmount.toLocaleString()}
`;
    });
  }

  prompt += `
PROPÓSITO DE LA LLAMADA: ${purpose.type}
PRIORIDAD: ${purpose.priority}
OBJETIVO: ${purpose.targetOutcome}

INSTRUCCIONES ESPECÍFICAS:
${purpose.scriptTemplate}

NOTAS IMPORTANTES:
- Habla en español colombiano
- Sé profesional pero amigable
- Usa el nombre del cliente durante la conversación
- Si hay deudas, menciona opciones de pago
- Si hay siniestros, ofrece información del estado
- Siempre confirma información importante
`;

  return prompt;
};

export const generateGreeting = (context: CallContext): string => {
  const { customer } = context;
  const timeOfDay = new Date().getHours();

  let greeting = '';
  if (timeOfDay < 12) {
    greeting = 'Buenos días';
  } else if (timeOfDay < 18) {
    greeting = 'Buenas tardes';
  } else {
    greeting = 'Buenas noches';
  }

  return `${greeting}, ${customer.name}. Habla [NOMBRE_AGENTE] de [NOMBRE_EMPRESA]. ¿Cómo está usted?`;
};

// Funciones para actualizar datos después de la llamada
export const recordCallInteraction = async (
  interaction: Omit<CallInteraction, 'id' | 'createdAt'>,
): Promise<void> => {
  try {
    await apiClient.post('/interactions', interaction);
  } catch (error) {}
};

export const updateCustomerNotes = async (customerId: string, notes: string): Promise<void> => {
  try {
    await apiClient.patch(`/customers/${customerId}/notes`, { notes });
  } catch (error) {}
};

export const scheduleFollowUp = async (
  customerId: string,
  followUpDate: string,
  reason: string,
): Promise<void> => {
  try {
    await apiClient.post('/follow-ups', {
      customerId,
      scheduledDate: followUpDate,
      reason,
      status: 'pending',
    });
  } catch (error) {}
};

export const updateDebtStatus = async (
  debtId: string,
  status: string,
  notes?: string,
): Promise<void> => {
  try {
    await apiClient.patch(`/debts/${debtId}`, { status, notes });
  } catch (error) {}
};

export const recordPaymentPromise = async (
  debtId: string,
  promisedDate: string,
  amount: number,
): Promise<void> => {
  try {
    await apiClient.post('/payment-promises', {
      debtId,
      promisedDate,
      amount,
      status: 'pending',
    });
  } catch (error) {}
};

// Funciones para obtener listas de clientes para campañas
export const getCustomersForRenewal = async (
  daysBeforeExpiry: number = 30,
): Promise<Customer[]> => {
  try {
    const response = await apiClient.get(`/customers/renewal-candidates?days=${daysBeforeExpiry}`);
    return response.data;
  } catch (error) {
    return [];
  }
};

export const getCustomersWithOverdueDebts = async (minAmount: number = 0): Promise<Customer[]> => {
  try {
    const response = await apiClient.get(`/customers/overdue-debts?minAmount=${minAmount}`);
    return response.data;
  } catch (error) {
    return [];
  }
};

export const getCustomersWithPendingClaims = async (): Promise<Customer[]> => {
  try {
    const response = await apiClient.get('/customers/pending-claims');
    return response.data;
  } catch (error) {
    return [];
  }
};

// Funciones para análisis y reportes
export const getCallAnalytics = async (dateFrom: string, dateTo: string) => {
  try {
    const response = await apiClient.get(`/analytics/calls?from=${dateFrom}&to=${dateTo}`);
    return response.data;
  } catch (error) {
    return null;
  }
};

export const getCollectionEffectiveness = async (period: string = 'month') => {
  try {
    const response = await apiClient.get(`/analytics/collection?period=${period}`);
    return response.data;
  } catch (error) {
    return null;
  }
};

export const getRenewalRates = async (period: string = 'month') => {
  try {
    const response = await apiClient.get(`/analytics/renewals?period=${period}`);
    return response.data;
  } catch (error) {
    return null;
  }
};

// Función para crear campaña automática basada en datos del sistema
export const createAutomaticCampaign = async (campaignType: string, filters: any) => {
  try {
    let customers: Customer[] = [];

    switch (campaignType) {
      case 'renewal':
        customers = await getCustomersForRenewal(filters.daysBeforeExpiry || 30);
        break;
      case 'collection':
        customers = await getCustomersWithOverdueDebts(filters.minAmount || 0);
        break;
      case 'claims_follow_up':
        customers = await getCustomersWithPendingClaims();
        break;
      default:
        throw new Error('Invalid campaign type');
    }

    const phoneNumbers = customers.map((customer) => customer.phone);

    return {
      customers,
      phoneNumbers,
      totalContacts: customers.length,
      estimatedCost: customers.length * 0.5, // Estimación de $0.50 por llamada
    };
  } catch (error) {
    throw error;
  }
};

// Funciones de utilidad
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('es-CO');
};

export const calculateDaysPastDue = (dueDate: string): number => {
  const due = new Date(dueDate);
  const today = new Date();
  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

export const getPriorityLevel = (debt: Debt): 'low' | 'medium' | 'high' | 'urgent' => {
  if (debt.daysPastDue > 90) return 'urgent';
  if (debt.daysPastDue > 60) return 'high';
  if (debt.daysPastDue > 30) return 'medium';
  return 'low';
};

export default {
  getCustomerByPhone,
  getCustomerById,
  getCallContext,
  generateAgentPrompt,
  generateGreeting,
  recordCallInteraction,
  updateCustomerNotes,
  scheduleFollowUp,
  createAutomaticCampaign,
  getCallAnalytics,
  formatCurrency,
  formatDate,
};
