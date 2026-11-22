<?php

namespace Pterodactyl\Lumen\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Pterodactyl\Lumen\AppearanceRepository;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Adds the Lumen head (tokens, stylesheet, mode script) to every HTML page the panel renders:
 * the React shells, the error pages and any remaining server-rendered page. Registered as global
 * middleware, so no Blade template of the panel has to be patched.
 */
class InjectLumenHead
{
    public const MARKER = 'data-lumen-head';

    public function __construct(private AppearanceRepository $repository)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (
            $response instanceof StreamedResponse
            || $response instanceof BinaryFileResponse
            || !str_contains((string) $response->headers->get('Content-Type', 'text/html'), 'text/html')
        ) {
            return $response;
        }

        $content = $response->getContent();
        if (!is_string($content) || str_contains($content, self::MARKER)) {
            return $response;
        }
        $head = strripos($content, '</head>');
        if ($head === false) {
            return $response;
        }

        try {
            $compiled = $this->repository->compiled();
            $user = $request->user();
            $html = view('lumen::head', [
                'lumen' => $compiled,
                'client' => $this->client($compiled, $user?->id),
            ])->render();
        } catch (\Throwable $exception) {
            report($exception);

            return $response;
        }

        $content = substr($content, 0, $head) . $html . substr($content, $head);
        $attributes = '';
        foreach ($compiled['attributes'] as $name => $value) {
            $attributes .= ' ' . $name . '="' . e($value) . '"';
        }
        $content = preg_replace('/<html(?=[\s>])/i', '<html' . $attributes, $content, 1);

        $response->setContent($content);
        $response->headers->remove('Content-Length');

        return $response;
    }

    private function client(array $compiled, ?int $userId): array
    {
        $tokens = $compiled['tokens'];

        return [
            'version' => $tokens['version'],
            'hash' => $compiled['hash'],
            'mode' => $tokens['mode'],
            'user' => $userId === null ? null : ['mode' => $this->repository->userMode($userId)],
            'branding' => [
                'productName' => $tokens['branding']['productName'],
                'logoDark' => $tokens['branding']['logoDark'],
                'logoLight' => $tokens['branding']['logoLight'],
            ],
            'attributes' => $compiled['attributes'],
            'endpoints' => ['mode' => route('lumen.mode', [], false)],
        ];
    }
}
