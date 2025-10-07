<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class MasterAccountController extends Controller
{
    public function getProfile(Request $request)
    {
        return response()->json(['message' => 'Método no implementado'], 501);
    }

    public function updateProfile(Request $request)
    {
        return response()->json(['message' => 'Método no implementado'], 501);
    }

    public function changePassword(Request $request)
    {
        return response()->json(['message' => 'Método no implementado'], 501);
    }

    public function createBroker(Request $request)
    {
        return response()->json(['message' => 'Método no implementado'], 501);
    }

    public function getGlobalStats(Request $request)
    {
        return response()->json(['message' => 'Método no implementado'], 501);
    }

    public function getRecentActivity(Request $request)
    {
        return response()->json(['message' => 'Método no implementado'], 501);
    }
}
