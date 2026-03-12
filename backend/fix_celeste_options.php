<?php
/**
 * Fix chatbot options - add next_node_id to each option
 * Run with: /opt/cpanel/ea-php83/root/usr/bin/php fix_celeste_options.php
 */

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\ChatbotNode;
use App\Models\ChatbotFlow;
use Illuminate\Support\Facades\DB;

// Find Celeste chatbot flow
$flow = ChatbotFlow::whereHas('chatbot', fn($q) => $q->where('broker_id', 53))->where('is_default', true)->first();
if (!$flow) { echo "❌ Flow not found\n"; exit(1); }
echo "✅ Flow ID: {$flow->id}\n";

// Get all nodes indexed by name for easy lookup
$nodes = ChatbotNode::where('flow_id', $flow->id)->get();
$byName = $nodes->keyBy('name');
$byId = $nodes->keyBy('id');

echo "📊 Total nodos: " . $nodes->count() . "\n\n";

// Helper to get node id by name
function nid($byName, $name) {
    $node = $byName->get($name);
    if (!$node) { echo "⚠️  Nodo no encontrado: {$name}\n"; return null; }
    return $node->id;
}

DB::beginTransaction();
try {
    $updated = 0;

    // For each question node, rebuild options with next_node_id
    foreach ($nodes as $node) {
        if (!in_array($node->node_type, ['question'])) continue;
        
        $config = $node->config;
        $options = $config['options'] ?? [];
        $optionRoutes = $config['option_routes'] ?? [];
        
        if (empty($options) || empty($optionRoutes)) continue;
        
        $newOptions = [];
        foreach ($options as $opt) {
            $value = $opt['value'] ?? null;
            if ($value && isset($optionRoutes[$value])) {
                $opt['next_node_id'] = $optionRoutes[$value];
            }
            $newOptions[] = $opt;
        }
        
        $config['options'] = $newOptions;
        // Keep option_routes for reference but options now have next_node_id
        $node->update(['config' => $config]);
        $updated++;
        echo "✅ Updated: {$node->name} ({$node->id}) - " . count($newOptions) . " options\n";
    }

    DB::commit();
    echo "\n🎉 Done! Updated {$updated} question nodes.\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ Error: " . $e->getMessage() . "\n";
}
