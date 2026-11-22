<?php

namespace Pterodactyl\Lumen;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Pterodactyl\Lumen\Tokens\TokenSchema;
use Pterodactyl\Lumen\Tokens\TokenCompiler;

/**
 * Stores the active token set (table lumen_appearance, key "active") and each user's mode
 * (table lumen_user_preferences). Every read falls back to the Luminare preset, so the panel
 * keeps working when the migration has not run yet.
 */
class AppearanceRepository
{
    public const CACHE_KEY = 'lumen:appearance:v1';
    public const ASSET_DIR = 'lumen';
    public const MODES = ['system', 'dark', 'light'];

    private ?array $compiled = null;

    public function presetDirectory(): string
    {
        return resource_path('lumen/presets');
    }

    public function defaults(): array
    {
        return json_decode((string) file_get_contents($this->presetDirectory() . '/luminare.json'), true);
    }

    /**
     * @return array<string, array>
     */
    public function presets(): array
    {
        $defaults = $this->defaults();
        $presets = ['luminare' => TokenSchema::normalize($defaults, $defaults)['tokens']];
        foreach (glob($this->presetDirectory() . '/*.json') ?: [] as $file) {
            $name = basename($file, '.json');
            if ($name !== 'luminare') {
                $presets[$name] = TokenSchema::normalize(json_decode((string) file_get_contents($file), true), $defaults)['tokens'];
            }
        }

        return $presets;
    }

    public function current(): array
    {
        return $this->compiled()['tokens'];
    }

    /**
     * @return array{tokens: array, css: string, attributes: array<string, string>, hash: string, saved: bool, updatedAt: ?string}
     */
    public function compiled(): array
    {
        if ($this->compiled !== null) {
            return $this->compiled;
        }

        $build = function (): array {
            $defaults = $this->defaults();
            $row = null;
            try {
                $row = DB::table('lumen_appearance')->where('key', 'active')->first();
            } catch (\Throwable $exception) {
                Log::debug('Lumen appearance table is not available; using the default preset.', ['error' => $exception->getMessage()]);
            }
            $stored = $row ? json_decode((string) $row->tokens, true) : $defaults;
            $tokens = TokenSchema::normalize($stored, $defaults)['tokens'];
            $css = TokenCompiler::compile($tokens);

            return [
                'tokens' => $tokens,
                'css' => $css,
                'attributes' => TokenCompiler::layoutAttributes($tokens),
                'hash' => substr(sha1($css), 0, 12),
                'saved' => $row !== null,
                'updatedAt' => $row?->updated_at,
            ];
        };

        try {
            return $this->compiled = Cache::rememberForever(self::CACHE_KEY, $build);
        } catch (\Throwable) {
            return $this->compiled = $build();
        }
    }

    public function save(array $tokens, ?int $userId = null): array
    {
        $now = now();
        DB::table('lumen_appearance')->updateOrInsert(
            ['key' => 'active'],
            ['tokens' => json_encode($tokens, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 'updated_by' => $userId, 'updated_at' => $now, 'created_at' => $now],
        );
        $this->flush();
        $this->pruneAssets($tokens);

        return $this->compiled();
    }

    public function reset(): array
    {
        DB::table('lumen_appearance')->where('key', 'active')->delete();
        $this->flush();
        $this->pruneAssets($this->defaults());

        return $this->compiled();
    }

    public function flush(): void
    {
        $this->compiled = null;
        Cache::forget(self::CACHE_KEY);
    }

    public function userMode(?int $userId): ?string
    {
        if ($userId === null) {
            return null;
        }
        try {
            $mode = DB::table('lumen_user_preferences')->where('user_id', $userId)->value('mode');
        } catch (\Throwable) {
            return null;
        }

        return in_array($mode, self::MODES, true) ? $mode : null;
    }

    public function setUserMode(int $userId, string $mode): void
    {
        $now = now();
        DB::table('lumen_user_preferences')->updateOrInsert(
            ['user_id' => $userId],
            ['mode' => $mode, 'updated_at' => $now, 'created_at' => $now],
        );
    }

    /**
     * Deletes uploaded files that no token points to any more. Files younger than a day stay, so
     * an upload that is still in an unsaved editor session survives a save from another tab.
     */
    private function pruneAssets(array $tokens): void
    {
        try {
            $disk = Storage::disk('public');
            $used = [];
            foreach (TokenSchema::BRANDING_ASSETS as $key) {
                $value = $tokens['branding'][$key] ?? '';
                if (is_string($value) && str_starts_with($value, '/storage/' . self::ASSET_DIR . '/')) {
                    $used[] = substr($value, strlen('/storage/'));
                }
            }
            foreach ($disk->files(self::ASSET_DIR) as $file) {
                if (!in_array($file, $used, true) && $disk->lastModified($file) < time() - 86400) {
                    $disk->delete($file);
                }
            }
        } catch (\Throwable $exception) {
            Log::warning('Could not prune Lumen assets.', ['error' => $exception->getMessage()]);
        }
    }
}
