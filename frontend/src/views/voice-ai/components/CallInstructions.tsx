import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/shadcn-ui/Default-Ui/card';
import { 
  Phone, 
  ExternalLink, 
  Settings, 
  CheckCircle,
  AlertCircle,
  Info,
  ArrowRight
} from 'lucide-react';

const CallInstructions: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Título Principal */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Configuración de Llamadas Telefónicas Reales
        </h2>
        <p className="text-gray-600">
          Guía paso a paso para configurar llamadas reales con ElevenLabs y Twilio
        </p>
      </div>

      {/* Estado Actual */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-yellow-800">
            <AlertCircle className="h-5 w-5" />
            <span>Estado Actual: Simulación</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-yellow-700 mb-4">
            Actualmente las llamadas están funcionando en modo simulación. Para hacer llamadas reales, 
            sigue los pasos de configuración a continuación.
          </p>
          <div className="bg-yellow-100 p-3 rounded-lg">
            <p className="text-sm text-yellow-800">
              💡 <strong>Nota:</strong> Las llamadas reales requieren configuración adicional en ElevenLabs 
              y una cuenta de Twilio activa.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pasos de Configuración */}
      <div className="grid gap-6">
        {/* Paso 1: Cuenta ElevenLabs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-bold">
                1
              </div>
              <span>Configurar ElevenLabs</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">Cuenta ElevenLabs Business</p>
                  <p className="text-sm text-gray-600">
                    Necesitas una cuenta Business ($1,320/año) para acceder a llamadas telefónicas
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">API Key configurada</p>
                  <p className="text-sm text-gray-600">
                    Tu API key ya está configurada en el sistema
                  </p>
                </div>
              </div>
            </div>
            <a
              href="https://elevenlabs.io/conversational-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ir a ElevenLabs
            </a>
          </CardContent>
        </Card>

        {/* Paso 2: Configurar Twilio */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="flex items-center justify-center w-8 h-8 bg-purple-100 text-purple-600 rounded-full font-bold">
                2
              </div>
              <span>Configurar Twilio</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <ArrowRight className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium">Crear cuenta Twilio</p>
                  <p className="text-sm text-gray-600">
                    Regístrate en Twilio y obtén tu Account SID y Auth Token
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <ArrowRight className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium">Comprar número telefónico</p>
                  <p className="text-sm text-gray-600">
                    Compra un número de teléfono en Twilio para llamadas salientes
                  </p>
                </div>
              </div>
            </div>
            <a
              href="https://www.twilio.com/console"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ir a Twilio Console
            </a>
          </CardContent>
        </Card>

        {/* Paso 3: Integrar en ElevenLabs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="flex items-center justify-center w-8 h-8 bg-green-100 text-green-600 rounded-full font-bold">
                3
              </div>
              <span>Integrar Twilio en ElevenLabs</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <ArrowRight className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium">Ir a Phone Numbers</p>
                  <p className="text-sm text-gray-600">
                    En tu dashboard de ElevenLabs, navega a Conversational AI → Phone Numbers
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <ArrowRight className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium">Conectar Twilio</p>
                  <p className="text-sm text-gray-600">
                    Ingresa tu Account SID, Auth Token y número de teléfono
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <ArrowRight className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium">Configurar agentes</p>
                  <p className="text-sm text-gray-600">
                    Asigna números telefónicos a tus agentes conversacionales
                  </p>
                </div>
              </div>
            </div>
            <a
              href="https://elevenlabs.io/docs/conversational-ai/phone-numbers/twilio-integration"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver Documentación
            </a>
          </CardContent>
        </Card>

        {/* Paso 4: Configurar en el Sistema */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="flex items-center justify-center w-8 h-8 bg-orange-100 text-orange-600 rounded-full font-bold">
                4
              </div>
              <span>Configurar en el Sistema</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <ArrowRight className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium">Ir a Configuración</p>
                  <p className="text-sm text-gray-600">
                    Ve a la pestaña "Configuración" en este dashboard
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <ArrowRight className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium">Configurar Twilio</p>
                  <p className="text-sm text-gray-600">
                    Ingresa tus credenciales de Twilio en la sección "Llamadas Telefónicas"
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <ArrowRight className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium">Probar configuración</p>
                  <p className="text-sm text-gray-600">
                    Usa el botón "Llamada de Prueba" para verificar que todo funciona
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Información Adicional */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-blue-800">
            <Info className="h-5 w-5" />
            <span>Información Adicional</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm text-blue-700">
            <p><strong>Costos:</strong> Las llamadas se cobran por minuto ($0.08/min en plan Business)</p>
            <p><strong>Límites:</strong> Hasta 30 llamadas concurrentes en plan Business</p>
            <p><strong>Idiomas:</strong> Soporte para 31 idiomas, incluyendo español colombiano</p>
            <p><strong>Calidad:</strong> Audio de alta calidad con baja latencia</p>
          </div>
          <div className="bg-blue-100 p-3 rounded-lg mt-4">
            <p className="text-sm text-blue-800">
              <strong>¿Necesitas ayuda?</strong> Contacta al soporte técnico para asistencia con la configuración.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CallInstructions; 