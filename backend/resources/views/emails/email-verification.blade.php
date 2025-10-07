<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verifica tu correo electrónico - Guro</title>
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
        .welcome {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
            color: #155724;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✉️ Bienvenido a Guro</h1>
        </div>
        
        <div class="content">
            <h2>¡Verifica tu correo electrónico!</h2>
            
            <div class="welcome">
                <strong>🎉 ¡Bienvenido!</strong> Gracias por registrarte en Guro, el futuro de la gestión de seguros potenciado por IA.
            </div>

            <p>Para completar tu registro y comenzar a usar todas las funcionalidades de Guro, necesitamos verificar tu dirección de correo electrónico.</p>
            
            <p>Ingresa el siguiente código en la aplicación:</p>
            
            <div class="code-container">
                <div class="verification-code">{{ $code }}</div>
                <p style="margin: 0; font-size: 14px; color: #666;">Este código es válido por 10 minutos</p>
            </div>

            <p>Una vez verificado tu email podrás:</p>
            <ul>
                <li>✅ Acceder a tu dashboard personalizado</li>
                <li>✅ Gestionar tus pólizas de seguro</li>
                <li>✅ Utilizar nuestras herramientas de IA</li>
                <li>✅ Recibir notificaciones importantes</li>
            </ul>

            <p>Si no te registraste en Guro, puedes ignorar este email de forma segura.</p>
            
            <p>¡Estamos emocionados de tenerte en nuestro equipo!<br>
            <strong>El equipo de Guro</strong></p>
        </div>
        
        <div class="footer">
            <p>Este es un email automático, por favor no respondas a este mensaje.</p>
            <p>&copy; {{ date('Y') }} Guro. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html> 