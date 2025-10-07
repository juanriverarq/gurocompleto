<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recupera tu contraseña - Guro</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #0A2540 0%, #1e3a5f 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            padding: 40px 30px;
        }
        .code-container {
            background: #f8f9fa;
            border: 2px solid #0A2540;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 30px 0;
        }
        .verification-code {
            font-size: 32px;
            font-weight: bold;
            color: #0A2540;
            letter-spacing: 8px;
            margin: 10px 0;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
            font-size: 14px;
            color: #666;
        }
        .security-notice {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
            color: #856404;
        }
        .steps {
            background: #e7f3ff;
            border: 1px solid #b3d7ff;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔑 Guro - Recuperar Contraseña</h1>
        </div>
        
        <div class="content">
            <h2>Restablecer tu contraseña</h2>
            <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Guro.</p>
            
            <div class="steps">
                <strong>📋 Pasos a seguir:</strong>
                <ol>
                    <li>Copia el código de verificación de abajo</li>
                    <li>Regresa a la aplicación de Guro</li>
                    <li>Ingresa el código en el formulario</li>
                    <li>Crea tu nueva contraseña segura</li>
                </ol>
            </div>
            
            <div class="code-container">
                <div class="verification-code">{{ $code }}</div>
                <p style="margin: 0; font-size: 14px; color: #666;">Este código es válido por 10 minutos</p>
            </div>

            <div class="security-notice">
                <strong>🔒 Nota de seguridad:</strong> Si no solicitaste restablecer tu contraseña, ignora este email. Tu cuenta permanecerá segura.
            </div>

            <p><strong>Consejos para una contraseña segura:</strong></p>
            <ul>
                <li>✅ Usa al menos 8 caracteres</li>
                <li>✅ Incluye letras mayúsculas y minúsculas</li>
                <li>✅ Agrega números y símbolos</li>
                <li>✅ No uses información personal</li>
            </ul>

            <p>Si tienes problemas o necesitas ayuda, contacta a nuestro equipo de soporte.</p>
            
            <p>Saludos,<br>
            <strong>El equipo de Guro</strong></p>
        </div>
        
        <div class="footer">
            <p>Este es un email automático, por favor no respondas a este mensaje.</p>
            <p>&copy; {{ date('Y') }} Guro. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html> 