<?php

// Quick end-to-end test for SendGrid Event Webhook:
// - Creates a minimal EmailCampaign and one EmailCampaignRecipient
// - Sends a simulated array of SendGrid events (delivered, open, click) to the webhook
// - Reloads the recipient from DB and prints final status/timestamps

declare(strict_types=1);

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Str;

require __DIR__ . '/../vendor/autoload.php';

/** @var \Illuminate\Foundation\Application $app */
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

try {
    // Resolve classes with full namespace, no imports needed
    $CampaignClass = \App\Models\EmailCampaign::class;
    $RecipientClass = \App\Models\EmailCampaignRecipient::class;

    // Create a minimal campaign in draft
    /** @var \App\Models\EmailCampaign $campaign */
    $campaign = new $CampaignClass();
    $campaign->broker_id = 2; // broker de prueba
    $campaign->name = 'Webhook Test ' . Str::uuid()->toString();
    $campaign->description = 'Test webhook SendGrid';
    $campaign->template_id = null;
    $campaign->subject = 'Subject webhook test';
    $campaign->content = '<b>Hola {{nombre}}</b>';
    $campaign->audience_type = 'segment';
    $campaign->csv_upload_id = null;
    $campaign->segment_filters = [];
    $campaign->throttling_per_minute = 30;
    $campaign->window_start = '00:00';
    $campaign->window_end = '23:59';
    $campaign->timezone = 'America/Bogota';
    $campaign->is_active = false;
    $campaign->status = 'draft';
    $campaign->created_by = null;
    $campaign->save();

    // Create one recipient in pending
    /** @var \App\Models\EmailCampaignRecipient $recipient */
    $recipient = new $RecipientClass();
    $recipient->campaign_id = $campaign->id;
    $recipient->broker_id = 2;
    $recipient->cliente_id = null;
    $recipient->email = 'testwebhook+' . $campaign->id . '@example.com';
    $recipient->name = 'Test Webhook';
    $recipient->variables_resolved = '{}';
    $recipient->status = 'pending';
    $recipient->created_at = now();
    $recipient->updated_at = now();
    $recipient->save();

    $data = [
        'campaign_id' => $campaign->id,
        'recipient_id' => $recipient->id,
        'email' => $recipient->email,
    ];

    echo "== Created Test Data ==\n";
    echo json_encode($data, JSON_UNESCAPED_SLASHES) . "\n\n";

    // Prepare SendGrid-like events payload
    $sgId = 'sg_test_' . $recipient->id . '_1';
    $now = time();

    $events = [
        [
            'event' => 'delivered',
            'email' => $recipient->email,
            'sg_message_id' => $sgId,
            'timestamp' => $now,
            'custom_args' => [
                'campaign_id' => $campaign->id,
                'recipient_id' => $recipient->id,
            ],
        ],
        [
            'event' => 'open',
            'email' => $recipient->email,
            'sg_message_id' => $sgId,
            'timestamp' => $now,
            'custom_args' => [
                'campaign_id' => $campaign->id,
                'recipient_id' => $recipient->id,
            ],
        ],
        [
            'event' => 'click',
            'email' => $recipient->email,
            'sg_message_id' => $sgId,
            'timestamp' => $now,
            'custom_args' => [
                'campaign_id' => $campaign->id,
                'recipient_id' => $recipient->id,
            ],
        ],
    ];

    // Post to local webhook (make sure backend is running on :8001)
    $webhookUrl = 'http://127.0.0.1:8001/api/webhooks/sendgrid/events';

    // Optional Authorization if you set SENDGRID_WEBHOOK_TOKEN in .env
    $headers = [
        'Content-Type' => 'application/json',
    ];
    $token = (string) env('SENDGRID_WEBHOOK_TOKEN', '');
    if (!empty($token)) {
        $headers['Authorization'] = 'Bearer ' . $token;
    }

    /** @var \Illuminate\Http\Client\Response $resp */
    $resp = \Illuminate\Support\Facades\Http::withHeaders($headers)
        ->timeout(10)
        ->post($webhookUrl, $events);

    echo "== Webhook Response ==\n";
    echo "HTTP: " . $resp->status() . "\n";
    echo $resp->body() . "\n\n";

    // Reload recipient
    /** @var \App\Models\EmailCampaignRecipient|null $refreshed */
    $refreshed = $RecipientClass::find($recipient->id);

    if (!$refreshed) {
        echo "recipient_not_found\n";
        exit(0);
    }

    $out = [
        'id' => $refreshed->id,
        'campaign_id' => $refreshed->campaign_id,
        'email' => $refreshed->email,
        'status' => $refreshed->status,
        'sent_at' => (string) $refreshed->sent_at,
        'delivered_at' => (string) $refreshed->delivered_at,
        'opened_at' => (string) $refreshed->opened_at,
        'clicked_at' => (string) $refreshed->clicked_at,
        'failed_at' => (string) $refreshed->failed_at,
        'provider_message_id' => (string) $refreshed->provider_message_id,
    ];

    echo "== Recipient After Webhook ==\n";
    echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
} catch (\Throwable $e) {
    fwrite(STDERR, "ERROR: " . $e->getMessage() . "\n");
    fwrite(STDERR, $e->getTraceAsString() . "\n");
    exit(1);
}