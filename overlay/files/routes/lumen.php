<?php

use Illuminate\Support\Facades\Route;
use Pterodactyl\Http\Controllers\Admin\AppController;
use Pterodactyl\Http\Middleware\AdminAuthenticate;
use Pterodactyl\Lumen\Http\Controllers\UserModeController;
use Pterodactyl\Lumen\Http\Controllers\AppearanceController;
use Pterodactyl\Http\Middleware\RequireTwoFactorAuthentication;

/*
| Lumen theme routes, loaded by Pterodactyl\Lumen\LumenServiceProvider.
| The admin page lives in the React admin shell; the API is session-authenticated like the
| panel's own internal admin API.
*/

Route::middleware(['web', 'auth', 'auth.session', RequireTwoFactorAuthentication::class, AdminAuthenticate::class])
    ->prefix('/admin')
    ->group(function () {
        Route::get('/appearance', [AppController::class, 'index'])->name('admin.lumen.appearance');

        Route::prefix('/api/lumen')->group(function () {
            Route::get('/appearance', [AppearanceController::class, 'index'])->name('admin.api.lumen.appearance');
            Route::put('/appearance', [AppearanceController::class, 'update']);
            Route::delete('/appearance', [AppearanceController::class, 'destroy']);
            Route::post('/assets', [AppearanceController::class, 'upload'])->name('admin.api.lumen.assets');
        });
    });

Route::middleware(['web', 'auth'])
    ->post('/lumen/mode', [UserModeController::class, 'store'])
    ->name('lumen.mode');
