<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\NoisersFeed;

class NoisersController extends Controller
{
    /**
     * Public — the Noisers blog, newest story first. See NoisersFeed.
     */
    public function index()
    {
        return response()->json(['data' => NoisersFeed::build()]);
    }
}
