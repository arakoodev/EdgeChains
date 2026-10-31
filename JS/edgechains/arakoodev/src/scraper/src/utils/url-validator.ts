export interface ScraperUrlOptions {
    allowPrivateNetworks?: boolean;
}

const BLOCKED_HOSTNAMES = new Set([
    "localhost",
    "localhost.localdomain",
    "metadata.google.internal",
    "metadata",
    "169.254.169.254",
    "100.100.100.200",
    "0.0.0.0",
]);

function isPrivateOrLoopbackIpv4(hostname: string): boolean {
    const parts = hostname.split(".");
    if (parts.length !== 4) {
        return false;
    }
    const octets = parts.map((part) => {
        if (!/^\d{1,3}$/.test(part)) {
            return -1;
        }
        return Number(part);
    });
    if (octets.some((n) => n < 0 || n > 255)) {
        return false;
    }
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127) {
        return true;
    }
    if (a === 169 && b === 254) {
        return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
        return true;
    }
    if (a === 192 && b === 168) {
        return true;
    }
    if (a === 100 && b >= 64 && b <= 127) {
        return true;
    }
    return false;
}

function isBlockedIpv6(hostname: string): boolean {
    const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (!normalized.includes(":")) {
        return false;
    }
    if (normalized === "::1" || normalized === "::" || normalized === "0:0:0:0:0:0:0:1") {
        return true;
    }
    const isUniqueLocal = normalized.startsWith("fc") || normalized.startsWith("fd");
    if (normalized.startsWith("fe80:") || isUniqueLocal) {
        return true;
    }
    if (normalized.startsWith("::ffff:")) {
        const mappedV4 = normalized.slice("::ffff:".length);
        return isPrivateOrLoopbackIpv4(mappedV4);
    }
    return false;
}

export function isBlockedScraperHost(hostname: string): boolean {
    const clean = hostname.trim().toLowerCase().replace(/\.$/, "");
    if (!clean) {
        return true;
    }
    if (BLOCKED_HOSTNAMES.has(clean) || clean.endsWith(".internal") || clean.endsWith(".local")) {
        return true;
    }
    if (isPrivateOrLoopbackIpv4(clean) || isBlockedIpv6(clean)) {
        return true;
    }
    return false;
}

export function assertSafeScraperUrl(rawUrl: string, options?: ScraperUrlOptions): string {
    if (typeof rawUrl !== "string" || !rawUrl.trim()) {
        throw new Error("Invalid URL: URL must be a non-empty string.");
    }
    let parsed: URL;
    try {
        parsed = new URL(rawUrl.trim());
    } catch {
        throw new Error(`Invalid URL: "${rawUrl}" could not be parsed.`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error(
            `Disallowed URL protocol "${parsed.protocol}". Only http: and https: are permitted.`
        );
    }
    if (!options?.allowPrivateNetworks && isBlockedScraperHost(parsed.hostname)) {
        throw new Error(
            `Blocked SSRF target host "${parsed.hostname}". Private or metadata addresses are not allowed.`
        );
    }
    return parsed.toString();
}
