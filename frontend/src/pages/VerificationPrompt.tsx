import React, { useState, useEffect } from 'react';
import guroToast from 'src/components/GuroToast/GuroToast';
import { useNavigate } from 'react-router-dom';
import { useUnifiedAuth } from '../context/UnifiedAuthContext';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../config/firebase';

const VerificationPrompt: React.FC = () => {
    const { user, checkSaasStatus } = useUnifiedAuth();
    const navigate = useNavigate();
    const [isChecking, setIsChecking] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    // Verificar periódicamente si el email ha sido verificado
    useEffect(() => {
        let interval: NodeJS.Timeout;
        
        if (user && !user.emailVerified) {
            interval = setInterval(async () => {
                try {
                    await user.reload();
                    if (user.emailVerified) {
                        window.location.reload();
                    }
                } catch (e) {}
            }, 3000);
        }
        
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [user]);

    // Cooldown timer
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const handleResendEmailVerification = async () => {
        // Usar auth.currentUser directamente para asegurar el usuario más fresco de Firebase
        const firebaseUser = auth.currentUser || user;
        if (!firebaseUser) {
            guroToast.error('Error', 'No hay sesión activa. Intenta iniciar sesión de nuevo.');
            return;
        }
        setIsResending(true);
        try {
            await firebaseUser.reload();
            await sendEmailVerification(firebaseUser);
            guroToast.success('Email reenviado', 'Revisa tu bandeja de entrada y la carpeta de spam.');
            setCooldown(60);
        } catch (error: any) {
            const code = error?.code || '';
            if (code === 'auth/too-many-requests') {
                guroToast.warning('Demasiados intentos', 'Espera unos minutos antes de reenviar.');
                setCooldown(120);
            } else {
                guroToast.error('Error al reenviar', error?.message || 'Intenta de nuevo más tarde.');
            }
        } finally {
            setIsResending(false);
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
                disabled={isResending || cooldown > 0}
                style={{
                    margin: '10px',
                    padding: '10px 20px',
                    fontSize: '16px',
                    backgroundColor: (isResending || cooldown > 0) ? '#6c9bd2' : '#007BFF',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: (isResending || cooldown > 0) ? 'not-allowed' : 'pointer',
                    opacity: (isResending || cooldown > 0) ? 0.7 : 1
                }}>
                {isResending ? 'Enviando...' : cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar Email de Verificación'}
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
