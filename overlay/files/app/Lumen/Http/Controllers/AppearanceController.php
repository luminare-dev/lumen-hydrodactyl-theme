<?php

namespace Pterodactyl\Lumen\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Pterodactyl\Lumen\AppearanceRepository;
use Pterodactyl\Lumen\Tokens\TokenSchema;
use Pterodactyl\Http\Controllers\Controller;

/**
 * Admin API behind the Appearance page: read, save and reset the token set, upload logo files.
 */
class AppearanceController extends Controller
{
    public const MAX_UPLOAD_KB = 4096;
    public const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'ico', 'svg'];

    public function __construct(private AppearanceRepository $repository)
    {
    }

    public function index(): JsonResponse
    {
        return response()->json($this->state());
    }

    public function update(Request $request): JsonResponse
    {
        $input = $request->input('tokens');
        if (!is_array($input)) {
            return response()->json(['errors' => ['tokens']], 422);
        }

        $result = TokenSchema::normalize($input, $this->repository->defaults());
        if ($result['errors'] !== []) {
            return response()->json(['errors' => $result['errors']], 422);
        }

        $this->repository->save($result['tokens'], $request->user()?->id);

        return response()->json($this->state());
    }

    public function destroy(): JsonResponse
    {
        $this->repository->reset();

        return response()->json($this->state());
    }

    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'slot' => ['required', 'string', 'in:' . implode(',', TokenSchema::BRANDING_ASSETS)],
            'file' => ['required', 'file', 'max:' . self::MAX_UPLOAD_KB],
        ]);

        $file = $request->file('file');
        $extension = strtolower((string) $file->getClientOriginalExtension());
        if (!in_array($extension, self::EXTENSIONS, true)) {
            return response()->json(['errors' => ['file' => 'Use a PNG, JPEG, WebP, GIF, ICO or SVG file.']], 422);
        }

        $content = (string) file_get_contents($file->getRealPath());
        if (!self::isSafeImage($content, $extension)) {
            return response()->json(['errors' => ['file' => 'The file is not a valid image, or the SVG contains scripts or external links.']], 422);
        }

        $extension = $extension === 'jpeg' ? 'jpg' : $extension;
        $name = Str::kebab($request->input('slot')) . '-' . Str::lower(Str::random(16)) . '.' . $extension;
        Storage::disk('public')->put(AppearanceRepository::ASSET_DIR . '/' . $name, $content);

        return response()->json(['url' => '/storage/' . AppearanceRepository::ASSET_DIR . '/' . $name]);
    }

    /**
     * SVG files are refused (not cleaned) when they could run code or load anything; raster files
     * must decode as images.
     */
    public static function isSafeImage(string $content, string $extension): bool
    {
        if ($extension === 'svg') {
            if (!preg_match('/<svg[\s>]/i', $content)) {
                return false;
            }
            $blocked = '/<\s*(script|foreignObject|iframe|embed|object|handler|animate|set)\b|\bon[a-z]+\s*=|javascript:|data:|(?:xlink:)?href\s*=\s*["\']?\s*(?!#)|<!ENTITY|@import|url\s*\(\s*["\']?\s*(?!#)/i';

            return preg_match($blocked, $content) !== 1;
        }

        if ($extension === 'ico') {
            return strlen($content) > 6 && str_starts_with($content, "\x00\x00\x01\x00");
        }

        return @getimagesizefromstring($content) !== false;
    }

    private function state(): array
    {
        $compiled = $this->repository->compiled();

        return [
            'tokens' => $compiled['tokens'],
            'defaults' => $this->repository->presets()['luminare'],
            'presets' => $this->repository->presets(),
            'saved' => $compiled['saved'],
            'updatedAt' => $compiled['updatedAt'],
            'upload' => ['maxKb' => self::MAX_UPLOAD_KB, 'extensions' => self::EXTENSIONS],
        ];
    }
}
