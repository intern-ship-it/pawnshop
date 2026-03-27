<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class MykadProxyController extends Controller
{
    public function store(Request $request): JsonResponse
	{
		$request->validate([
			'data' => 'required|array',
		]);

		try {
			DB::table('temp_card_data')->truncate();
			DB::table('temp_card_data')->insert([
				'data'       => json_encode($request->input('data')),
				'updated_at' => now(),
			]);
		} catch (\Exception $e) {
			Log::error('MykadProxy store failed: ' . $e->getMessage());
			return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
		}

		return response()->json(['status' => 'success'], 200);
	}

	public function getData(): JsonResponse
	{
		/** @var object $record */
		$record = DB::table('temp_card_data')->first();

		if ($record) {
			$data = json_decode($record->data, true);
			
			// Delete all records after reading to consume it safely
			DB::table('temp_card_data')->truncate();
			
			return response()->json([
				'status' => 'success',
				'data' => $data
			], 200);
		}

		return response()->json(['status' => 'waiting', 'message' => 'No card data found'], 200);
	}
}
