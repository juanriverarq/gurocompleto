// ──────────────────────────────────────────────
// Interfaces base para todos los conectores
// ──────────────────────────────────────────────

export interface ConnectorCredentials {
  username: string;
  password: string;
  extraConfig?: Record<string, any>;
}

export interface ConnectorSession {
  cookies?: Record<string, string>;
  token?: string;
  headers?: Record<string, string>;
  expiresAt?: Date;
  raw?: any;
}

export interface TestConnectionResult {
  success: boolean;
  error?: string;
  sessionData?: any;
  userInfo?: {
    name?: string;
    code?: string;
    email?: string;
    [key: string]: any;
  };
}

export interface NormalizedPolicy {
  policyNumber: string;
  policyType?: string;
  branch?: string;
  branchCode?: string;
  product?: string;
  productCode?: string;
  status: string;
  holderName?: string;
  holderDocument?: string;
  holderDocumentType?: string;
  insuredName?: string;
  insuredDocument?: string;
  startDate?: Date;
  endDate?: Date;
  issueDate?: Date;
  cancellationDate?: Date;
  premium?: number;
  iva?: number;
  totalAmount?: number;
  commissionAmount?: number;
  commissionPercentage?: number;
  paymentFrequency?: string;
  paymentMethod?: string;
  office?: string;
  channel?: string;
  renewalNumber?: number;
  certificateNumber?: string;
  externalId?: string;
  rawData?: any;
}

export interface NormalizedClient {
  documentType: string;
  documentNumber: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  email?: string;
  phone?: string;
  cellphone?: string;
  address?: string;
  city?: string;
  birthDate?: Date;
  rawData?: any;
}

export interface NormalizedPayment {
  policyNumber: string;
  paymentNumber: number;
  totalPayments?: number;
  amountDue: number;
  amountPaid: number;
  balance: number;
  dueDate?: Date;
  paidDate?: Date;
  status: string;
  collectionType?: string;
  collectedAtOffice?: boolean;
  paidToInsurer?: boolean;
  receiptNumber?: string;
  externalId?: string;
  rawData?: any;
}

export interface NormalizedCommission {
  policyNumber: string;
  commissionAmount: number;
  commissionPercentage?: number;
  status: string;
  expectedDate?: Date;
  receivedDate?: Date;
  period?: string;
  externalId?: string;
  rawData?: any;
}

export interface SyncResult {
  policies: NormalizedPolicy[];
  clients: NormalizedClient[];
  payments: NormalizedPayment[];
  commissions: NormalizedCommission[];
  errors: string[];
}

export interface PaginatedFetchOptions {
  page?: number;
  pageSize?: number;
  status?: string;
}

// ──────────────────────────────────────────────
// Interfaz que cada conector debe implementar
// ──────────────────────────────────────────────
export interface InsurerConnector {
  readonly slug: string;
  readonly name: string;

  testConnection(credentials: ConnectorCredentials): Promise<TestConnectionResult>;

  login(credentials: ConnectorCredentials): Promise<ConnectorSession>;

  fetchPolicies(
    session: ConnectorSession,
    credentials: ConnectorCredentials,
    options?: PaginatedFetchOptions
  ): Promise<{ policies: NormalizedPolicy[]; total: number }>;

  fetchClients(
    session: ConnectorSession,
    credentials: ConnectorCredentials,
    options?: PaginatedFetchOptions
  ): Promise<{ clients: NormalizedClient[]; total: number }>;

  fetchPayments?(
    session: ConnectorSession,
    credentials: ConnectorCredentials,
    policyNumber?: string
  ): Promise<NormalizedPayment[]>;

  fetchCommissions?(
    session: ConnectorSession,
    credentials: ConnectorCredentials,
    options?: PaginatedFetchOptions
  ): Promise<NormalizedCommission[]>;

  refreshSession?(
    session: ConnectorSession,
    credentials: ConnectorCredentials
  ): Promise<ConnectorSession>;

  fullSync(
    session: ConnectorSession,
    credentials: ConnectorCredentials,
    onProgress?: (message: string, current: number, total: number) => void
  ): Promise<SyncResult>;
}
