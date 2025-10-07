import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUnifiedAuth } from '../context/UnifiedAuthContext';
import { Button } from "src/components/shadcn-ui/Default-Ui/button";
import { Input } from "src/components/shadcn-ui/Default-Ui/input";
import { Label } from "src/components/shadcn-ui/Default-Ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "src/components/shadcn-ui/Default-Ui/select";
import Logo from "src/layouts/full/shared/logo/Logo";

interface OnboardingComponentProps {
  step: string;
}

export const OnboardingComponent: React.FC<OnboardingComponentProps> = ({ step }) => {
  const { user, createBroker, logout } = useUnifiedAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const returnTo = searchParams.get('returnTo') || '';
  
  const [formData, setFormData] = useState({
    nombre: '',
    nit: '',
    ciudad: '',
    pais: 'Colombia',
    plan: 'professional',
    nombre_comercial: '',
    slogan: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const result = await createBroker(formData);
      
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          const next = returnTo ? `/dashboard-building?returnTo=${encodeURIComponent(returnTo)}` : '/dashboard-building';
          navigate(next);
        }, 2000);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLogout = async () => {
    await logout();
    navigate('/auth/auth1/login');
  };

  // Componente del icono de logout
  const LogoutIcon = () => (
    <button
      onClick={handleLogout}
      className="fixed top-6 right-6 z-50 p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:bg-gray-50 group"
      title="Cerrar Sesión"
    >
      <svg 
        className="w-5 h-5 text-gray-600 group-hover:text-red-600 transition-colors" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
        />
      </svg>
    </button>
  );

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ backgroundColor: '#f5f7fb' }}>
        <LogoutIcon />
        {/* Logo */}
        <div className="mb-8">
          <Logo />
        </div>
        
        {/* Success Message */}
        <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-md p-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2 text-gray-900">
            ¡Bienvenido a GURO!
          </h2>
          <p className="text-gray-600 mb-6">
            Tu broker ha sido configurado correctamente. Preparando tu dashboard...
          </p>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'create_broker') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-start p-8" style={{ backgroundColor: '#f5f7fb' }}>
        <LogoutIcon />
        {/* Logo */}
        <div className="mb-8 mt-8">
          <Logo />
        </div>
        
        {/* Form Container */}
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-md p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <p className="text-gray-600">
              Completa la información para comenzar a usar GURO
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Información de la Empresa */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="nombre">Razón Social</Label>
                  <Input
                    id="nombre"
                    name="nombre"
                    type="text"
                    placeholder="Ingresa la razón social de tu empresa"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="nombre_comercial">Nombre Comercial</Label>
                  <Input
                    id="nombre_comercial"
                    name="nombre_comercial"
                    type="text"
                    placeholder="Nombre con el que se conoce tu empresa"
                    value={formData.nombre_comercial}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="nit">NIT</Label>
                  <Input
                    id="nit"
                    name="nit"
                    type="text"
                    placeholder="123456789-0"
                    value={formData.nit}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ciudad">Ciudad</Label>
                    <Input
                      id="ciudad"
                      name="ciudad"
                      type="text"
                      placeholder="Bogotá"
                      value={formData.ciudad}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="pais">País</Label>
                    <Select value={formData.pais} onValueChange={(value) => handleSelectChange('pais', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un país" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Colombia">Colombia</SelectItem>
                        <SelectItem value="México">México</SelectItem>
                        <SelectItem value="Perú">Perú</SelectItem>
                        <SelectItem value="Chile">Chile</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Solo botón de crear broker */}
            <div className="pt-6">
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creando tu broker...
                  </>
                ) : (
                  "Crear mi Broker"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Default fallback
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ backgroundColor: '#f5f7fb' }}>
      <LogoutIcon />
      {/* Logo */}
      <div className="mb-8">
        <Logo />
      </div>
      
      {/* Loading State */}
      <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-md p-8">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2 text-gray-900">Configurando tu cuenta</h2>
        <p className="text-gray-600 mb-6">
          Estamos preparando tu experiencia en GURO...
        </p>
      </div>
    </div>
  );
}; 