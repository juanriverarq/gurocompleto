<?php

namespace App\Console\Commands;

use App\Models\SalesFunnel;
use Illuminate\Console\Command;

class RecalculateLeadScores extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'sales:recalculate-scores';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Recalculate lead scores based on probability and quality rating';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Recalculating lead scores...');

        $leads = SalesFunnel::all();
        $updated = 0;

        foreach ($leads as $lead) {
            $oldScore = $lead->lead_score;
            $newScore = $lead->calculateLeadScore();

            if ($oldScore != $newScore) {
                $lead->update(['lead_score' => $newScore]);
                $updated++;

                $this->line("Lead #{$lead->id}: {$oldScore} -> {$newScore} (prob: {$lead->close_probability}%, quality: {$lead->quality_rating})");
            }
        }

        $this->info("Updated {$updated} leads out of {$leads->count()} total.");
        $this->info('Done!');

        return 0;
    }
}
