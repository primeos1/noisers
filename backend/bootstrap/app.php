<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // API-only app: there is no web login route to send guests to.
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // This backend is API-only (no web login route to redirect guests
        // to), so unauthenticated requests should always get a 401 JSON
        // response rather than Laravel's default guest-redirect fallback.
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            return response()->json(['message' => $e->getMessage()], 401);
        });
    })->create();
