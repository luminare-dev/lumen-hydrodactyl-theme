// Lumen logo slots: one logo for dark mode and one for light mode, from the token set.
// Used by the patched HydroLogo, so the sidebar, header and login page all show it.

interface LumenBranding {
    productName?: string;
    logoDark?: string;
    logoLight?: string;
}

function branding(): LumenBranding {
    const config = (window as { LumenAppearance?: { branding?: LumenBranding } }).LumenAppearance;
    return config?.branding ?? {};
}

export function hasLumenLogo(): boolean {
    const { logoDark, logoLight } = branding();
    return Boolean(logoDark || logoLight);
}

// The configured product name, else the panel's own name (Settings -> General), else the fallback.
export function lumenProductName(fallback = 'Panel'): string {
    const site = (window as { SiteConfiguration?: { name?: string } }).SiteConfiguration;
    return branding().productName || site?.name || fallback;
}

export default function LumenLogo({ className }: { className?: string }) {
    const { logoDark, logoLight, productName } = branding();
    const dark = logoDark || logoLight || '';
    const light = logoLight || logoDark || '';
    const alt = productName || 'Logo';
    const imgClass = className || 'flex h-full w-full shrink-0 object-contain';

    return (
        <span className='lumen-logo' data-lumen-logo=''>
            <img src={dark} alt={alt} className={`lumen-logo-dark ${imgClass}`} draggable={false} />
            <img src={light} alt='' aria-hidden='true' className={`lumen-logo-light ${imgClass}`} draggable={false} />
        </span>
    );
}
