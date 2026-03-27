<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class MykadProxyController extends Controller
{
    public function store(Request $request): JsonResponse
	{
		$request->validate([
			'data' => 'required|array',
		]);

		try {
			\DB::table('temp_card_data')->truncate();
			\DB::table('temp_card_data')->insert([
				'data'       => json_encode($request->input('data')),
				'updated_at' => now(),
			]);
		} catch (\Exception $e) {
			Log::error('MykadProxy store failed: ' . $e->getMessage());
			return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
		}

		return response()->json(['status' => 'success'], 200);
	}
}
