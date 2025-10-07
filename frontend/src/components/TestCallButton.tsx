import React, { useState } from 'react';
import { createPhoneCall } from '../services/elevenLabsService';

const TestCallButton: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string>('');

    const handleTestCall = async () => {
        setIsLoading(true);
        setError('');
        setResult(null);

        try {
            console.log('🔄 Iniciando prueba de llamada...');
            
            const testCallData = {
                agent_id: 'agent_01k02pehqgfywb54fz2z8ts74h', // Agente correcto
                phone_number: '3227697874', // Número de Juan Rivera que encontramos en el webhook
                customer_name: 'Juan Rivera',
                dynamic_variables: {
                    user_name: 'Juan Rivera',
                    account_type: 'premium',
                    customer_id: '56',
                    city: 'medellin',
                    email: 'dadwaw@dad.com'
                },
                customer_data: {
                    fullName: 'Juan Rivera',
                    phone: '3227697874',
                    email: 'dadwaw@dad.com',
                    city: 'medellin'
                }
            };

            console.log('📞 Datos de prueba:', testCallData);

            const phoneCall = await createPhoneCall(testCallData);
            
            console.log('✅ Llamada exitosa:', phoneCall);
            setResult(phoneCall);
            
            alert(`✅ ¡Llamada iniciada exitosamente!
ID: ${phoneCall.id}
Agente: ${phoneCall.agentName}
Cliente: ${phoneCall.customerName}
Estado: ${phoneCall.status}
            
Revisa la consola para más detalles.`);

        } catch (error: any) {
            console.error('❌ Error en la prueba:', error);
            setError(error.message);
            
            alert(`❌ Error: ${error.message}
            
Revisa la consola para más detalles.`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px', border: '2px solid #007bff', borderRadius: '8px', margin: '20px', backgroundColor: '#f8f9fa' }}>
            <h3>🧪 Prueba de Llamada ElevenLabs</h3>
            <p>Cliente: <strong>Juan Rivera (3227697874)</strong></p>
            <p>Agente: <strong>Agent ID: agent_01k02pehqgfywb54fz2z8ts74h</strong></p>
            
            <button 
                onClick={handleTestCall}
                disabled={isLoading}
                style={{
                    padding: '10px 20px',
                    backgroundColor: isLoading ? '#ccc' : '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    fontSize: '16px'
                }}
            >
                {isLoading ? '📞 Llamando...' : '📞 Probar Llamada'}
            </button>

            {error && (
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px' }}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            {result && (
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#d4edda', color: '#155724', borderRadius: '4px' }}>
                    <strong>✅ Éxito:</strong> Llamada ID {result.id} - Estado: {result.status}
                    <br />
                    <small>Agente: {result.agentName} | Cliente: {result.customerName}</small>
                </div>
            )}

            <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
                <strong>¿Qué hace esta prueba?</strong>
                <ul style={{ textAlign: 'left', marginLeft: '20px' }}>
                    <li>✅ Verifica el webhook del backend: <code>https://da081699afae.ngrok-free.app/api/v1/customer/3227697874</code></li>
                    <li>📞 Usa tu servicio <code>createPhoneCall</code> exacto</li>
                    <li>🎯 Envía variables dinámicas: <code>user_name, account_type, customer_id, city</code></li>
                    <li>📋 Muestra logs completos en consola</li>
                </ul>
            </div>
        </div>
    );
};

export default TestCallButton;
