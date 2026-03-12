<?php

namespace App\Console\Commands;

use App\Models\CobroComision;
use App\Models\PagoPoliza;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;

class ImportCarteraFromXlsx extends Command
{
    protected $signature = 'cartera:import-xlsx {type} {--broker-id=2} {--dry-run} {--clear}';
    protected $description = 'Import cartera XLSX into pagos_polizas/cobros_comisiones';

    private array $pi = [];
    private const F = [
        'por_cobrar' => '/Users/mac/Documents/GUROFINAL/cartera/por_cobrar.xlsx',
        'pagos_compania' => '/Users/mac/Documents/GUROFINAL/cartera/Listado de pagos cartera por pagar compania.xlsx',
        'comisiones_recibidas' => '/Users/mac/Documents/GUROFINAL/cartera/comisiones_recibidas.xlsx',
        'comisiones_por_cobrar' => '/Users/mac/Documents/GUROFINAL/cartera/Listado de comisiones por cobrar.xlsx',
    ];

    public function handle(): int
    {
        $type = $this->argument('type');
        $bid = (int)$this->option('broker-id');
        $dry = $this->option('dry-run');
        if (!isset(self::F[$type])) { $this->error("Use: ".implode(', ',array_keys(self::F))); return 1; }
        $file = self::F[$type];
        if (!file_exists($file)) { $this->error("Not found: $file"); return 1; }

        $this->info("=== $type | broker=$bid dry=".($dry?'Y':'N')." ===");
        $this->buildIndex($bid);
        $this->info("Index: ".count($this->pi));

        if ($this->option('clear') && !$dry) $this->doClear($type, $bid);

        $reader = IOFactory::createReaderForFile($file);
        $reader->setReadDataOnly(true);
        $sp = $reader->load($file);
        $sh = $sp->getActiveSheet();
        $tot = $sh->getHighestRow()-1;
        $hc = $sh->getHighestColumn();
        $this->info("Rows: $tot");

        $ok=0;$nf=0;$er=0;
        $bar = $this->output->createProgressBar($tot);
        $bar->start();
        for ($r=2; $r<=$sh->getHighestRow(); $r++) {
            $bar->advance();
            $rd = $sh->rangeToArray("A{$r}:{$hc}{$r}",null,true,true,true)[$r];
            $id=$this->v($rd,'A'); $pn=trim($this->v($rd,'B')??'');
            if (!$id||!$pn) continue;
            $pol=$this->fp($pn);
            if (!$pol) { $nf++; continue; }
            try {
                if (!$dry) $this->doImport($type,$rd,$pol,$bid,(int)$id);
                $ok++;
            } catch(\Throwable $e) { $er++; if($er<=5){$this->newLine();$this->warn("R$r: ".$e->getMessage());} }
        }
        $sp->disconnectWorksheets();
        $bar->finish(); $this->newLine(2);
        $this->info("ok=$ok nf=$nf err=$er");
        if ($dry) $this->warn("DRY RUN");
        return 0;
    }

    private function buildIndex(int $bid): void {
        foreach (DB::table('polizas')->where('broker_id',$bid)->whereNull('deleted_at')->select('id','policy_number','client_id','aseguradora_id')->get() as $r) {
            $e=['id'=>(int)$r->id,'cid'=>$r->client_id?(int)$r->client_id:null,'aid'=>$r->aseguradora_id?(int)$r->aseguradora_id:null];
            $this->pi[$r->policy_number]=$e;
            $c=str_replace(['-',' ','.'],'',$r->policy_number);
            if($c!==$r->policy_number) $this->pi[$c]=$e;
        }
    }
    private function fp(string $pn): ?array { return $this->pi[$pn] ?? $this->pi[str_replace(['-',' ','.'],'',$pn)] ?? null; }
    private function v(array $r,string $c): ?string { $v=$r[$c]??null; return $v===null||$v===''?null:trim((string)$v); }
    private function d(?string $v): float { return $v?floatval(str_replace([' ','$'],'',$v)):0; }
    private function pd(?string $v): ?string {
        if(!$v) return null;
        if(is_numeric($v)&&(int)$v>10000) { try{return date('Y-m-d',\PhpOffice\PhpSpreadsheet\Shared\Date::excelToTimestamp((int)$v));}catch(\Throwable $e){return null;} }
        if(preg_match('/^\d{4}-\d{2}-\d{2}/',$v)) return substr($v,0,10);
        return null;
    }
    private function doClear(string $t, int $bid): void {
        $px=match($t){'por_cobrar'=>'ss_cartera_','pagos_compania'=>'ss_pagos_comp_','comisiones_recibidas'=>'ss_comrec_','comisiones_por_cobrar'=>'ss_compc_'};
        $n1=PagoPoliza::where('broker_id',$bid)->where('referencia_pago','like',"{$px}%")->delete();
        $n2=CobroComision::where('broker_id',$bid)->where('referencia_cobro','like',"{$px}%")->delete();
        if($n1||$n2) $this->warn("Cleared: $n1 pagos, $n2 cobros");
    }

    private function doImport(string $t, array $rd, array $p, int $bid, int $sid): void {
        match($t) {
            'por_cobrar'=>$this->iPorCobrar($rd,$p,$bid,$sid),
            'pagos_compania'=>$this->iPagos($rd,$p,$bid,$sid),
            'comisiones_recibidas'=>$this->iComRec($rd,$p,$bid,$sid),
            'comisiones_por_cobrar'=>$this->iComPC($rd,$p,$bid,$sid),
        };
    }

    private function iPorCobrar(array $rd,array $p,int $b,int $s): void {
        $pt=$this->d($this->v($rd,'Q')); $so=$this->d($this->v($rd,'U')); $sa=$this->d($this->v($rd,'V'));
        $com=$this->d($this->v($rd,'W')); $fl=$this->pd($this->v($rd,'Y'))??now()->toDateString();
        if($so>0&&$p['cid']) PagoPoliza::updateOrCreate(['broker_id'=>$b,'poliza_id'=>$p['id'],'tipo_recaudo'=>'oficina','referencia_pago'=>"ss_cartera_{$s}"],['cliente_id'=>$p['cid'],'monto_total'=>$pt?:$so,'monto_pagado'=>max(0,($pt?:$so)-$so),'monto_pendiente'=>$so,'estado'=>'pendiente','fecha_pago'=>$fl,'observaciones'=>'SS: por cobrar']);
        if($sa>0&&$p['cid']) PagoPoliza::updateOrCreate(['broker_id'=>$b,'poliza_id'=>$p['id'],'tipo_recaudo'=>'aseguradora','referencia_pago'=>"ss_cartera_a_{$s}"],['cliente_id'=>$p['cid'],'monto_total'=>$sa,'monto_pagado'=>0,'monto_pendiente'=>$sa,'estado'=>'pendiente','fecha_pago'=>$fl,'observaciones'=>'SS: por cobrar aseg']);
        if($com>0) CobroComision::updateOrCreate(['broker_id'=>$b,'poliza_id'=>$p['id'],'referencia_cobro'=>"ss_cartera_{$s}"],['aseguradora_id'=>$p['aid'],'monto_comision'=>$com,'monto_cobrado'=>0,'monto_pendiente'=>$com,'estado'=>'pendiente','observaciones'=>'SS: por cobrar']);
    }

    private function iPagos(array $rd,array $p,int $b,int $s): void {
        $pt=$this->d($this->v($rd,'Q')); $wo=$this->d($this->v($rd,'W')); $sa=$this->d($this->v($rd,'V'));
        $com=$this->d($this->v($rd,'X')); $fr=$this->pd($this->v($rd,'AA'))??now()->toDateString();
        $mp=mb_substr($this->v($rd,'AC')??'',0,191)?:null;
        if($wo>0&&$p['cid']) PagoPoliza::updateOrCreate(['broker_id'=>$b,'poliza_id'=>$p['id'],'tipo_recaudo'=>'oficina','referencia_pago'=>"ss_pagos_comp_{$s}"],['cliente_id'=>$p['cid'],'monto_total'=>$pt?:$wo,'monto_pagado'=>$wo,'monto_pendiente'=>max(0,($pt?:$wo)-$wo),'estado'=>'pagado','metodo_pago'=>$mp,'fecha_pago'=>$fr,'observaciones'=>'SS: pagos compañía']);
        if($sa>0&&$p['cid']) PagoPoliza::updateOrCreate(['broker_id'=>$b,'poliza_id'=>$p['id'],'tipo_recaudo'=>'aseguradora','referencia_pago'=>"ss_pagos_comp_a_{$s}"],['cliente_id'=>$p['cid'],'monto_total'=>$sa,'monto_pagado'=>0,'monto_pendiente'=>$sa,'estado'=>'pendiente','fecha_pago'=>$fr,'observaciones'=>'SS: pend aseg']);
        if($com>0) CobroComision::updateOrCreate(['broker_id'=>$b,'poliza_id'=>$p['id'],'referencia_cobro'=>"ss_pagos_comp_{$s}"],['aseguradora_id'=>$p['aid'],'monto_comision'=>$com,'monto_cobrado'=>0,'monto_pendiente'=>$com,'estado'=>'pendiente','observaciones'=>'SS: comisión pend']);
    }

    private function iComRec(array $rd,array $p,int $b,int $s): void {
        $car=$this->d($this->v($rd,'Y')); $cre=$this->d($this->v($rd,'Z')); $vpa=$this->d($this->v($rd,'X'));
        $fro=$this->pd($this->v($rd,'AC')); $fpa=$this->pd($this->v($rd,'AD')); $fco=$this->pd($this->v($rd,'AF'));
        $mc=$car?:$cre;
        if($mc>0) CobroComision::updateOrCreate(['broker_id'=>$b,'poliza_id'=>$p['id'],'referencia_cobro'=>"ss_comrec_{$s}"],['aseguradora_id'=>$p['aid'],'monto_comision'=>$mc,'monto_cobrado'=>$cre,'monto_pendiente'=>max(0,$mc-$cre),'estado'=>$cre>=$mc?'cobrado':($cre>0?'parcial':'pendiente'),'fecha_cobro'=>$fco,'observaciones'=>'SS: comisión recibida']);
        if($vpa>0&&$p['cid']) PagoPoliza::updateOrCreate(['broker_id'=>$b,'poliza_id'=>$p['id'],'tipo_recaudo'=>'aseguradora','referencia_pago'=>"ss_comrec_a_{$s}"],['cliente_id'=>$p['cid'],'monto_total'=>$vpa,'monto_pagado'=>$vpa,'monto_pendiente'=>0,'estado'=>'pagado','fecha_pago'=>$fpa??$fro??now()->toDateString(),'observaciones'=>'SS: pago aseg']);
        $pt=$this->d($this->v($rd,'Q'));
        if($fro&&$pt>0&&$p['cid']) PagoPoliza::updateOrCreate(['broker_id'=>$b,'poliza_id'=>$p['id'],'tipo_recaudo'=>'oficina','referencia_pago'=>"ss_comrec_{$s}"],['cliente_id'=>$p['cid'],'monto_total'=>$pt,'monto_pagado'=>$pt,'monto_pendiente'=>0,'estado'=>'pagado','fecha_pago'=>$fro,'observaciones'=>'SS: recaudo oficina']);
    }

    private function iComPC(array $rd,array $p,int $b,int $s): void {
        $car=$this->d($this->v($rd,'Y')); $cre=$this->d($this->v($rd,'Z')); $vpa=$this->d($this->v($rd,'X'));
        $fro=$this->pd($this->v($rd,'AB')); $fpa=$this->pd($this->v($rd,'AC'));
        $mc=$car?:0;
        if($mc>0) CobroComision::updateOrCreate(['broker_id'=>$b,'poliza_id'=>$p['id'],'referencia_cobro'=>"ss_compc_{$s}"],['aseguradora_id'=>$p['aid'],'monto_comision'=>$mc,'monto_cobrado'=>$cre,'monto_pendiente'=>max(0,$mc-$cre),'estado'=>$cre>=$mc?'cobrado':($cre>0?'parcial':'pendiente'),'fecha_cobro'=>$fpa,'observaciones'=>'SS: comisión por cobrar']);
        if($vpa>0&&$p['cid']) PagoPoliza::updateOrCreate(['broker_id'=>$b,'poliza_id'=>$p['id'],'tipo_recaudo'=>'aseguradora','referencia_pago'=>"ss_compc_a_{$s}"],['cliente_id'=>$p['cid'],'monto_total'=>$vpa,'monto_pagado'=>$vpa,'monto_pendiente'=>0,'estado'=>'pagado','fecha_pago'=>$fpa??now()->toDateString(),'observaciones'=>'SS: pago aseg']);
        $pt=$this->d($this->v($rd,'Q'));
        if($fro&&$pt>0&&$p['cid']) PagoPoliza::updateOrCreate(['broker_id'=>$b,'poliza_id'=>$p['id'],'tipo_recaudo'=>'oficina','referencia_pago'=>"ss_compc_{$s}"],['cliente_id'=>$p['cid'],'monto_total'=>$pt,'monto_pagado'=>$pt,'monto_pendiente'=>0,'estado'=>'pagado','fecha_pago'=>$fro,'observaciones'=>'SS: recaudo oficina']);
    }
}
