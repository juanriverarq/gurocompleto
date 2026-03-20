<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class AplicacionEmpleoController extends Controller
{
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'telefono' => 'required|string|max:30',
            'ciudad' => 'required|string|max:100',
            'experiencia_seguros' => 'required|string|max:255',
            'experiencia_anos' => 'required|string|max:100',
            'experiencia_crm' => 'nullable|string|max:255',
            'disponibilidad' => 'required|string|max:100',
            'aspiracion_salarial' => 'nullable|string|max:100',
            'linkedin' => 'nullable|string|max:500',
            'mensaje' => 'nullable|string|max:5000',
            'hojaDeVida' => 'required|file|mimes:pdf,doc,docx|max:5120',
        ], [
            'nombre.required' => 'El nombre es obligatorio.',
            'email.required' => 'El correo electrónico es obligatorio.',
            'telefono.required' => 'El teléfono es obligatorio.',
            'ciudad.required' => 'La ciudad es obligatoria.',
            'experiencia_seguros.required' => 'La experiencia en seguros es obligatoria.',
            'experiencia_anos.required' => 'Los años de experiencia son obligatorios.',
            'disponibilidad.required' => 'La disponibilidad es obligatoria.',
            'hojaDeVida.required' => 'La hoja de vida es obligatoria.',
            'hojaDeVida.mimes' => 'La hoja de vida debe ser PDF, DOC o DOCX.',
            'hojaDeVida.max' => 'La hoja de vida no debe superar 5MB.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $data = $validator->validated();

            $htmlBody = $this->buildEmailHtml($data);
            $toEmail = 'juan@guro.co';
            $fromEmail = 'info@guro.co';
            $fromName = 'Guro Empleos';
            $replyTo = $data['email'];
            $subject = '=?UTF-8?B?' . base64_encode('Nueva aplicacion de empleo - ' . $data['nombre']) . '?=';

            // MIME boundary
            $boundary = md5(uniqid(time()));

            // Headers
            $headers = implode("\r\n", [
                "From: {$fromName} <{$fromEmail}>",
                "Reply-To: {$data['nombre']} <{$replyTo}>",
                "MIME-Version: 1.0",
                "Content-Type: multipart/mixed; boundary=\"{$boundary}\"",
                "X-Mailer: Guro/1.0",
            ]);

            // Body: HTML part
            $body = "--{$boundary}\r\n";
            $body .= "Content-Type: text/html; charset=UTF-8\r\n";
            $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
            $body .= chunk_split(base64_encode($htmlBody)) . "\r\n";

            // Body: Attachment
            if ($request->hasFile('hojaDeVida')) {
                $file = $request->file('hojaDeVida');
                $fileName = $file->getClientOriginalName();
                $fileMime = $file->getMimeType();
                $fileContent = file_get_contents($file->getRealPath());

                $body .= "--{$boundary}\r\n";
                $body .= "Content-Type: {$fileMime}; name=\"{$fileName}\"\r\n";
                $body .= "Content-Disposition: attachment; filename=\"{$fileName}\"\r\n";
                $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
                $body .= chunk_split(base64_encode($fileContent)) . "\r\n";
            }

            $body .= "--{$boundary}--\r\n";

            // Send via PHP mail() — Exim routes guro.co to Google Workspace via MX
            $sent = mail($toEmail, $subject, $body, $headers, "-f {$fromEmail}");

            if ($sent) {
                Log::info('AplicacionEmpleo: Email enviado exitosamente via mail()', [
                    'nombre' => $data['nombre'],
                    'email' => $data['email'],
                    'to' => $toEmail,
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Aplicación enviada exitosamente.',
                ]);
            } else {
                Log::error('AplicacionEmpleo: mail() retornó false', [
                    'to' => $toEmail,
                    'from' => $fromEmail,
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Error al enviar el correo. Intenta nuevamente.',
                ], 500);
            }
        } catch (\Throwable $e) {
            Log::error('AplicacionEmpleo: Excepción', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error interno del servidor.',
            ], 500);
        }
    }

    private function buildEmailHtml(array $data): string
    {
        $experienciaCrm = $data['experiencia_crm'] ?? 'No especificado';
        $aspiracion = $data['aspiracion_salarial'] ?? 'No especificada';
        $linkedin = !empty($data['linkedin']) ? '<a href="' . e($data['linkedin']) . '" style="color:#573CFF;">' . e($data['linkedin']) . '</a>' : 'No proporcionado';
        $mensaje = !empty($data['mensaje']) ? nl2br(e($data['mensaje'])) : 'Sin mensaje adicional';

        return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <!-- Header -->
  <div style="background:#0d0d0d;padding:32px 24px;text-align:center;">
    <h1 style="color:#ffffff;font-size:22px;margin:0 0 8px 0;font-weight:700;">📋 Nueva Aplicación de Empleo</h1>
    <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0;">Ejecutivo Comercial — Trabaja con Nosotros</p>
  </div>

  <!-- Content -->
  <div style="padding:32px 24px;">
    <!-- Personal Info -->
    <div style="margin-bottom:24px;">
      <h2 style="color:#573CFF;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 16px 0;font-weight:700;">Datos Personales</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px;width:140px;vertical-align:top;">Nombre</td>
          <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">{$data['nombre']}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Email</td>
          <td style="padding:8px 0;color:#111827;font-size:14px;"><a href="mailto:{$data['email']}" style="color:#573CFF;">{$data['email']}</a></td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Teléfono</td>
          <td style="padding:8px 0;color:#111827;font-size:14px;">{$data['telefono']}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Ciudad</td>
          <td style="padding:8px 0;color:#111827;font-size:14px;">{$data['ciudad']}</td>
        </tr>
      </table>
    </div>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px 0;">

    <!-- Experience -->
    <div style="margin-bottom:24px;">
      <h2 style="color:#573CFF;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 16px 0;font-weight:700;">Experiencia</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px;width:140px;vertical-align:top;">Seguros</td>
          <td style="padding:8px 0;color:#111827;font-size:14px;">{$data['experiencia_seguros']}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Años</td>
          <td style="padding:8px 0;color:#111827;font-size:14px;">{$data['experiencia_anos']}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top;">CRM</td>
          <td style="padding:8px 0;color:#111827;font-size:14px;">{$experienciaCrm}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Disponibilidad</td>
          <td style="padding:8px 0;color:#111827;font-size:14px;">{$data['disponibilidad']}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top;">Aspiración</td>
          <td style="padding:8px 0;color:#111827;font-size:14px;">{$aspiracion}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top;">LinkedIn</td>
          <td style="padding:8px 0;font-size:14px;">{$linkedin}</td>
        </tr>
      </table>
    </div>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px 0;">

    <!-- Message -->
    <div>
      <h2 style="color:#573CFF;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px 0;font-weight:700;">Mensaje Adicional</h2>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;color:#374151;font-size:14px;line-height:1.6;">{$mensaje}</div>
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#f9fafb;padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">📎 La hoja de vida está adjunta a este correo.</p>
    <p style="color:#9ca3af;font-size:11px;margin:8px 0 0 0;">Enviado desde guro.co/trabaja-con-nosotros</p>
  </div>
</div>
</body>
</html>
HTML;
    }
}
