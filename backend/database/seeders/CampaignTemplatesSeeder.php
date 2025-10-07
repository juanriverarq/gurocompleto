n<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\CampaignTemplate;
use App\Models\Broker;

class CampaignTemplatesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Obtener el primer broker para crear plantillas de ejemplo
        $broker = Broker::first();

        if (!$broker) {
            $this->command->info('No brokers found. Skipping campaign templates seeding.');
            return;
        }

        $templates = [
            [
                'name' => 'En Blanco',
                'content' => '<table style="width:100%;background:#f6f6f6;padding:20px">
  <tr>
    <td align="center">
      <table style="width:600px;background:white;border-radius:8px;padding:30px">
        <tr>
          <td>
            <h2 style="margin:0 0 20px;color:#111827;font-size:24px">Título de tu email</h2>
            <p style="margin:0 0 15px;color:#4b5563;font-size:14px;line-height:1.6">
              Escribe tu mensaje aquí. Puedes usar variables como {{nombre}}, {{email}}, {{numero_documento}}.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>',
                'category' => 'general',
                'description' => 'Plantilla en blanco lista para personalizar',
                'variables' => [
                    'nombre' => 'Nombre del cliente',
                    'email' => 'Email del cliente',
                    'numero_documento' => 'Documento del cliente'
                ],
                'is_active' => true,
                'is_default' => true
            ],
            [
                'name' => 'Bienvenida',
                'content' => '<table style="width:100%;background:#f6f6f6;padding:20px">
  <tr>
    <td align="center">
      <table style="width:600px;background:white;border-radius:8px;padding:30px">
        <tr>
          <td>
            <h1 style="margin:0 0 20px;color:#635BFF;font-size:28px;text-align:center">¡Bienvenido a GURO!</h1>
            <p style="margin:0 0 15px;color:#4b5563;font-size:14px;line-height:1.6">
              Hola <strong>{{nombre}}</strong>,
            </p>
            <p style="margin:0 0 20px;color:#4b5563;font-size:14px;line-height:1.6">
              Nos complace darte la bienvenida a nuestra plataforma. Estamos aquí para ayudarte con todas tus necesidades de seguros.
            </p>
            <table style="margin:20px 0;width:100%">
              <tr>
                <td align="center">
                  <a href="#" style="display:inline-block;padding:12px 30px;background:#635BFF;color:white;text-decoration:none;border-radius:6px;font-weight:600">Comenzar</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>',
                'category' => 'bienvenida',
                'description' => 'Plantilla de bienvenida para nuevos clientes',
                'variables' => [
                    'nombre' => 'Nombre del cliente'
                ],
                'is_active' => true,
                'is_default' => true
            ],
            [
                'name' => 'Renovación de Póliza',
                'content' => '<table style="width:100%;background:#f6f6f6;padding:20px">
  <tr>
    <td align="center">
      <table style="width:600px;background:white;border-radius:8px;padding:30px">
        <tr>
          <td>
            <h2 style="margin:0 0 20px;color:#111827;font-size:24px">Renovación de Póliza</h2>
            <p style="margin:0 0 15px;color:#4b5563;font-size:14px;line-height:1.6">
              Estimado/a <strong>{{nombre}}</strong>,
            </p>
            <p style="margin:0 0 15px;color:#4b5563;font-size:14px;line-height:1.6">
              Tu póliza <strong>{{numero_poliza}}</strong> está próxima a vencer. Te invitamos a renovarla para mantener tu cobertura activa.
            </p>
            <table style="width:100%;background:#f9fafb;border-radius:6px;padding:15px;margin:20px 0">
              <tr>
                <td>
                  <p style="margin:0 0 5px;color:#6b7280;font-size:12px">Fecha de vencimiento</p>
                  <p style="margin:0;color:#111827;font-size:16px;font-weight:600">{{fecha_vencimiento}}</p>
                </td>
              </tr>
            </table>
            <table style="margin:20px 0;width:100%">
              <tr>
                <td align="center">
                  <a href="#" style="display:inline-block;padding:12px 30px;background:#10b981;color:white;text-decoration:none;border-radius:6px;font-weight:600">Renovar Ahora</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>',
                'category' => 'renovaciones',
                'description' => 'Plantilla para recordar renovaciones de pólizas',
                'variables' => [
                    'nombre' => 'Nombre del cliente',
                    'numero_poliza' => 'Número de póliza',
                    'fecha_vencimiento' => 'Fecha de vencimiento'
                ],
                'is_active' => true,
                'is_default' => true
            ],
            [
                'name' => 'Recordatorio',
                'content' => '<table style="width:100%;background:#f6f6f6;padding:20px">
  <tr>
    <td align="center">
      <table style="width:600px;background:white;border-radius:8px;padding:30px">
        <tr>
          <td>
            <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:15px;margin:0 0 20px;border-radius:4px">
              <p style="margin:0;color:#92400e;font-size:14px;font-weight:600">⚠️ Recordatorio Importante</p>
            </div>
            <p style="margin:0 0 15px;color:#4b5563;font-size:14px;line-height:1.6">
              Hola <strong>{{nombre}}</strong>,
            </p>
            <p style="margin:0 0 15px;color:#4b5563;font-size:14px;line-height:1.6">
              Te recordamos que tienes una acción pendiente relacionada con tu póliza.
            </p>
            <table style="margin:20px 0;width:100%">
              <tr>
                <td align="center">
                  <a href="#" style="display:inline-block;padding:12px 30px;background:#635BFF;color:white;text-decoration:none;border-radius:6px;font-weight:600">Ver Detalles</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>',
                'category' => 'recordatorios',
                'description' => 'Plantilla para recordatorios importantes',
                'variables' => [
                    'nombre' => 'Nombre del cliente'
                ],
                'is_active' => true,
                'is_default' => true
            ],
            [
                'name' => 'Notificación',
                'content' => '<table style="width:100%;background:#f6f6f6;padding:20px">
  <tr>
    <td align="center">
      <table style="width:600px;background:white;border-radius:8px;padding:30px">
        <tr>
          <td>
            <h2 style="margin:0 0 20px;color:#111827;font-size:24px">Actualización de tu Cuenta</h2>
            <p style="margin:0 0 15px;color:#4b5563;font-size:14px;line-height:1.6">
              Hola <strong>{{nombre}}</strong>,
            </p>
            <p style="margin:0 0 20px;color:#4b5563;font-size:14px;line-height:1.6">
              Queremos informarte sobre una actualización importante en tu cuenta.
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
            <p style="margin:0;color:#6b7280;font-size:12px;text-align:center">
              Si tienes preguntas, contáctanos en soporte@guro.com
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>',
                'category' => 'notificaciones',
                'description' => 'Plantilla para notificaciones generales',
                'variables' => [
                    'nombre' => 'Nombre del cliente'
                ],
                'is_active' => true,
                'is_default' => true
            ]
        ];

        foreach ($templates as $templateData) {
            // Extraer variables del contenido
            $variablesList = $this->extractVariables($templateData['content']);

            CampaignTemplate::create([
                'broker_id' => $broker->id,
                'name' => $templateData['name'],
                'content' => $templateData['content'],
                'category' => $templateData['category'],
                'description' => $templateData['description'],
                'variables' => json_encode($templateData['variables']),
                'variables_list' => json_encode($variablesList),
                'is_active' => $templateData['is_active'],
                'is_default' => $templateData['is_default'],
                'usage_count' => 0
            ]);
        }

        $this->command->info('Campaign templates seeded successfully for broker: ' . $broker->name);
    }

    /**
     * Extract variables from template content
     */
    private function extractVariables(string $content): array
    {
        $matches = [];
        preg_match_all('/\{\{(\w+)\}\}/', $content, $matches);
        return array_unique($matches[1] ?? []);
    }
}