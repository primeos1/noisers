<?php

use App\Http\Controllers\Api\AssistEventController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CardController;
use App\Http\Controllers\Api\ClubSettingController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\FixtureController;
use App\Http\Controllers\Api\GalleryImageController;
use App\Http\Controllers\Api\GoalEventController;
use App\Http\Controllers\Api\HighlightController;
use App\Http\Controllers\Api\HomeContentController;
use App\Http\Controllers\Api\HomeStatController;
use App\Http\Controllers\Api\MatchDayEventController;
use App\Http\Controllers\Api\MediaController;
use App\Http\Controllers\Api\PlayerController;
use App\Http\Controllers\Api\RandomizedTeamController;
use App\Http\Controllers\Api\SeasonController;
use App\Http\Controllers\Api\TrainingSessionController;
use App\Http\Controllers\Api\ValeContentController;
use Illuminate\Support\Facades\Route;

// Public — powers the marketing site (squad, fixtures, results, seasons).
// Bound by jersey number, not the database id — the number is the durable
// identity used everywhere else a player is referenced (cards, match days,
// Vale awards, highlights).
Route::get('/players', [PlayerController::class, 'index']);
Route::get('/players/{player:number}', [PlayerController::class, 'show']);

Route::get('/seasons', [SeasonController::class, 'index']);
Route::get('/seasons/{season}', [SeasonController::class, 'show']);

Route::get('/fixtures', [FixtureController::class, 'index']);
Route::get('/fixtures/{fixture}', [FixtureController::class, 'show']);

Route::get('/goal-events', [GoalEventController::class, 'index']);
Route::get('/assist-events', [AssistEventController::class, 'index']);

// Disciplinary cards and fines � public read (the player portal signs in
// with a shared passcode, not a token), committee/admin write below.
Route::get('/cards', [CardController::class, 'index']);
Route::get('/cards/{card}', [CardController::class, 'show']);

// Club-wide fine amounts and match defaults — public read, admin write below.
Route::get('/settings', [ClubSettingController::class, 'show']);

// Match Day events — public read (powers the "latest match day" teasers),
// committee/admin write below.
Route::get('/match-day-events', [MatchDayEventController::class, 'index']);
Route::get('/match-day-events/{matchDayEvent}/team-of-week', [MatchDayEventController::class, 'teamOfWeek']);

// Site content CMS — public read, committee/admin write below.
Route::get('/home-content', [HomeContentController::class, 'show']);
Route::get('/vale-content', [ValeContentController::class, 'show']);
Route::get('/highlights', [HighlightController::class, 'index']);

// Auth
Route::post('/login', [AuthController::class, 'login']);
// Squad passcode for the player portal — throttled so it can't be guessed.
Route::post('/player-login', [ClubSettingController::class, 'checkPasscode'])->middleware('throttle:10,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

    Route::get('/dashboard', [DashboardController::class, 'index']);

    Route::put('/settings', [ClubSettingController::class, 'update']);
    Route::get('/settings/passcode', [ClubSettingController::class, 'passcode']);
    Route::put('/settings/passcode', [ClubSettingController::class, 'updatePasscode']);

    // Writes for the public-facing entities (public reads stay above, no auth).
    Route::post('/players', [PlayerController::class, 'store']);
    Route::put('/players/{player:number}', [PlayerController::class, 'update']);
    Route::delete('/players/{player:number}', [PlayerController::class, 'destroy']);

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

    // Internal-only: card writes, training, and the team randomizer.
    Route::apiResource('cards', CardController::class)->except(['index', 'show']);

    Route::post('/match-day-events', [MatchDayEventController::class, 'store']);
    Route::put('/match-day-events/{matchDayEvent}', [MatchDayEventController::class, 'update']);
    Route::delete('/match-day-events/{matchDayEvent}', [MatchDayEventController::class, 'destroy']);

    Route::get('/media', [MediaController::class, 'index']);
    Route::post('/media', [MediaController::class, 'store']);
    Route::delete('/media/{media}', [MediaController::class, 'destroy']);

    Route::put('/home-content', [HomeContentController::class, 'update']);
    Route::post('/home-stats', [HomeStatController::class, 'store']);
    Route::put('/home-stats/{homeStat}', [HomeStatController::class, 'update']);
    Route::delete('/home-stats/{homeStat}', [HomeStatController::class, 'destroy']);

    Route::post('/gallery-images', [GalleryImageController::class, 'store']);
    Route::put('/gallery-images/{galleryImage}', [GalleryImageController::class, 'update']);
    Route::delete('/gallery-images/{galleryImage}', [GalleryImageController::class, 'destroy']);

    Route::put('/vale-content', [ValeContentController::class, 'update']);

    Route::post('/highlights', [HighlightController::class, 'store']);
    Route::put('/highlights/{highlight}', [HighlightController::class, 'update']);
    Route::delete('/highlights/{highlight}', [HighlightController::class, 'destroy']);

    Route::apiResource('training-sessions', TrainingSessionController::class);

    Route::get('/randomized-teams', [RandomizedTeamController::class, 'index']);
    Route::post('/randomized-teams', [RandomizedTeamController::class, 'store']);
    Route::get('/randomized-teams/{randomizedTeam}', [RandomizedTeamController::class, 'show']);
    Route::delete('/randomized-teams/{randomizedTeam}', [RandomizedTeamController::class, 'destroy']);
});
