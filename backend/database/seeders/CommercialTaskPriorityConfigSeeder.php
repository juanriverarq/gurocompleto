<?php

namespace Database\Seeders;

use App\Models\Broker;
use App\Models\CommercialTaskPriorityConfig;
use Illuminate\Database\Seeder;

class CommercialTaskPriorityConfigSeeder extends Seeder
{
    public function run(): void
    {
        $brokers = Broker::pluck('id');

        foreach ($brokers as $brokerId) {
            CommercialTaskPriorityConfig::getOrCreateDefaults($brokerId);
        }
    }
}
