<?php

namespace Pterodactyl\Lumen\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Pterodactyl\Lumen\AppearanceRepository;
use Pterodactyl\Http\Controllers\Controller;

/**
 * Remembers the light, dark or system choice per user, so it follows them to other browsers.
 */
class UserModeController extends Controller
{
    public function __construct(private AppearanceRepository $repository)
    {
    }

    public function store(Request $request): Response
    {
        $data = $request->validate(['mode' => ['required', 'string', 'in:' . implode(',', AppearanceRepository::MODES)]]);
        $this->repository->setUserMode($request->user()->id, $data['mode']);

        return response()->noContent();
    }
}
