<?php

use App\Http\Controllers\Api\AssistEventController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CardController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\FixtureController;
use App\Http\Controllers\Api\GoalEventController;
use App\Http\Controllers\Api\PlayerController;
use App\Http\Controllers\Api\RandomizedTeamController;
use App\Http\Controllers\Api\SeasonController;
use App\Http\Controllers\Api\TrainingSessionController;
use Illuminate\Support\Facades\Route;

// Public — powers the marketing site (squad, fixtures, results, seasons).
Route::get('/players', [PlayerController::class, 'index']);
Route::get('/players/{player}', [PlayerController::class, 'show']);

Route::get('/seasons', [SeasonController::class, 'index']);
Route::get('/seasons/{season}', [SeasonController::class, 'show']);

Route::get('/fixtures', [FixtureController::class, 'index']);
Route::get('/fixtures/{fixture}', [FixtureController::class, 'show']);

Route::get('/goal-events', [GoalEventController::class, 'index']);
Route::get('/assist-events', [AssistEventController::class, 'index']);

// Auth
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Writes for the public-facing entities (public reads stay above, no auth).
    Route::post('/players', [PlayerController::class, 'store']);
    Route::put('/players/{player}', [PlayerController::class, 'update']);
    Route::delete('/players/{player}', [PlayerController::class, 'destroy']);

    Route::post('/seasons', [SeasonController::class, 'store']);
    Route::put('/seasons/{season}', [SeasonController::class, 'update']);
    Route::delete('/seasons/{season}', [SeasonController::class, 'destroy']);

    Route::post('/fixtures', [FixtureController::class, 'store']);
    Route::put('/fixtures/{fixture}', [FixtureController::class, 'update']);
    Route::delete('/fixtures/{fixture}', [FixtureController::class, 'destroy']);

    Route::post('/goal-events', [GoalEventController::class, 'store']);
    Route::put('/goal-events/{goalEvent}', [GoalEventController::class, 'update']);
    Route::delete('/goal-events/{goalEvent}', [GoalEventController::class, 'destroy']);

    Route::post('/assist-events', [AssistEventController::class, 'store']);
    Route::put('/assist-events/{assistEvent}', [AssistEventController::class, 'update']);
    Route::delete('/assist-events/{assistEvent}', [AssistEventController::class, 'destroy']);

    // Internal-only: disciplinary, training, and the team randomizer.
    Route::apiResource('cards', CardController::class);

    Route::apiResource('training-sessions', TrainingSessionController::class);

    Route::get('/randomized-teams', [RandomizedTeamController::class, 'index']);
    Route::post('/randomized-teams', [RandomizedTeamController::class, 'store']);
    Route::get('/randomized-teams/{randomizedTeam}', [RandomizedTeamController::class, 'show']);
    Route::delete('/randomized-teams/{randomizedTeam}', [RandomizedTeamController::class, 'destroy']);
});
