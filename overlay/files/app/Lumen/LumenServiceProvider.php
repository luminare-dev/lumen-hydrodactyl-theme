<?php

namespace Pterodactyl\Lumen;

use Illuminate\Support\ServiceProvider;
use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Pterodactyl\Lumen\Http\Middleware\InjectLumenHead;

/**
 * Lumen theme: registers the appearance store, the routes and the head middleware.
 * Added to config/app.php by the overlay (patches/0001).
 */
class LumenServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(AppearanceRepository::class);
    }

    public function boot(): void
    {
        $this->loadViewsFrom(resource_path('views/lumen'), 'lumen');
        $this->loadRoutesFrom(base_path('routes/lumen.php'));

        $kernel = $this->app->make(HttpKernel::class);
        if (method_exists($kernel, 'pushMiddleware')) {
            $kernel->pushMiddleware(InjectLumenHead::class);
        }
    }
}
