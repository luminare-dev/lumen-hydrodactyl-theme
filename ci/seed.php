<?php
// CI only: example data for the screenshots. Run inside the panel container:
//   php /app/ci-seed.php
// Invented names and reserved example addresses only.

use Ramsey\Uuid\Uuid;
use Illuminate\Support\Str;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\Node;
use Pterodactyl\Models\User;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Location;
use Pterodactyl\Models\Allocation;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;

require '/app/vendor/autoload.php';
$app = require '/app/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$password = getenv('SEED_PASSWORD') ?: 'lumen-ci-password';

$user = function (string $username, string $first, string $last, bool $admin) use ($password) {
    $u = User::query()->firstOrNew(['username' => $username])->forceFill([
        'uuid' => Uuid::uuid4()->toString(),
        'email' => $username . '@example.com',
        'name_first' => $first,
        'name_last' => $last,
        'password' => Hash::make($password),
        'root_admin' => $admin,
        'language' => config('app.locale', 'en-US'),
    ]);
    $u->save();

    return $u;
};

$admin = $user('admin', 'Ada', 'Admin', true);
$user('mira', 'Mira', 'Example', false);
$user('jonas', 'Jonas', 'Example', false);

$location = Location::query()->firstOrCreate(['short' => 'eu-central'], ['long' => 'Example data centre, Europe']);
Location::query()->firstOrCreate(['short' => 'us-east'], ['long' => 'Example data centre, America']);

$node = Node::query()->where('name', 'node-1')->first() ?? (new Node())->forceFill([
    'uuid' => Uuid::uuid4()->toString(),
    'public' => true,
    'name' => 'node-1',
    'description' => 'Example node (no daemon in CI)',
    'location_id' => $location->id,
    'fqdn' => 'node-1.example.com',
    'scheme' => 'https',
    'behind_proxy' => false,
    'memory' => 32768,
    'memory_overallocate' => 0,
    'disk' => 512000,
    'disk_overallocate' => 0,
    'upload_size' => 100,
    'daemon_token_id' => Str::random(Node::DAEMON_TOKEN_ID_LENGTH),
    'daemon_token' => Crypt::encrypt(Str::random(Node::DAEMON_TOKEN_LENGTH)),
    'daemonListen' => 8080,
    'daemonSFTP' => 2022,
    'daemonBase' => '/var/lib/pterodactyl/volumes',
    'backupDisk' => 'local',
]);
$node->save();

$egg = Egg::query()->orderBy('id')->firstOrFail();

$servers = [
    ['Survival world', 'Paper, whitelist on', 4096, 25565],
    ['Creative build', 'Plots for the build team', 2048, 25566],
    ['Modded SMP', 'Fabric pack, weekly resets', 8192, 25567],
    ['Lobby', 'Velocity entry point', 1024, 25568],
];
foreach ($servers as [$name, $description, $memory, $port]) {
    if (Server::query()->where('name', $name)->exists()) {
        continue;
    }
    $allocation = Allocation::query()->firstOrCreate(['node_id' => $node->id, 'ip' => '203.0.113.10', 'port' => $port]);
    $server = (new Server())->forceFill([
        'uuid' => Uuid::uuid4()->toString(),
        'uuidShort' => Str::lower(Str::random(8)),
        'node_id' => $node->id,
        'name' => $name,
        'description' => $description,
        'owner_id' => $admin->id,
        'skip_scripts' => 0,
        'status' => null,
        'memory' => $memory,
        'swap' => 0,
        'disk' => 20480,
        'io' => 500,
        'cpu' => 200,
        'oom_disabled' => 1,
        'allocation_id' => $allocation->id,
        'nest_id' => $egg->nest_id,
        'egg_id' => $egg->id,
        'startup' => $egg->startup ?? 'java -jar server.jar',
        'image' => array_values($egg->docker_images ?? ['ghcr.io/example/image:latest'])[0],
    ]);
    $server->save();
    $allocation->forceFill(['server_id' => $server->id])->save();
}
foreach (range(25569, 25574) as $port) {
    Allocation::query()->firstOrCreate(['node_id' => $node->id, 'ip' => '203.0.113.10', 'port' => $port]);
}

echo "seeded: " . User::query()->count() . " users, " . Server::query()->count() . " servers\n";
echo Server::query()->orderBy('id')->value('uuidShort') . "\n";
