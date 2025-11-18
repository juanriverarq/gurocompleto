import { auth } from '../config/firebase';
import { API_BASE_URL } from 'src/config/api';

export interface CalendarEvent {
  id?: number;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  all_day?: boolean;
  color?: string;
  event_type?: string;
  creator_name?: string;
  created_at?: string;
  updated_at?: string;
}

class CalendarService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    let token: string | null = null;

    // Intentar obtener token de Firebase Auth
    try {
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      }
    } catch (error) {
      // Ignorar errores de Firebase
    }

    // Fallback: Usar token SaaS si Firebase no está disponible
    if (!token) {
      token = localStorage.getItem('saas_token');
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      (headers as any).Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error HTTP: ${response.status}`);
    }
    return await response.json();
  }

  /**
   * Obtener todos los eventos del calendario
   */
  async getEvents(startDate?: string, endDate?: string): Promise<CalendarEvent[]> {
    try {
      let url = `${API_BASE_URL}/saas/calendar/events`;
      
      if (startDate && endDate) {
        const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: await this.getAuthHeaders(),
      });

      const result = await this.handleResponse<{ success: boolean; data: CalendarEvent[] }>(response);
      return result.data || [];
    } catch (error) {
      console.error('Error al obtener eventos del calendario:', error);
      throw error;
    }
  }

  /**
   * Crear un nuevo evento
   */
  async createEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
    try {
      const response = await fetch(`${API_BASE_URL}/saas/calendar/events`, {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify(event),
      });

      const result = await this.handleResponse<{ success: boolean; data: CalendarEvent }>(response);
      return result.data;
    } catch (error) {
      console.error('Error al crear evento:', error);
      throw error;
    }
  }

  /**
   * Actualizar un evento existente
   */
  async updateEvent(id: number, event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    try {
      const response = await fetch(`${API_BASE_URL}/saas/calendar/events/${id}`, {
        method: 'PUT',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify(event),
      });

      const result = await this.handleResponse<{ success: boolean; data: CalendarEvent }>(response);
      return result.data;
    } catch (error) {
      console.error('Error al actualizar evento:', error);
      throw error;
    }
  }

  /**
   * Eliminar un evento
   */
  async deleteEvent(id: number): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/saas/calendar/events/${id}`, {
        method: 'DELETE',
        headers: await this.getAuthHeaders(),
      });

      await this.handleResponse<{ success: boolean }>(response);
    } catch (error) {
      console.error('Error al eliminar evento:', error);
      throw error;
    }
  }
}

export default new CalendarService();
