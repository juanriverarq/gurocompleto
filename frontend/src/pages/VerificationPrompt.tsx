import React, { useState, useEffect } from 'react';
import guroToast from 'src/components/GuroToast/GuroToast';
import { useNavigate } from 'react-router-dom';
import { useUnifiedAuth } from '../context/UnifiedAuthContext';
import { auth } from '../config/firebase';

const VerificationPrompt: React.FC = () => {
    const { user, checkSaasStatus } = useUnifiedAuth();
    const navigate = useNavigate();
    const [isChecking, setIsChecking] = useState(false);

    // Verificar periódicamente si el email ha sido verificado
    useEffect(() => {
        let interval: NodeJS.Timeout;
        
        if (user && !user.emailVerified) {
            interval = setInterval(async () => {
                await user.reload();
                if (user.emailVerified) {
                    // Email verificado, redirigir según el estado de onboarding
                    window.location.reload();
                }
            }, 3000); // Verificar cada 3 segundos
        }
        
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [user]);

    const handleResendEmailVerification = async () => {
        if (user) {
            await user.sendEmailVerification();
            guroToast.success('Email reenviado', 'Revisa tu bandeja de entrada.');
        }
    };
    
    const handleCheckVerification = async () => {
        if (!user) return;
        
        setIsChecking(true);
        try {
            await user.reload();
            if (user.emailVerified) {
                // Email verificado, recargar la página para actualizar el estado
                window.location.reload();
            } else {
                guroToast.warning('No verificado', 'El email aún no ha sido verificado. Revisa tu bandeja de entrada.');
            }
        } catch (error) {
        } finally {
            setIsChecking(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            backgroundColor: '#f1f1f1',
            fontFamily: 'Arial, sans-serif'
        }}>
            <h1>Verificación de Email Necesaria</h1>
            <p>Por favor, verifica tu dirección de email para continuar usando la aplicación.</p>
            <button 
                onClick={handleCheckVerification}
                disabled={isChecking}
                style={{
                    margin: '10px',
                    padding: '10px 20px',
                    fontSize: '16px',
                    backgroundColor: '#28a745',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: isChecking ? 'not-allowed' : 'pointer',
                    opacity: isChecking ? 0.6 : 1
                }}>
                {isChecking ? 'Verificando...' : 'Ya verifiqué mi email'}
            </button>
            <button 
                onClick={handleResendEmailVerification}
                style={{
                    margin: '10px',
                    padding: '10px 20px',
                    fontSize: '16px',
                    backgroundColor: '#007BFF',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                }}>
                Reenviar Email de Verificación
            </button>
            <button 
                onClick={() => navigate('/auth/auth1/login')}
                style={{
                    margin: '10px',
                    padding: '10px 20px',
                    fontSize: '16px',
                    backgroundColor: '#CCCCCC',
                    color: '#333333',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                }}>
                Cambiar Cuenta
            </button>
        </div>
    );
};

export default VerificationPrompt;
