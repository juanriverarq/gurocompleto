# Arquitectura: Campañas de Email con Twilio SendGrid (sin n8n)

Este documento describe la implementación actual para el envío masivo de emails desde el backend Laravel usando Twilio SendGrid directamente (sin n8n), el manejo de eventos vía webhook y los pasos de configuración.

Componentes clave
- Backend Laravel (API SaaS)
  - Controlador de campañas: [EmailCampaignsController::start()](../backend/app/Http/Controllers/SaaS/EmailCampaignsController.php:213)
  - Webhook de eventos SendGrid: [SendgridWebhookController::handle()](../backend/app/Http/Controllers/Api/SendgridWebhookController.php:1)
  - Rutas de API:
    - POST /api/saas/email-campaigns/{id}/start (inicia envíos)
    - POST /api/webhooks/sendgrid/events (recibe eventos delivered/opened/clicked/bounce)
- Twilio SendGrid (proveedor de email)
  - API v3: POST https://api.sendgrid.com/v3/mail/send
  - Event Webhook: notifica estados de envío

Estado actual de código
- Envío directo desde el controlador:
  - [EmailCampaignsController::start()](../backend/app/Http/Controllers/SaaS/EmailCampaignsController.php:213) resuelve audiencia exclusivamente desde Clientes, inserta recipients y procede a enviar emails iterando (respetando throttling básico usando sleep).
  - Se inyectan custom_args en cada envío: {campaign_id, recipient_id} para correlación en el webhook.
- Webhook de eventos:
  - [SendgridWebhookController::handle()](../backend/app/Http/Controllers/Api/SendgridWebhookController.php:1) recibe un array de eventos y actualiza estados por prioridad:
    - sent -> delivered -> opened -> clicked
    - failed solo si aún no se había alcanzado delivered.
  - Actualiza timestamps sent_at, delivered_at, opened_at, clicked_at y last_error en caso de fallas.
- Rutas expuestas:
  - pública: POST /api/webhooks/sendgrid/events en [api.php](../backend/routes/api.php:105) y [api_secure.php](../backend/routes/api_secure.php:45).
  - SaaS (Firebase/UnifiedAuth): /api/saas/email-campaigns/* (index/store/start/status/recipients).
- Variables de entorno de ejemplo:
  - Ver [backend/.env.example](../backend/.env.example:50)
    - SENDGRID_API_KEY=
    - SENDGRID_FROM_EMAIL=no-reply@example.com
    - SENDGRID_FROM_NAME="${APP_NAME}"
    - SENDGRID_WEBHOOK_TOKEN= (opcional para proteger el webhook con Authorization: Bearer)

Requisitos previos en SendGrid
1) Verificar remitente
- En SendGrid, configura y verifica un sender (single sender) o un dominio de envío.
- Usa el correo verificado como valor para SENDGRID_FROM_EMAIL.

2) Crear API Key
- Navega a Settings > API Keys > Create API Key (Full Access o al menos permisos para Mail Send).
- Copia el valor y configúralo en el backend como SENDGRID_API_KEY.

3) Configurar Event Webhook
- En SendGrid:
  - Settings > Mail Settings > Event Webhook.
  - HTTP POST URL: https://TU_BACKEND/api/webhooks/sendgrid/events
  - Authentication: Header Authorization (opcional pero recomendado).
    - Si lo habilitas, define SENDGRID_WEBHOOK_TOKEN en el .env del backend, y en SendGrid envía: Authorization: Bearer TU_TOKEN.
  - Selecciona eventos a notificar (recomendado):
    - processed, delivered, open, click, bounce, dropped, spamreport, blocked.
  - Guarda la configuración y usa el botón de Test para validar (SendGrid enviará eventos de prueba).

Configuración en backend (.env)
- Edita backend/.env (o variables de entorno en tu plataforma) y define:
  - SENDGRID_API_KEY=sk_live_o_test_de_sendgrid
  - SENDGRID_FROM_EMAIL=remitente@tudominio.com
  - SENDGRID_FROM_NAME=TuNombre
  - SENDGRID_WEBHOOK_TOKEN=opcional_token_largo (si protegerás el webhook)

- Limpia caches y reinicia el servidor:
  - php artisan config:clear
  - php artisan optimize:clear
  - php artisan serve ...

Flujo de ejecución
1) Creación de campaña (draft)
- POST /api/saas/email-campaigns con subject, content, throttling_per_minute y audience_type='segment' (clientes del sistema).
- El backend crea registros en campaigns y prepara estado draft.

2) Inicio de campaña
- POST /api/saas/email-campaigns/{id}/start
- [EmailCampaignsController::start()](../backend/app/Http/Controllers/SaaS/EmailCampaignsController.php:213):
  - Valida estado de la campaña (draft|paused|scheduled).
  - Resuelve audiencia de Clientes del broker con email válido.
  - Inserta recipients en email_campaign_recipients (status=pending).
  - Cambia campaña a running.
  - Envío:
    - Para cada recipient:
      - Construye payload SendGrid con subject, content (html), personalizations, y custom_args (campaign_id, recipient_id).
      - POST a /v3/mail/send con Authorization: Bearer SENDGRID_API_KEY.
      - En status 202: marca recipient como sent (sent_at), guarda X-Message-Id si está presente.
      - En otros códigos: marca failed y registra last_error.
    - Respeta throttling simple: 60 / throttling_per_minute (sleep entre envíos).
  - Retorna JSON con sent_attempted y sent_ok.

3) Eventos de SendGrid -> Backend
- Twilio SendGrid envía eventos a /api/webhooks/sendgrid/events.
- [SendgridWebhookController::handle()](../backend/app/Http/Controllers/Api/SendgridWebhookController.php:1):
  - Procesa cada evento (delivered, open, click, bounce, etc.).
  - Resuelve recipient por recipient_id (custom_args) o provider_message_id o email.
  - Actualiza status y timestamps.
  - Refresca métricas agregadas de la campaña (refreshStats).

Buenas prácticas y robustez
- Seguridad del Webhook:
  - Define SENDGRID_WEBHOOK_TOKEN y exige Authorization: Bearer en el webhook.
  - Opcional: restringe IPs en reverse proxy (Cloudflare/WAF) a rangos de SendGrid.
- Manejo de rate limits y reintentos:
  - Actualmente, el envío es directo desde el controlador con pausas.
  - Para alto volumen, migrar a colas con Jobs:
    - Crear un servicio: SendGridEmailService con método sendEmail.
    - Job ProcessEmailCampaignJob: pagina recipients en pending y encola SendEmailRecipientJob.
    - Job SendEmailRecipientJob: intenta envío, maneja 429/5xx con reintentos y backoff.
  - Configurar QUEUE_CONNECTION=database y ejecutar migraciones (php artisan queue:table; php artisan migrate) y un worker (php artisan queue:work).
- Plantillas/variables:
  - Se soporta reemplazo simple con {{clave}} sobre el HTML de content.
  - Para plantillas de SendGrid (Dynamic Templates), el servicio podría mapear template_id y dynamic_template_data (futuro).

Plan de siguientes mejoras (sugerido)
- Extraer lógica de envío a [SendGridEmailService::sendEmail()](../backend/app/Services/SendGridEmailService.php:1) y Jobs para colas.
- Añadir control de concurrencia y límites anti-spam por broker (por ejemplo, tope de 60/min).
- Registrar métricas de envío (enviados, entregados, abiertos, clics, fallidos) y exponer un dashboard simple en frontend.
- Deprecar completamente artefactos n8n restantes:
  - Controlador N8nEmailWebhookController (ya sin uso de rutas).
  - Documentación previa en /architecture/n8n_email_dispatch_setup.txt (marcar como deprecated).

Checklist de validación rápida
- ENV configurado (SENDGRID_API_KEY, remitente, token webhook opcional).
- Remitente verificado en SendGrid.
- Ruta POST /api/webhooks/sendgrid/events accesible y probada (HTTP 200).
- Crear campaña pequeña (5-10 destinatarios) y lanzar start:
  - Verificar sent_ok y que lleguen correos.
  - A los pocos minutos, validar /recipients y /status reflejen delivered/opened/clicked si pruebas con tus correos.

Referencias
- Twilio SendGrid Mail Send API v3: https://docs.sendgrid.com/api-reference/mail-send/mail-send
- Twilio SendGrid Event Webhook: https://docs.sendgrid.com/for-developers/tracking-events/event