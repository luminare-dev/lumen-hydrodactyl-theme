<?php
// Prints {"presets": {name: css}, "cases": {name: {errors, css}}} for the parity test.
$root = dirname(__DIR__, 2) . '/overlay/files';
require $root . '/app/Lumen/Tokens/TokenSchema.php';
require $root . '/app/Lumen/Tokens/TokenCompiler.php';

use Pterodactyl\Lumen\Tokens\TokenCompiler;
use Pterodactyl\Lumen\Tokens\TokenSchema;

$dir = $root . '/resources/lumen/presets/';
$defaults = json_decode(file_get_contents($dir . 'luminare.json'), true);
$out = ['presets' => [], 'cases' => []];
foreach (glob($dir . '*.json') as $file) {
    $result = TokenSchema::normalize(json_decode(file_get_contents($file), true), $defaults);
    $out['presets'][basename($file, '.json')] = [
        'errors' => $result['errors'],
        'css' => TokenCompiler::compile($result['tokens']),
        'scoped' => TokenCompiler::compile($result['tokens'], '.lumen-preview', false),
        'attributes' => TokenCompiler::layoutAttributes($result['tokens']),
    ];
}
foreach (json_decode(file_get_contents(__DIR__ . '/cases.json'), true) as $case) {
    $result = TokenSchema::normalize($case['input'], $defaults);
    $out['cases'][$case['name']] = ['errors' => $result['errors'], 'css' => TokenCompiler::compile($result['tokens'])];
}
echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
