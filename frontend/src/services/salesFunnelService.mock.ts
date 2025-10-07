// Mock service temporal para Sales Funnel hasta que se implemente el backend
import { 
  SalesFunnelLead, 
  SalesFunnelFilters, 
  SalesFunnelStatistics, 
  PaginatedResponse, 
  ApiResponse, 
  CreateLeadData, 
  UpdateLeadData, 
  Agent, 
  NeedingAttentionData,
  SalesFunnelConstants 
} from './salesFunnelService';

// Mock data
const mockAgents: Agent[] = [
  { id: 1, first_name: 'Carlos', last_name: 'Rodriguez', email: 'carlos@guro.com' },
  { id: 2, first_name: 'Maria', last_name: 'Garcia', email: 'maria@guro.com' },
  { id: 3, first_name: 'Juan', last_name: 'Lopez', email: 'juan@guro.com' },
];

const mockLeads: SalesFunnelLead[] = [
  {
    id: 1,
    broker_id: 1,
    assigned_agent_id: 1,
    created_by: 1,
    first_name: 'Ana',
    last_name: 'Martínez',
    email: 'ana.martinez@email.com',
    phone: '+57 300 123 4567',
    stage: 'lead',
    lead_source: 'website',
    insurance_type: 'auto',
    potential_value: 2500000,
    close_probability: 25,
    preferred_contact_method: 'phone',
    lead_score: 65,
    quality_rating: 'warm',
    days_in_current_stage: 5,
    total_days_in_funnel: 5,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    assigned_agent: mockAgents[0],
    city: 'Bogotá',
    department: 'Cundinamarca'
  },
  {
    id: 2,
    broker_id: 1,
    assigned_agent_id: 2,
    created_by: 1,
    first_name: 'Pedro',
    last_name: 'Silva',
    email: 'pedro.silva@email.com',
    phone: '+57 301 987 6543',
    stage: 'contacted',
    lead_source: 'referral',
    insurance_type: 'home',
    potential_value: 1800000,
    close_probability: 45,
    preferred_contact_method: 'email',
    lead_score: 78,
    quality_rating: 'hot',
    days_in_current_stage: 3,
    total_days_in_funnel: 8,
    created_at: '2024-01-12T14:30:00Z',
    updated_at: '2024-01-20T09:15:00Z',
    assigned_agent: mockAgents[1],
    city: 'Medellín',
    department: 'Antioquia',
    company_name: 'Silva Construcciones',
    position: 'Gerente General'
  },
  {
    id: 3,
    broker_id: 1,
    assigned_agent_id: 1,
    created_by: 1,
    first_name: 'Laura',
    last_name: 'Gómez',
    email: 'laura.gomez@email.com',
    phone: '+57 302 555 7890',
    stage: 'qualified',
    lead_source: 'google_ads',
    insurance_type: 'life',
    potential_value: 3200000,
    close_probability: 65,
    preferred_contact_method: 'whatsapp',
    lead_score: 85,
    quality_rating: 'hot',
    days_in_current_stage: 7,
    total_days_in_funnel: 15,
    created_at: '2024-01-08T16:45:00Z',
    updated_at: '2024-01-22T11:30:00Z',
    assigned_agent: mockAgents[0],
    city: 'Cali',
    department: 'Valle del Cauca',
    contact_history: [
      {
        datetime: '2024-01-20T10:00:00Z',
        method: 'phone',
        notes: 'Conversación inicial sobre necesidades de seguro de vida',
        user_id: 1
      },
      {
        datetime: '2024-01-22T14:30:00Z',
        method: 'email',
        notes: 'Envío de cotización preliminar',
        user_id: 1
      }
    ]
  },
  {
    id: 4,
    broker_id: 1,
    assigned_agent_id: 3,
    created_by: 1,
    first_name: 'Roberto',
    last_name: 'Vásquez',
    email: 'roberto.vasquez@empresa.com',
    phone: '+57 315 444 2233',
    stage: 'presentation',
    lead_source: 'cold_call',
    insurance_type: 'business',
    potential_value: 8500000,
    close_probability: 75,
    expected_close_date: '2024-02-15',
    preferred_contact_method: 'in_person',
    lead_score: 92,
    quality_rating: 'hot',
    days_in_current_stage: 4,
    total_days_in_funnel: 22,
    created_at: '2024-01-01T09:00:00Z',
    updated_at: '2024-01-23T15:20:00Z',
    assigned_agent: mockAgents[2],
    city: 'Barranquilla',
    department: 'Atlántico',
    company_name: 'Vásquez & Asociados',
    company_size: 'medium',
    industry: 'Consultoría',
    position: 'CEO',
    notes: 'Empresa en crecimiento, busca cobertura integral para 50 empleados'
  },
  {
    id: 5,
    broker_id: 1,
    assigned_agent_id: 2,
    created_by: 1,
    first_name: 'Sofia',
    last_name: 'Herrera',
    email: 'sofia.herrera@email.com',
    phone: '+57 320 777 8899',
    stage: 'closed_won',
    lead_source: 'social_media',
    insurance_type: 'auto',
    potential_value: 1200000,
    close_probability: 100,
    final_value: 1150000,
    policy_number: 'POL-2024-001',
    closed_at: '2024-01-20T12:00:00Z',
    preferred_contact_method: 'phone',
    lead_score: 88,
    quality_rating: 'hot',
    days_in_current_stage: 1,
    total_days_in_funnel: 12,
    created_at: '2024-01-08T11:30:00Z',
    updated_at: '2024-01-20T12:00:00Z',
    assigned_agent: mockAgents[1],
    city: 'Cartagena',
    department: 'Bolívar'
  }
];

const mockStatistics: SalesFunnelStatistics = {
  total_leads: mockLeads.length,
  active_leads: mockLeads.filter(lead => !['closed_won', 'closed_lost'].includes(lead.stage)).length,
  closed_won: mockLeads.filter(lead => lead.stage === 'closed_won').length,
  closed_lost: mockLeads.filter(lead => lead.stage === 'closed_lost').length,
  needing_follow_up: 2,
  high_value: mockLeads.filter(lead => lead.potential_value > 5000000).length,
  high_probability: mockLeads.filter(lead => lead.close_probability > 70).length,
  stale_leads: 1,
  expected_to_close_soon: 3,
  total_potential_value: mockLeads.reduce((sum, lead) => sum + lead.potential_value, 0),
  total_weighted_value: mockLeads.reduce((sum, lead) => sum + (lead.potential_value * lead.close_probability / 100), 0),
  conversion_rate_30d: 25.5,
  average_days_to_close: 18,
  by_stage: {
    lead: mockLeads.filter(l => l.stage === 'lead').length,
    contacted: mockLeads.filter(l => l.stage === 'contacted').length,
    qualified: mockLeads.filter(l => l.stage === 'qualified').length,
    presentation: mockLeads.filter(l => l.stage === 'presentation').length,
    proposal: mockLeads.filter(l => l.stage === 'proposal').length,
    negotiation: mockLeads.filter(l => l.stage === 'negotiation').length,
    closed_won: mockLeads.filter(l => l.stage === 'closed_won').length,
    closed_lost: mockLeads.filter(l => l.stage === 'closed_lost').length
  },
  by_insurance_type: {
    auto: mockLeads.filter(l => l.insurance_type === 'auto').length,
    home: mockLeads.filter(l => l.insurance_type === 'home').length,
    life: mockLeads.filter(l => l.insurance_type === 'life').length,
    business: mockLeads.filter(l => l.insurance_type === 'business').length
  },
  by_lead_source: {
    website: mockLeads.filter(l => l.lead_source === 'website').length,
    referral: mockLeads.filter(l => l.lead_source === 'referral').length,
    google_ads: mockLeads.filter(l => l.lead_source === 'google_ads').length,
    cold_call: mockLeads.filter(l => l.lead_source === 'cold_call').length,
    social_media: mockLeads.filter(l => l.lead_source === 'social_media').length
  },
  by_quality: {
    hot: mockLeads.filter(l => l.quality_rating === 'hot').length,
    warm: mockLeads.filter(l => l.quality_rating === 'warm').length,
    cold: mockLeads.filter(l => l.quality_rating === 'cold').length
  }
};

// Mock Service Class
class MockSalesFunnelService {
  
  // CRUD Operations
  async getLeads(filters: SalesFunnelFilters = {}): Promise<PaginatedResponse<SalesFunnelLead>> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    let filteredLeads = [...mockLeads];
    
    // Apply filters
    if (filters.stage && filters.stage !== '') {
      filteredLeads = filteredLeads.filter(lead => lead.stage === filters.stage);
    }
    
    if (filters.insurance_type && filters.insurance_type !== '') {
      filteredLeads = filteredLeads.filter(lead => lead.insurance_type === filters.insurance_type);
    }
    
    if (filters.lead_source && filters.lead_source !== '') {
      filteredLeads = filteredLeads.filter(lead => lead.lead_source === filters.lead_source);
    }
    
    if (filters.quality_rating && filters.quality_rating !== '') {
      filteredLeads = filteredLeads.filter(lead => lead.quality_rating === filters.quality_rating);
    }
    
    if (filters.assigned_agent_id) {
      filteredLeads = filteredLeads.filter(lead => lead.assigned_agent_id === filters.assigned_agent_id);
    }
    
    if (filters.search && filters.search.trim() !== '') {
      const searchTerm = filters.search.toLowerCase();
      filteredLeads = filteredLeads.filter(lead => 
        lead.first_name.toLowerCase().includes(searchTerm) ||
        lead.last_name.toLowerCase().includes(searchTerm) ||
        lead.email?.toLowerCase().includes(searchTerm) ||
        lead.phone?.includes(searchTerm) ||
        lead.company_name?.toLowerCase().includes(searchTerm)
      );
    }
    
    if (filters.active_only) {
      filteredLeads = filteredLeads.filter(lead => !['closed_won', 'closed_lost'].includes(lead.stage));
    }
    
    if (filters.high_value) {
      filteredLeads = filteredLeads.filter(lead => lead.potential_value > 5000000);
    }
    
    if (filters.high_probability) {
      filteredLeads = filteredLeads.filter(lead => lead.close_probability > 70);
    }
    
    const perPage = filters.per_page || 15;
    const page = filters.page || 1;
    const total = filteredLeads.length;
    const lastPage = Math.ceil(total / perPage);
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    
    const paginatedData = filteredLeads.slice(startIndex, endIndex);
    
    return {
      data: paginatedData,
      current_page: page,
      last_page: lastPage,
      per_page: perPage,
      total: total,
      from: startIndex + 1,
      to: Math.min(endIndex, total)
    };
  }

  async getLead(id: number): Promise<SalesFunnelLead> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const lead = mockLeads.find(l => l.id === id);
    if (!lead) {
      throw new Error(`Lead with ID ${id} not found`);
    }
    
    return lead;
  }

  async createLead(data: CreateLeadData): Promise<ApiResponse<SalesFunnelLead>> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newLead: SalesFunnelLead = {
      id: mockLeads.length + 1,
      broker_id: 1,
      created_by: 1,
      ...data,
      lead_score: data.lead_score || 50,
      days_in_current_stage: 0,
      total_days_in_funnel: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    if (data.assigned_agent_id) {
      newLead.assigned_agent = mockAgents.find(a => a.id === data.assigned_agent_id);
    }
    
    mockLeads.push(newLead);
    
    return {
      success: true,
      message: 'Lead creado exitosamente',
      data: newLead
    };
  }

  async updateLead(id: number, data: UpdateLeadData): Promise<ApiResponse<SalesFunnelLead>> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const leadIndex = mockLeads.findIndex(l => l.id === id);
    if (leadIndex === -1) {
      throw new Error(`Lead with ID ${id} not found`);
    }
    
    const updatedLead = {
      ...mockLeads[leadIndex],
      ...data,
      updated_at: new Date().toISOString()
    };
    
    if (data.assigned_agent_id) {
      updatedLead.assigned_agent = mockAgents.find(a => a.id === data.assigned_agent_id);
    }
    
    mockLeads[leadIndex] = updatedLead;
    
    return {
      success: true,
      message: 'Lead actualizado exitosamente',
      data: updatedLead
    };
  }

  async deleteLead(id: number, reason?: string): Promise<ApiResponse<null>> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const leadIndex = mockLeads.findIndex(l => l.id === id);
    if (leadIndex === -1) {
      throw new Error(`Lead with ID ${id} not found`);
    }
    
    mockLeads.splice(leadIndex, 1);
    
    return {
      success: true,
      message: 'Lead eliminado exitosamente',
      data: null
    };
  }

  // Statistics
  async getStatistics(): Promise<SalesFunnelStatistics> {
    await new Promise(resolve => setTimeout(resolve, 600));
    return mockStatistics;
  }

  // Attention needed
  async getNeedingAttention(): Promise<NeedingAttentionData> {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    return {
      needing_follow_up: mockLeads.filter(lead => 
        lead.next_follow_up_at && new Date(lead.next_follow_up_at) <= new Date()
      ),
      stale_leads: mockLeads.filter(lead => 
        lead.days_in_current_stage > 30 && !['closed_won', 'closed_lost'].includes(lead.stage)
      ),
      expected_to_close_soon: mockLeads.filter(lead => 
        lead.expected_close_date && 
        new Date(lead.expected_close_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      )
    };
  }

  // Constants
  async getConstants(): Promise<SalesFunnelConstants> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return {
      stages: {
        'lead': 'Lead',
        'contacted': 'Contactado',
        'qualified': 'Calificado',
        'presentation': 'Presentación',
        'proposal': 'Propuesta',
        'negotiation': 'Negociación',
        'closed_won': 'Cerrado Ganado',
        'closed_lost': 'Cerrado Perdido'
      },
      lead_sources: {
        'website': 'Sitio Web',
        'social_media': 'Redes Sociales',
        'google_ads': 'Google Ads',
        'facebook_ads': 'Facebook Ads',
        'referral': 'Referido',
        'cold_call': 'Llamada Fría',
        'email_campaign': 'Campaña Email',
        'trade_show': 'Feria Comercial',
        'partner': 'Socio Comercial',
        'other': 'Otro'
      },
      insurance_types: {
        'auto': 'Vehículos',
        'home': 'Hogar',
        'life': 'Vida',
        'health': 'Salud',
        'business': 'Empresarial',
        'travel': 'Viajes',
        'motorcycle': 'Motocicleta',
        'bicycle': 'Bicicleta',
        'pet': 'Mascotas',
        'multiple': 'Múltiples Seguros'
      },
      quality_ratings: {
        'hot': 'Caliente',
        'warm': 'Tibio',
        'cold': 'Frío'
      },
      contact_methods: {
        'phone': 'Teléfono',
        'email': 'Email',
        'whatsapp': 'WhatsApp',
        'in_person': 'Presencial'
      },
      contact_times: {
        'morning': 'Mañana',
        'afternoon': 'Tarde',
        'evening': 'Noche'
      },
      company_sizes: {
        'small': 'Pequeña (1-50)',
        'medium': 'Mediana (51-200)',
        'large': 'Grande (200+)'
      }
    };
  }

  // Agents
  async getAvailableAgents(): Promise<Agent[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockAgents;
  }

  // Stage Management
  async moveToNextStage(id: number, notes?: string): Promise<ApiResponse<SalesFunnelLead>> {
    await new Promise(resolve => setTimeout(resolve, 600));
    
    const leadIndex = mockLeads.findIndex(l => l.id === id);
    if (leadIndex === -1) {
      throw new Error(`Lead with ID ${id} not found`);
    }
    
    const stageOrder = ['lead', 'contacted', 'qualified', 'presentation', 'proposal', 'negotiation', 'closed_won'];
    const currentStageIndex = stageOrder.indexOf(mockLeads[leadIndex].stage);
    const nextStageIndex = Math.min(currentStageIndex + 1, stageOrder.length - 1);
    
    mockLeads[leadIndex].stage = stageOrder[nextStageIndex];
    mockLeads[leadIndex].days_in_current_stage = 0;
    mockLeads[leadIndex].updated_at = new Date().toISOString();
    
    if (notes) {
      mockLeads[leadIndex].notes = (mockLeads[leadIndex].notes || '') + '\n' + notes;
    }
    
    return {
      success: true,
      message: 'Lead movido a la siguiente etapa',
      data: mockLeads[leadIndex]
    };
  }

  async moveToStage(id: number, stage: string, notes?: string): Promise<ApiResponse<SalesFunnelLead>> {
    await new Promise(resolve => setTimeout(resolve, 600));
    
    const leadIndex = mockLeads.findIndex(l => l.id === id);
    if (leadIndex === -1) {
      throw new Error(`Lead with ID ${id} not found`);
    }
    
    mockLeads[leadIndex].stage = stage;
    mockLeads[leadIndex].days_in_current_stage = 0;
    mockLeads[leadIndex].updated_at = new Date().toISOString();
    
    if (notes) {
      const currentNotes = mockLeads[leadIndex].notes || '';
      mockLeads[leadIndex].notes = currentNotes + (currentNotes ? '\n' : '') + `Cambio a ${stage}: ${notes}`;
    }
    
    return {
      success: true,
      message: `Lead movido a etapa: ${stage}`,
      data: mockLeads[leadIndex]
    };
  }

  // Closing
  async closeAsWon(id: number, finalValue: number, policyNumber?: string, notes?: string): Promise<ApiResponse<SalesFunnelLead>> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const leadIndex = mockLeads.findIndex(l => l.id === id);
    if (leadIndex === -1) {
      throw new Error(`Lead with ID ${id} not found`);
    }
    
    mockLeads[leadIndex].stage = 'closed_won';
    mockLeads[leadIndex].close_probability = 100;
    mockLeads[leadIndex].final_value = finalValue;
    mockLeads[leadIndex].policy_number = policyNumber;
    mockLeads[leadIndex].closed_at = new Date().toISOString();
    mockLeads[leadIndex].updated_at = new Date().toISOString();
    
    if (notes) {
      mockLeads[leadIndex].closing_notes = notes;
    }
    
    return {
      success: true,
      message: 'Lead cerrado como ganado exitosamente',
      data: mockLeads[leadIndex]
    };
  }

  async closeAsLost(id: number, reason: string, notes?: string): Promise<ApiResponse<SalesFunnelLead>> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const leadIndex = mockLeads.findIndex(l => l.id === id);
    if (leadIndex === -1) {
      throw new Error(`Lead with ID ${id} not found`);
    }
    
    mockLeads[leadIndex].stage = 'closed_lost';
    mockLeads[leadIndex].close_probability = 0;
    mockLeads[leadIndex].lost_reason = reason;
    mockLeads[leadIndex].closed_at = new Date().toISOString();
    mockLeads[leadIndex].updated_at = new Date().toISOString();
    
    if (notes) {
      mockLeads[leadIndex].closing_notes = notes;
    }
    
    return {
      success: true,
      message: 'Lead cerrado como perdido',
      data: mockLeads[leadIndex]
    };
  }

  // Follow-up
  async scheduleFollowUp(id: number, followUpDate: string, notes?: string): Promise<ApiResponse<SalesFunnelLead>> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const leadIndex = mockLeads.findIndex(l => l.id === id);
    if (leadIndex === -1) {
      throw new Error(`Lead with ID ${id} not found`);
    }
    
    mockLeads[leadIndex].next_follow_up_at = followUpDate;
    mockLeads[leadIndex].updated_at = new Date().toISOString();
    
    if (notes) {
      const currentNotes = mockLeads[leadIndex].notes || '';
      mockLeads[leadIndex].notes = currentNotes + (currentNotes ? '\n' : '') + `Seguimiento programado para ${followUpDate}: ${notes}`;
    }
    
    return {
      success: true,
      message: 'Seguimiento programado exitosamente',
      data: mockLeads[leadIndex]
    };
  }

  // Contact
  async recordContact(id: number, method: string, notes?: string, details?: any): Promise<ApiResponse<SalesFunnelLead>> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const leadIndex = mockLeads.findIndex(l => l.id === id);
    if (leadIndex === -1) {
      throw new Error(`Lead with ID ${id} not found`);
    }
    
    const contactRecord = {
      datetime: new Date().toISOString(),
      method,
      notes: notes || '',
      details,
      user_id: 1
    };
    
    if (!mockLeads[leadIndex].contact_history) {
      mockLeads[leadIndex].contact_history = [];
    }
    
    mockLeads[leadIndex].contact_history!.push(contactRecord);
    mockLeads[leadIndex].last_contact_at = new Date().toISOString();
    mockLeads[leadIndex].updated_at = new Date().toISOString();
    
    return {
      success: true,
      message: 'Contacto registrado exitosamente',
      data: mockLeads[leadIndex]
    };
  }

  // Score
  async updateScore(id: number, score: number, reason?: string): Promise<ApiResponse<SalesFunnelLead>> {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const leadIndex = mockLeads.findIndex(l => l.id === id);
    if (leadIndex === -1) {
      throw new Error(`Lead with ID ${id} not found`);
    }
    
    mockLeads[leadIndex].lead_score = score;
    mockLeads[leadIndex].updated_at = new Date().toISOString();
    
    if (reason) {
      const currentNotes = mockLeads[leadIndex].notes || '';
      mockLeads[leadIndex].notes = currentNotes + (currentNotes ? '\n' : '') + `Puntuación actualizada a ${score}: ${reason}`;
    }
    
    return {
      success: true,
      message: 'Puntuación actualizada exitosamente',
      data: mockLeads[leadIndex]
    };
  }

  // Conversion
  async convertToClient(id: number): Promise<ApiResponse<{ client: any; lead: SalesFunnelLead }>> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const leadIndex = mockLeads.findIndex(l => l.id === id);
    if (leadIndex === -1) {
      throw new Error(`Lead with ID ${id} not found`);
    }
    
    const lead = mockLeads[leadIndex];
    
    // Simular creación de cliente
    const client = {
      id: Date.now(), // Simple ID generation for mock
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      phone: lead.phone,
      created_at: new Date().toISOString()
    };
    
    // Update lead
    mockLeads[leadIndex].stage = 'closed_won';
    mockLeads[leadIndex].client_id = client.id;
    mockLeads[leadIndex].closed_at = new Date().toISOString();
    mockLeads[leadIndex].updated_at = new Date().toISOString();
    
    return {
      success: true,
      message: 'Lead convertido a cliente exitosamente',
      data: { client, lead: mockLeads[leadIndex] }
    };
  }
}

export const mockSalesFunnelService = new MockSalesFunnelService();
