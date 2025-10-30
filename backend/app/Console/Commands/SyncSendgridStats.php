<?php

namespace App\Console\Commands;

use App\Models\EmailCampaign;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SyncSendgridStats extends Command
{
    protected $signature = 'sendgrid:sync-stats {--campaign_id= : Sync specific campaign} {--activity-feed : Force Activity Feed sync (requires API permissions)}';
    protected $description = 'Sync email campaign statistics from SendGrid API';

    public function handle()
    {
        $apiKey = env('SENDGRID_API_KEY');
        if (!$apiKey) {
            $this->error('SENDGRID_API_KEY not configured');
            return 1;
        }

        // Check Activity Feed permissions if requested
        if ($this->option('activity-feed')) {
            $hasPermissions = $this->checkActivityFeedPermissions($apiKey);
            if (!$hasPermissions) {
                $this->error('API key does not have Activity Feed permissions. Either:');
                $this->error('1. Configure webhook in SendGrid for real-time events');
                $this->error('2. Update API key permissions to include Activity Feed access');
                return 1;
            }
        }

        $campaignId = $this->option('campaign_id');

        if ($campaignId) {
            $campaign = EmailCampaign::find($campaignId);
            if (!$campaign) {
                $this->error("Campaign {$campaignId} not found");
                return 1;
            }
            $this->syncCampaignStats($campaign, $apiKey);
        } else {
            $this->syncAllActiveCampaigns($apiKey);
        }

        return 0;
    }

    private function syncAllActiveCampaigns(string $apiKey)
    {
        $campaigns = EmailCampaign::whereIn('status', ['running', 'active', 'pending'])
            ->where('is_active', true)
            ->get();

        $this->info("Found {$campaigns->count()} active campaigns to sync");

        foreach ($campaigns as $campaign) {
            $this->syncCampaignStats($campaign, $apiKey);
            // Small delay to avoid rate limiting
            sleep(1);
        }
    }

    private function syncCampaignStats(EmailCampaign $campaign, string $apiKey)
    {
        try {
            $this->info("Syncing stats for campaign: {$campaign->name} (ID: {$campaign->id})");

            // Since campaigns are sent via /v3/mail/send (not Marketing API),
            // we need to aggregate stats from individual recipients' events
            // The webhook should have updated recipient statuses, so we just refresh our local stats

            $campaign->refreshStats();

            $stats = $campaign->stats_json ?? [];
            $sent = $stats['sent'] ?? 0;
            $delivered = $stats['delivered'] ?? 0;
            $opened = $stats['opened'] ?? 0;
            $clicked = $stats['clicked'] ?? 0;

            // Update last sync timestamp
            $campaign->update(['last_stats_sync' => now()]);

            $this->info("✓ Refreshed local stats for campaign {$campaign->name}: " .
                "Sent: {$sent}, Delivered: {$delivered}, Opened: {$opened}, Clicked: {$clicked}");

            // Try to get additional stats from SendGrid Activity Feed (only if explicitly requested)
            if ($this->option('activity-feed')) {
                $this->syncFromActivityFeed($campaign, $apiKey);
            } else {
                $this->info("Skipping Activity Feed sync (use --activity-feed to enable, requires API permissions)");
            }

        } catch (\Exception $e) {
            $this->error("Error syncing campaign {$campaign->name}: " . $e->getMessage());
            Log::error('SendGrid stats sync error', [
                'campaign_id' => $campaign->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Sync from SendGrid Activity Feed - queries historical events for campaign emails
     */
    private function syncFromActivityFeed(EmailCampaign $campaign, string $apiKey)
    {
        try {
            // Get recipients with message_ids
            $recipients = $campaign->recipients()
                ->whereNotNull('provider_message_id')
                ->where('provider_message_id', '!=', '')
                ->where('status', '!=', 'pending')
                ->get();

            if ($recipients->isEmpty()) {
                $this->warn("No valid message_ids found for campaign {$campaign->name} - cannot query Activity Feed");
                return;
            }

            $this->info("Querying Activity Feed for {$recipients->count()} messages in campaign {$campaign->name}");

            $stats = [
                'sent' => 0,
                'delivered' => 0,
                'opened' => 0,
                'clicked' => 0,
                'bounced' => 0,
                'failed' => 0,
            ];

            $batchSize = 5; // Smaller batch for rate limiting
            $processed = 0;

            foreach ($recipients->chunk($batchSize) as $batch) {
                foreach ($batch as $recipient) {
                    try {
                        $processed++;

                        // Query events for this specific message using different ID formats
                        $messageId = $recipient->provider_message_id;
                        $events = $this->queryMessageEvents($apiKey, $messageId);

                        if (!empty($events)) {
                            // Process events for this message
                            $messageEvents = [];
                            foreach ($events as $event) {
                                $eventType = strtolower($event['event'] ?? '');
                                if ($eventType) {
                                    $messageEvents[$eventType] = true;
                                }
                            }

                            // Update recipient status based on latest event
                            $latestStatus = $this->determineStatusFromEvents($messageEvents);
                            if ($latestStatus && $latestStatus !== $recipient->status) {
                                $recipient->update(['status' => $latestStatus]);
                                $this->info("Updated recipient {$recipient->email} status to {$latestStatus}");
                            }

                            // Count for campaign stats
                            if (isset($messageEvents['delivered'])) $stats['delivered']++;
                            if (isset($messageEvents['open']) || isset($messageEvents['opened'])) $stats['opened']++;
                            if (isset($messageEvents['click']) || isset($messageEvents['clicked'])) $stats['clicked']++;
                            if (isset($messageEvents['bounce'])) $stats['bounced']++;
                            if (isset($messageEvents['dropped']) || isset($messageEvents['blocked'])) $stats['failed']++;
                        }

                        // Progress indicator
                        if ($processed % 10 === 0) {
                            $this->info("Processed {$processed}/{$recipients->count()} messages...");
                        }

                        // Rate limiting - SendGrid allows ~100 requests/minute
                        usleep(200000); // 200ms delay between requests

                    } catch (\Exception $e) {
                        $this->warn("Error querying events for message {$messageId}: " . $e->getMessage());
                    }
                }
            }

            // Update campaign with aggregated stats
            $stats['sent'] = $recipients->count();
            $stats['delivery_rate'] = $stats['sent'] > 0 ? round(($stats['delivered'] / $stats['sent']) * 100, 2) : 0;
            $stats['open_rate'] = $stats['sent'] > 0 ? round(($stats['opened'] / $stats['sent']) * 100, 2) : 0;
            $stats['click_rate'] = $stats['sent'] > 0 ? round(($stats['clicked'] / $stats['sent']) * 100, 2) : 0;

            $campaign->update([
                'stats_json' => $stats,
                'last_stats_sync' => now(),
            ]);

            $this->info("✓ Updated Activity Feed stats for campaign {$campaign->name}: " .
                "Sent: {$stats['sent']}, Delivered: {$stats['delivered']}, Opened: {$stats['opened']}, Clicked: {$stats['clicked']}");

        } catch (\Exception $e) {
            $this->error("Error syncing from Activity Feed for campaign {$campaign->name}: " . $e->getMessage());
        }
    }

    private function queryMessageEvents(string $apiKey, string $messageId): array
    {
        // Try different query formats for SendGrid message lookup
        $queryFormats = [
            "msg_id=\"{$messageId}\"",
            "smtp-id=\"{$messageId}\"",
            "message_id=\"{$messageId}\"",
        ];

        foreach ($queryFormats as $query) {
            try {
                $this->info("Trying query: {$query}");

                $response = Http::withHeaders([
                    'Authorization' => 'Bearer ' . $apiKey,
                ])->timeout(30)->get('https://api.sendgrid.com/v3/messages', [
                    'query' => $query,
                    'limit' => 50, // Get up to 50 events per message
                ]);

                $this->info("Response status: {$response->status()}");

                if ($response->successful()) {
                    $data = $response->json();
                    $this->info("Response data count: " . (is_array($data) ? count($data) : 'not array'));

                    if (is_array($data) && !empty($data)) {
                        $this->info("Found " . count($data) . " events for message {$messageId}");
                        return $data;
                    }
                } elseif ($response->status() === 429) {
                    // Rate limited - wait longer
                    $this->warn("Rate limited, waiting 5 seconds...");
                    sleep(5);
                    continue;
                } elseif ($response->status() === 401) {
                    $this->error("Authentication failed - check API key");
                    break;
                } else {
                    $this->warn("Query failed: {$response->status()} - {$response->body()}");
                }
            } catch (\Exception $e) {
                $this->warn("Exception querying {$query}: " . $e->getMessage());
                continue;
            }
        }

        $this->warn("No events found for message_id: {$messageId}");
        return [];
    }

    private function checkActivityFeedPermissions(string $apiKey): bool
    {
        try {
            // Try a simple query to check permissions
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $apiKey,
            ])->timeout(10)->get('https://api.sendgrid.com/v3/messages', [
                'limit' => 1,
            ]);

            return $response->successful() || $response->status() === 404; // 404 means no messages, but API accessible
        } catch (\Exception $e) {
            return false;
        }
    }

    private function determineStatusFromEvents(array $events): ?string
    {
        // Priority order: failed > bounced > delivered > opened > clicked > sent
        if (isset($events['bounce']) || isset($events['dropped']) || isset($events['blocked'])) {
            return 'bounced';
        }
        if (isset($events['click'])) {
            return 'clicked';
        }
        if (isset($events['open'])) {
            return 'opened';
        }
        if (isset($events['delivered'])) {
            return 'delivered';
        }
        if (isset($events['processed'])) {
            return 'sent';
        }
        return null;
    }
}