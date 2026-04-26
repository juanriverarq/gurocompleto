<?php
/**
 * Fix: Wire option next_node_id into each option + strip emoji prefixes from labels
 * Run: /opt/cpanel/ea-php83/root/usr/bin/php fix_proyectamosv3_routes.php
 */
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\ChatbotNode;
use Illuminate\Support\Facades\DB;

$CHATBOT_ID = 22;
$FLOW_ID = 36;

// Get all question nodes for this flow
$questionNodes = ChatbotNode::where('flow_id', $FLOW_ID)
    ->whereIn('node_type', ['question', 'options'])
    ->get();

echo "Found " . $questionNodes->count() . " question nodes to fix\n\n";

$fixed = 0;
$errors = 0;

DB::beginTransaction();
try {
    foreach ($questionNodes as $node) {
        $rawConfig = json_decode($node->getAttributes()['config'], true) ?? [];
        $options = $rawConfig['options'] ?? [];
        $optionRoutes = $rawConfig['option_routes'] ?? [];

        if (empty($options)) continue;

        $changed = false;

        // 1. Strip emoji prefixes from labels (system adds them automatically)
        // Pattern: "1️⃣ Autos" -> "Autos", "🔙 Volver" -> "Volver", "💬 Hablar" -> "Hablar", "🔟 Canales" -> "Canales"
        foreach ($options as &$opt) {
            $label = $opt['label'] ?? $opt['text'] ?? '';
            // Strip leading emoji number patterns: 1️⃣, 2️⃣, ..., 🔟
            $cleaned = preg_replace('/^[0-9️⃣🔟]+\s*/', '', $label);
            // Strip leading misc emojis (💬, 🔙, etc) only if followed by space
            $cleaned = preg_replace('/^[\x{1F300}-\x{1F9FF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}]\s*/u', '', $cleaned);
            $cleaned = trim($cleaned);
            if ($cleaned !== $label) {
                if (isset($opt['label'])) $opt['label'] = $cleaned;
                if (isset($opt['text'])) $opt['text'] = $cleaned;
                $changed = true;
            }
        }
        unset($opt);

        // 2. Wire next_node_id into each option from option_routes
        if (!empty($optionRoutes)) {
            foreach ($options as &$opt) {
                $value = $opt['value'] ?? '';
                if (isset($optionRoutes[$value])) {
                    $opt['next_node_id'] = (int) $optionRoutes[$value];
                    $changed = true;
                }
            }
            unset($opt);
        }

        if ($changed) {
            $rawConfig['options'] = $options;
            // Keep option_routes for reference but options now have next_node_id
            DB::table('chatbot_nodes')->where('id', $node->id)->update([
                'config' => json_encode($rawConfig),
            ]);
            echo "✅ Fixed: {$node->name} (ID:{$node->id}) - " . count($options) . " options\n";
            $fixed++;
        }
    }

    DB::commit();
    echo "\n✅ Done! Fixed {$fixed} nodes, {$errors} errors\n";

} catch (\Throwable $e) {
    DB::rollBack();
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
