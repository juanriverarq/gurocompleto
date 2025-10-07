<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>¡Bienvenido a Guro!</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f8fafc;
            color: #334155;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
        }
        
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        
        .header p {
            margin: 10px 0 0 0;
            font-size: 16px;
            opacity: 0.9;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .welcome-message {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .welcome-message h2 {
            color: #1e293b;
            font-size: 24px;
            margin-bottom: 15px;
        }
        
        .welcome-message p {
            font-size: 16px;
            line-height: 1.6;
            color: #64748b;
        }
        
        .features {
            background-color: #f8fafc;
            border-radius: 8px;
            padding: 30px;
            margin: 30px 0;
        }
        
        .features h3 {
            color: #1e293b;
            font-size: 20px;
            margin-bottom: 20px;
            text-align: center;
        }
        
        .feature-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        
        .feature-list li {
            padding: 10px 0;
            font-size: 15px;
            color: #475569;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .feature-list li:last-child {
            border-bottom: none;
        }
        
        .feature-list li:before {
            content: "✅";
            margin-right: 10px;
        }
        
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 15px 30px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            margin: 20px 0;
            transition: transform 0.2s;
        }
        
        .cta-button:hover {
            transform: translateY(-2px);
        }
        
        .footer {
            background-color: #f1f5f9;
            padding: 30px;
            text-align: center;
            color: #64748b;
            font-size: 14px;
        }
        
        .footer p {
            margin: 5px 0;
        }
        
        .social-links {
            margin: 20px 0;
        }
        
        .social-links a {
            display: inline-block;
            margin: 0 10px;
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 ¡Bienvenido a Guro!</h1>
            <p>Tu plataforma de gestión inteligente</p>
        </div>
        
        <div class="content">
            <div class="welcome-message">
                <h2>¡Hola {{ $user->name }}!</h2>
                <p>
                    Nos alegra enormemente tenerte como parte de la familia Guro. 
                    Has dado el primer paso hacia una gestión más eficiente y organizada.
                </p>
            </div>
            
            <div class="features">
                <h3>🚀 ¿Qué puedes hacer con Guro?</h3>
                <ul class="feature-list">
                    <li>Gestionar tus proyectos de manera eficiente</li>
                    <li>Colaborar con tu equipo en tiempo real</li>
                    <li>Seguimiento detallado de tareas y progreso</li>
                    <li>Reportes y análisis avanzados</li>
                    <li>Integración con tus herramientas favoritas</li>
                    <li>Acceso desde cualquier dispositivo</li>
                </ul>
            </div>
            
            <div style="text-align: center;">
                <a href="http://localhost:5173/dashboard" class="cta-button">
                    Comenzar Ahora
                </a>
            </div>
            
            <div style="margin-top: 30px; padding: 20px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; color: #92400e;">
                    <strong>💡 Consejo:</strong> Completa tu perfil para obtener la mejor experiencia personalizada.
                </p>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>Guro Team</strong></p>
            <p>Tu plataforma de gestión inteligente</p>
            
            <div class="social-links">
                <a href="#">Soporte</a>
                <a href="#">Documentación</a>
                <a href="#">Blog</a>
            </div>
            
            <p style="margin-top: 20px; font-size: 12px; color: #94a3b8;">
                Este email fue enviado porque te registraste en Guro.<br>
                Si no reconoces esta actividad, por favor contacta a nuestro soporte.
            </p>
        </div>
    </div>
</body>
</html> 