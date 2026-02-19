import React, { useState, useEffect, useRef } from 'react';
import { Button } from 'src/components/shadcn-ui/Default-Ui/button';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { 
  RefreshCw,
  Phone,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

import voiceCampaignService, { PhoneNumberEntry } from '../../../services/voiceCampaignService';

const VoiceSettings: React.FC = () => {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumberEntry[]>([]);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneLabelInput, setPhoneLabelInput] = useState('');
  const [phoneStep, setPhoneStep] = useState<'idle' | 'calling' | 'done'>('idle');
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null);
  const [phoneMessageType, setPhoneMessageType] = useState<'info' | 'success' | 'error'>('info');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [validationCode, setValidationCode] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const phoneRef = useRef<string>('');

  useEffect(() => {
    loadPhoneNumbers();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const loadPhoneNumbers = async () => {
    const result = await voiceCampaignService.getPhoneNumbers();
    if (result.success) setPhoneNumbers(result.phone_numbers);
  };

  const handleInitiateVerification = async () => {
    if (!phoneInput.trim()) return;
    setPhoneLoading(true);
    setPhoneMessage(null);
    setValidationCode(null);

    const result = await voiceCampaignService.initiatePhoneVerification(
      phoneInput.trim(),
      phoneLabelInput.trim() || undefined
    );

    setPhoneLoading(false);

    if (result.already_verified) {
      // Already verified in Twilio — just poll once to trigger ElevenLabs registration
      setPhoneStep('calling');
      setPhoneMessage('Este número ya está verificado. Registrando en el sistema...');
      setPhoneMessageType('info');
      phoneRef.current = phoneInput.trim();
      pollVerification();
      return;
    }

    if (result.success) {
      setPhoneStep('calling');
      setValidationCode(result.validation_code || null);
      setPhoneMessage('Twilio está llamando a tu número. Contesta y digita el código que aparece abajo.');
      setPhoneMessageType('info');
      phoneRef.current = phoneInput.trim();
      startPolling();
    } else {
      setPhoneStep('idle');
      setPhoneMessage(result.message);
      setPhoneMessageType('error');
    }
  };

  const startPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(() => {
      pollVerification();
    }, 5000);
  };

  const pollVerification = async () => {
    const result = await voiceCampaignService.checkPhoneVerification(phoneRef.current);
    if (result.verified) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
      setPhoneStep('done');
      setPhoneMessage(result.message || '¡Número verificado y registrado!');
      setPhoneMessageType('success');
      setValidationCode(null);
      setPhoneInput('');
      setPhoneLabelInput('');
      await loadPhoneNumbers();
      setTimeout(() => {
        setPhoneStep('idle');
        setPhoneMessage(null);
      }, 5000);
    }
  };

  const handleCancel = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = null;
    setPhoneStep('idle');
    setPhoneMessage(null);
    setValidationCode(null);
  };

  const handleDeletePhoneNumber = async (phoneNumberId: string) => {
    if (!confirm('¿Estás seguro de eliminar este número?')) return;
    const result = await voiceCampaignService.deletePhoneNumber(phoneNumberId);
    if (result.success) {
      await loadPhoneNumbers();
    } else {
      alert(result.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Líneas Telefónicas</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Registra tus números personales para que las llamadas de Voice AI salgan desde tu línea.
        </p>
      </div>

      {/* Registered Numbers */}
      {phoneNumbers.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Números Registrados</h4>
          <div className="space-y-2">
            {phoneNumbers.map((pn, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{pn.phone_number}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{pn.label} {pn.phone_number_id ? `• ID: ${pn.phone_number_id.substring(0, 20)}...` : ''}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => pn.phone_number_id && handleDeletePhoneNumber(pn.phone_number_id)}
                >
                  Eliminar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Message */}
      {phoneMessage && (
        <div className={`p-3 rounded-lg border ${
          phoneMessageType === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300' :
          phoneMessageType === 'error' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300' :
          'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300'
        }`}>
          <div className="flex items-center space-x-2">
            {phoneMessageType === 'success' ? <CheckCircle className="w-4 h-4" /> :
             phoneMessageType === 'error' ? <AlertCircle className="w-4 h-4" /> :
             <Phone className="w-4 h-4" />}
            <span className="text-sm">{phoneMessage}</span>
          </div>
        </div>
      )}

      {/* Step: Enter Phone Number */}
      {phoneStep === 'idle' && (
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Registrar nuevo número</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Número de teléfono</label>
              <Input
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+573001234567"
                disabled={phoneLoading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Etiqueta (opcional)</label>
              <Input
                value={phoneLabelInput}
                onChange={(e) => setPhoneLabelInput(e.target.value)}
                placeholder="Mi celular personal"
                disabled={phoneLoading}
              />
            </div>
          </div>
          <Button
            onClick={handleInitiateVerification}
            disabled={!phoneInput.trim() || phoneLoading}
            className="flex items-center space-x-2"
          >
            {phoneLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
            <span>{phoneLoading ? 'Iniciando...' : 'Verificar Número'}</span>
          </Button>
        </div>
      )}

      {/* Step: Calling — show validation code */}
      {phoneStep === 'calling' && (
        <div className="space-y-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border-2 border-yellow-300 dark:border-yellow-700">
          {validationCode && (
            <>
              <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">Contesta la llamada y digita este código:</h4>
              <p className="text-5xl font-bold tracking-[0.4em] text-yellow-900 dark:text-yellow-200 text-center py-4">
                {validationCode}
              </p>
            </>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 text-yellow-600 dark:text-yellow-400 animate-spin" />
              <span className="text-sm text-yellow-700 dark:text-yellow-400">Esperando verificación...</span>
            </div>
            <button
              className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
              onClick={handleCancel}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">¿Cómo funciona?</h4>
        <ol className="text-xs text-gray-500 dark:text-gray-400 space-y-1 list-decimal list-inside">
          <li>Ingresa tu número de celular personal</li>
          <li>Recibirás una llamada — contesta y digita el código que aparece en pantalla</li>
          <li>¡Listo! El número queda registrado automáticamente y las llamadas saldrán desde tu línea</li>
        </ol>
      </div>
    </div>
  );
};

export default VoiceSettings;
