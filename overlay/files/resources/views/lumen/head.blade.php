{{-- Lumen theme head, added before </head> by Pterodactyl\Lumen\Http\Middleware\InjectLumenHead. --}}
@php
    $lumenVersion = @filemtime(public_path('lumen/lumen.css')) ?: 1;
    $lumenTokens = $lumen['tokens'];
    $lumenJson = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES;
@endphp
<meta name="lumen-theme" content="{{ $lumen['hash'] }}" data-lumen-head>
@if(str_contains($lumenTokens['typography']['display'] . $lumenTokens['typography']['body'], 'Sora'))
<link rel="preload" href="/lumen/fonts/Sora-Variable.woff" as="font" type="font/woff" crossorigin>
@endif
<link rel="stylesheet" href="/lumen/lumen.css?v={{ $lumenVersion }}">
@if($lumenTokens['typography']['stylesheet'] !== '')
<link rel="stylesheet" href="{{ $lumenTokens['typography']['stylesheet'] }}">
@endif
@if($lumenTokens['branding']['favicon'] !== '')
<link rel="icon" href="{{ $lumenTokens['branding']['favicon'] }}">
@endif
<style id="lumen-tokens">{!! $lumen['css'] !!}</style>
<script>window.LumenAppearance = {!! json_encode($client, $lumenJson) !!};</script>
<script src="/lumen/boot.js?v={{ $lumenVersion }}"></script>
