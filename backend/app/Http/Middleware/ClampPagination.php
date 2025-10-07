<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ClampPagination
{
    /**
     * Limita parámetros de paginación para evitar cargas excesivas.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $perPage = (int) $request->query('per_page', 15);
        $maxPerPage = (int) env('API_MAX_PER_PAGE', 100);
        if ($perPage <= 0) {
            $perPage = 15;
        }
        if ($perPage > $maxPerPage) {
            $perPage = $maxPerPage;
        }

        $page = (int) $request->query('page', 1);
        if ($page <= 0) {
            $page = 1;
        }

        // Sobrescribir query parameters de forma segura
        $request->query->set('per_page', $perPage);
        $request->query->set('page', $page);

        return $next($request);
    }
}


