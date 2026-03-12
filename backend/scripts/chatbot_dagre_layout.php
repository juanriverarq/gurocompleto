<?php
/**
 * Dagre-style automatic layout for chatbot flow nodes.
 * 
 * Algorithm: BFS from start node to assign ranks (depth levels),
 * then distribute nodes horizontally within each rank.
 * 
 * Config:
 *   rankdir = TB (top-to-bottom)
 *   ranksep = 300 (vertical spacing between ranks)
 *   nodesep = 280 (horizontal spacing between nodes in same rank)
 *   nodeWidth = 220
 *   nodeHeight = 80
 */

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\ChatbotNode;
use App\Models\ChatbotFlow;

$flowId = 6;
$ranksep = 300;  // vertical gap between levels
$nodesep = 280;  // horizontal gap between sibling nodes
$nodeWidth = 220;

// ============================================================
// 1. Load all nodes and build adjacency list
// ============================================================
$nodes = ChatbotNode::where('flow_id', $flowId)->get()->keyBy('id');
echo "Loaded " . $nodes->count() . " nodes\n";

// Build edges: parent -> [children] preserving option order
$children = [];   // nodeId => [childId, ...]
$parents = [];    // nodeId => parentId (first parent found)

foreach ($nodes as $id => $node) {
    $kids = [];
    
    // Options/questions link via config.options[].next_node_id
    $options = $node->config['options'] ?? [];
    foreach ($options as $opt) {
        $nextId = $opt['next_node_id'] ?? null;
        if ($nextId && isset($nodes[(int)$nextId])) {
            $nextId = (int)$nextId;
            if (!in_array($nextId, $kids)) {
                $kids[] = $nextId;
            }
        }
    }
    
    // Direct next_node_id
    if ($node->next_node_id && isset($nodes[$node->next_node_id])) {
        if (!in_array($node->next_node_id, $kids)) {
            $kids[] = $node->next_node_id;
        }
    }
    
    $children[$id] = $kids;
    foreach ($kids as $kid) {
        if (!isset($parents[$kid])) {
            $parents[$kid] = $id;
        }
    }
}

// ============================================================
// 2. BFS to assign ranks (depth levels) from start node
//    Filter out back-edges (e.g. "Volver al menú") to avoid cycles
// ============================================================
$startNode = $nodes->firstWhere('node_type', 'start');
if (!$startNode) {
    echo "ERROR: No start node found\n";
    exit(1);
}

$rank = [];       // nodeId => rank (depth level)
$rankNodes = [];  // rank => [nodeId, ...]
$visited = [];
$queue = new SplQueue();

$queue->enqueue($startNode->id);
$rank[$startNode->id] = 0;
$visited[$startNode->id] = true;

while (!$queue->isEmpty()) {
    $currentId = $queue->dequeue();
    $currentRank = $rank[$currentId];
    
    $rk = $currentRank;
    if (!isset($rankNodes[$rk])) $rankNodes[$rk] = [];
    $rankNodes[$rk][] = $currentId;
    
    foreach ($children[$currentId] ?? [] as $childId) {
        // Skip back-edges (child already visited at same or lower rank = back edge)
        if (isset($visited[$childId])) {
            continue;
        }
        
        $rank[$childId] = $currentRank + 1;
        $visited[$childId] = true;
        $queue->enqueue($childId);
    }
}

// Assign any unvisited nodes (orphans) to last rank
$maxRank = empty($rankNodes) ? 0 : max(array_keys($rankNodes));
foreach ($nodes as $id => $node) {
    if (!isset($rank[$id])) {
        $maxRank++;
        $rank[$id] = $maxRank;
        $rankNodes[$maxRank][] = $id;
        echo "  Orphan node $id ({$node->name}) placed at rank $maxRank\n";
    }
}

ksort($rankNodes);
echo "\nRank distribution:\n";
foreach ($rankNodes as $r => $nids) {
    $names = array_map(fn($id) => $nodes[$id]->name, $nids);
    echo "  Rank $r (" . count($nids) . "): " . implode(', ', $names) . "\n";
}

// ============================================================
// 3. Order nodes within each rank to minimize edge crossings
//    Use median heuristic: order children by parent position
// ============================================================
// For rank 0, order is fixed (start node)
// For rank N, order children based on the order they appear in parent's options

$rankOrder = []; // rank => [nodeId in order]
$rankOrder[0] = $rankNodes[0];

// Position index of each node within its rank (updated as we go)
$nodeIndex = []; // nodeId => index within rank
foreach ($rankOrder[0] as $i => $nid) {
    $nodeIndex[$nid] = $i;
}

for ($r = 1; $r <= $maxRank; $r++) {
    if (!isset($rankNodes[$r])) continue;
    
    $nodesInRank = $rankNodes[$r];
    
    // For each node in this rank, compute median position of parents in previous rank
    $medians = [];
    foreach ($nodesInRank as $nid) {
        // Find all parents in previous ranks
        $parentPositions = [];
        foreach ($nodes as $pid => $pnode) {
            if (!isset($rank[$pid]) || $rank[$pid] >= $r) continue;
            $pChildren = $children[$pid] ?? [];
            if (in_array($nid, $pChildren)) {
                // Use parent's index, plus child's order within parent's children for stability
                $childOrder = array_search($nid, $pChildren);
                $parentPos = ($nodeIndex[$pid] ?? 0) * 100 + $childOrder;
                $parentPositions[] = $parentPos;
            }
        }
        
        if (empty($parentPositions)) {
            $medians[$nid] = PHP_INT_MAX; // Put orphans at the end
        } else {
            sort($parentPositions);
            $mid = intdiv(count($parentPositions), 2);
            $medians[$nid] = $parentPositions[$mid];
        }
    }
    
    // Sort by median
    usort($nodesInRank, fn($a, $b) => ($medians[$a] ?? 0) <=> ($medians[$b] ?? 0));
    
    $rankOrder[$r] = $nodesInRank;
    foreach ($nodesInRank as $i => $nid) {
        $nodeIndex[$nid] = $i;
    }
}

// ============================================================
// 4. Assign X,Y positions
//    Y = rank * ranksep
//    X = centered around 0, spaced by nodesep
// ============================================================
$positions = [];

foreach ($rankOrder as $r => $nodesInRank) {
    $count = count($nodesInRank);
    $totalWidth = ($count - 1) * $nodesep;
    $startX = -$totalWidth / 2;
    
    $y = $r * $ranksep;
    
    foreach ($nodesInRank as $i => $nid) {
        $x = $startX + $i * $nodesep;
        $positions[$nid] = [(int)round($x), (int)round($y)];
    }
}

// ============================================================
// 5. Apply positions to database
// ============================================================
echo "\nApplying positions:\n";
$updated = 0;
foreach ($positions as $nodeId => [$x, $y]) {
    $node = $nodes[$nodeId] ?? null;
    if ($node) {
        $node->update(['position_x' => $x, 'position_y' => $y]);
        echo "  {$node->name}: ($x, $y)\n";
        $updated++;
    }
}

echo "\nUpdated $updated nodes\n";
echo "DONE\n";
