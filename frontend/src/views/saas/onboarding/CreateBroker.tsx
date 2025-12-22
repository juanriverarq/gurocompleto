import React, { useState } from 'react';
import { useUnifiedAuth } from '../../../context/UnifiedAuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/shadcn-ui/Default-Ui/button';
import { useToast } from 'src/hooks/use-toast';
import { Input } from '../../../components/shadcn-ui/Default-Ui/input';
import { Label } from '../../../components/shadcn-ui/Default-Ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/shadcn-ui/Default-Ui/card';
import { Alert, AlertDescription } from '../../../components/shadcn-ui/Default-Ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/shadcn-ui/Default-Ui/select';
import { AlertCircle, CheckCircle, Sparkles, User, Building } from 'lucide-react';
import confetti from 'canvas-confetti';

interface BrokerFormData {
  // Datos personales
  nombre: string;
  documento: string;
  // Datos empresariales
  razon_social: string;
  nit: string;
  // Datos de contacto
  telefono: string;
  ciudad: string;
  pais: string;
}

const CreateBroker: React.FC = () => {
  // TODOS los hooks deben estar al inicio, antes de cualquier return condicional
  const navigate = useNavigate();
  const { createBroker, user, isAuthenticated, loading: authLoading } = useUnifiedAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [formData, setFormData] = useState<BrokerFormData>({
    nombre: '',
    documento: '',
    razon_social: '',
    nit: '',
    telefono: '',
    ciudad: '',
    pais: 'Colombia',
  });
  const [error, setError] = useState('');

  // Redirigir si no está autenticado
  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth/login?redirect=' + encodeURIComponent('/onboarding/create-broker'));
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Mostrar loading mientras verifica autenticación
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Verificando autenticación...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No mostrar nada si no está autenticado (se redirigirá)
  if (!isAuthenticated) {
    return null;
  }
  
  // Función para reproducir sonido de éxito
  const playSuccessSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
    }
  };
  
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Validar campos obligatorios
      if (!formData.nombre || !formData.documento || !formData.telefono || !formData.ciudad) {
        setError('Por favor completa todos los campos obligatorios de datos personales');
        setLoading(false);
        return;
      }

      // Mostrar pantalla de creación
      setIsCreating(true);
      setLoading(false);

      const result = await createBroker({
        // Usar el nombre personal como nombre del broker si no hay razón social
        name: formData.razon_social || formData.nombre,
        // Usar el NIT si existe, sino el documento personal
        document_number: formData.nit || formData.documento,
        // Usar el email de la cuenta autenticada
        email: user?.email || '',
        phone: formData.telefono,
        city: formData.ciudad,
        country: formData.pais,
        industry: 'corredor_seguros',
        // Datos adicionales para el backend
        personal_name: formData.nombre,
        personal_document: formData.documento,
        company_name: formData.razon_social,
        company_nit: formData.nit,
      });
      
      if (result.success) {
        // Esperar 3 segundos para mostrar el proceso de creación
        setTimeout(() => {
          setShowSuccess(true);
          
          // Reproducir sonido de éxito
          playSuccessSound();
          
          // Efecto de confetti múltiple
          const duration = 3000;
          const end = Date.now() + duration;
          
          const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd'];
          
          (function frame() {
            confetti({
              particleCount: 4,
              angle: 60,
              spread: 55,
              origin: { x: 0 },
              colors: colors
            });
            confetti({
              particleCount: 4,
              angle: 120,
              spread: 55,
              origin: { x: 1 },
              colors: colors
            });
            
            if (Date.now() < end) {
              requestAnimationFrame(frame);
            }
          }());
          
          // Redirigir al dashboard después de 2 segundos
          setTimeout(() => {
            navigate('/apps/');
          }, 2000);
        }, 3000);
      } else {
        setIsCreating(false);
        
        // Si ya tiene un broker, redirigir al dashboard
        if (result.message?.includes('ya tiene') || result.message?.includes('Ya tienes')) {
          toast({
            title: "¡Ya tienes configuración!",
            description: "Ya tienes un broker configurado. Te llevaremos al dashboard.",
            variant: "default"
          });
          setTimeout(() => {
            navigate('/apps/');
          }, 2000);
        } else {
          setError(result.message || 'Error al completar la configuración');
          toast({
            title: "Error",
            description: result.message || 'Error al completar la configuración',
            variant: "destructive"
          });
        }
      }
    } catch (err: any) {
      setIsCreating(false);
      
      // Extraer mensaje de error detallado del backend
      let errorMessage = 'Error desconocido';
      if (err?.response?.data?.errors) {
        // Errores de validación Laravel
        const errors = err.response.data.errors;
        const errorMessages: string[] = [];
        for (const field in errors) {
          const fieldErrors = errors[field];
          if (Array.isArray(fieldErrors)) {
            fieldErrors.forEach((msg: string) => {
              // Traducir mensajes comunes
              if (msg.includes('has already been taken')) {
                if (field === 'document_number') {
                  errorMessages.push('El número de documento/NIT ya está registrado en el sistema');
                } else {
                  errorMessages.push(`El campo ${field} ya está en uso`);
                }
              } else {
                errorMessages.push(msg);
              }
            });
          }
        }
        errorMessage = errorMessages.join('. ');
      } else if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };
  
  // Pantalla de creación del negocio
  if (isCreating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="mb-6">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Creando tu negocio...</h2>
              <p className="text-gray-600 mb-4">
                Estamos configurando tu espacio de trabajo. Esto tomará unos segundos.
              </p>
              <div className="flex justify-center items-center space-x-2">
                <Sparkles className="h-4 w-4 text-blue-500 animate-pulse" />
                <span className="text-sm text-gray-500">Configurando bases de datos...</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pantalla de éxito
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Bienvenido a GURO!</h2>
              <p className="text-gray-600 mb-4">
                Tu negocio ha sido configurado exitosamente. Te llevaremos al dashboard ahora.
              </p>
              <div className="flex justify-center items-center space-x-2">
                <Sparkles className="h-4 w-4 text-green-500 animate-pulse" />
                <span className="text-sm text-gray-500">Preparando tu dashboard...</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <img 
            src="/src/assets/images/logos/Logo.svg" 
            alt="GURO Logo" 
            className="h-12 mx-auto"
          />
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Configurar tu Negocio</CardTitle>
            <CardDescription>
              Completa la información de tu negocio para comenzar a usar GURO
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert className="mb-6 border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {error}
                </AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Datos Personales */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Datos Personales</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nombre">Nombre Completo *</Label>
                    <Input
                      id="nombre"
                      type="text"
                      value={formData.nombre}
                      onChange={(e) => handleInputChange('nombre', e.target.value)}
                      placeholder="Ej: Juan Pérez García"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="documento">Documento de Identidad *</Label>
                    <Input
                      id="documento"
                      type="text"
                      value={formData.documento}
                      onChange={(e) => handleInputChange('documento', e.target.value)}
                      placeholder="Ej: 1234567890"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Datos Empresariales */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Building className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Datos Empresariales</h3>
                  <span className="text-sm text-gray-500">(Opcional)</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="razon_social">Razón Social</Label>
                    <Input
                      id="razon_social"
                      type="text"
                      value={formData.razon_social}
                      onChange={(e) => handleInputChange('razon_social', e.target.value)}
                      placeholder="Ej: Correduría de Seguros ABC S.A.S."
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="nit">NIT</Label>
                    <Input
                      id="nit"
                      type="text"
                      value={formData.nit}
                      onChange={(e) => handleInputChange('nit', e.target.value)}
                      placeholder="Ej: 900123456-7"
                    />
                  </div>
                </div>
              </div>

              {/* Datos de Contacto */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Información de Contacto</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="telefono">Teléfono *</Label>
                    <Input
                      id="telefono"
                      type="tel"
                      value={formData.telefono}
                      onChange={(e) => handleInputChange('telefono', e.target.value)}
                      placeholder="+57 300 123 4567"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="ciudad">Ciudad *</Label>
                    <Input
                      id="ciudad"
                      type="text"
                      value={formData.ciudad}
                      onChange={(e) => handleInputChange('ciudad', e.target.value)}
                      placeholder="Ej: Bogotá"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="pais">País *</Label>
                    <Select value={formData.pais} onValueChange={(value) => handleInputChange('pais', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Colombia">Colombia</SelectItem>
                        <SelectItem value="México">México</SelectItem>
                        <SelectItem value="Perú">Perú</SelectItem>
                        <SelectItem value="Ecuador">Ecuador</SelectItem>
                        <SelectItem value="Venezuela">Venezuela</SelectItem>
                        <SelectItem value="Chile">Chile</SelectItem>
                        <SelectItem value="Argentina">Argentina</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

              </div>
              
              <div className="flex justify-center pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full md:w-auto px-8 py-3 text-lg"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Configurando...
                    </>
                  ) : (
                    'Configurar mi Negocio'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateBroker;