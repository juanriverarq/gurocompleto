import api from '../config/api';

export interface ProfileData {
  user: {
    id: number;
    nombre: string;
    email: string;
    user_type: string;
    broker_id: number;
  };
  broker: {
    id: number;
    name: string;
    status: string;
    plan: string;
    trial_ends_at: string | null;
  } | null;
}

export interface ProfileResponse {
  success: boolean;
  data: ProfileData;
  message?: string;
}

export const getProfile = async (): Promise<ProfileResponse> => {
  const response = await api.get('/saas/me-simple');
  return response.data;
};
