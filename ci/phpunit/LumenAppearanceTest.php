<?php

namespace Pterodactyl\Tests\Integration\Lumen;

use Pterodactyl\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Pterodactyl\Lumen\AppearanceRepository;
use Pterodactyl\Tests\Integration\IntegrationTestCase;

/**
 * Lumen theme (CI only; copied into tests/Integration/Lumen of the patched checkout).
 */
class LumenAppearanceTest extends IntegrationTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        DB::table('lumen_appearance')->delete();
        Cache::forget(AppearanceRepository::CACHE_KEY);
        $this->app->make(AppearanceRepository::class)->flush();
    }

    public function testAdminReadsTheDefaultTokens(): void
    {
        $admin = User::factory()->create(['root_admin' => true]);

        $this->actingAs($admin)->getJson('/admin/api/lumen/appearance')
            ->assertOk()
            ->assertJsonPath('saved', false)
            ->assertJsonPath('tokens.meta.name', 'Luminare')
            ->assertJsonPath('presets.graphite.meta.name', 'Graphite');
    }

    public function testNonAdminsCannotUseTheApi(): void
    {
        $user = User::factory()->create(['root_admin' => false]);

        $this->actingAs($user)->getJson('/admin/api/lumen/appearance')->assertForbidden();
        $this->actingAs($user)->putJson('/admin/api/lumen/appearance', ['tokens' => []])->assertForbidden();
    }

    public function testSaveNormalizesAndRejectsInvalidValues(): void
    {
        $admin = User::factory()->create(['root_admin' => true]);

        $this->actingAs($admin)
            ->putJson('/admin/api/lumen/appearance', ['tokens' => ['color' => ['dark' => ['accent' => 'red']]]])
            ->assertStatus(422)
            ->assertJsonPath('errors.0', 'color.dark.accent');

        $this->actingAs($admin)
            ->putJson('/admin/api/lumen/appearance', ['tokens' => ['color' => ['dark' => ['accent' => '#ff00aa']], 'radius' => ['base' => 4]]])
            ->assertOk()
            ->assertJsonPath('saved', true)
            ->assertJsonPath('tokens.color.dark.accent', '#FF00AA')
            ->assertJsonPath('tokens.radius.base', 4);

        $this->actingAs($admin)->deleteJson('/admin/api/lumen/appearance')->assertOk()->assertJsonPath('saved', false);
    }

    public function testEveryPageGetsTheTokenStylesheet(): void
    {
        $admin = User::factory()->create(['root_admin' => true]);
        $this->actingAs($admin)->putJson('/admin/api/lumen/appearance', ['tokens' => ['color' => ['dark' => ['accent' => '#123456']]]])->assertOk();

        $html = $this->actingAs($admin)->get('/admin')->assertOk()->getContent();
        $this->assertStringContainsString('data-lumen-head', $html);
        $this->assertStringContainsString('<style id="lumen-tokens">', $html);
        $this->assertStringContainsString('--lumen-accent: #123456;', $html);
        $this->assertMatchesRegularExpression('/<html[^>]* data-lumen="1"/', $html);
        $this->assertSame(1, substr_count($html, 'data-lumen-head'));
    }

    public function testUploadsRefuseScriptedSvg(): void
    {
        Storage::fake('public');
        $admin = User::factory()->create(['root_admin' => true]);

        $bad = UploadedFile::fake()->createWithContent('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
        $this->actingAs($admin)->post('/admin/api/lumen/assets', ['slot' => 'logoDark', 'file' => $bad], ['Accept' => 'application/json'])
            ->assertStatus(422);

        $good = UploadedFile::fake()->createWithContent('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#5BDFFF"/></svg>');
        $url = $this->actingAs($admin)->post('/admin/api/lumen/assets', ['slot' => 'logoDark', 'file' => $good], ['Accept' => 'application/json'])
            ->assertOk()
            ->json('url');
        $this->assertMatchesRegularExpression('#^/storage/lumen/logo-dark-[a-z0-9]{16}\.svg$#', $url);
        Storage::disk('public')->assertExists(substr($url, strlen('/storage/')));
    }

    public function testTheModeIsRememberedPerUser(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/lumen/mode', ['mode' => 'purple'])->assertStatus(422);
        $this->actingAs($user)->postJson('/lumen/mode', ['mode' => 'light'])->assertNoContent();

        $this->assertDatabaseHas('lumen_user_preferences', ['user_id' => $user->id, 'mode' => 'light']);
        $this->assertSame('light', $this->app->make(AppearanceRepository::class)->userMode($user->id));
    }
}
