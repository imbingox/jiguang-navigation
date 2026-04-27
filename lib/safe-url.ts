import dns from 'dns/promises';
import net from 'net';

const PRIVATE_V4_RANGES: Array<[string, number]> = [
    ['10.0.0.0', 8],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.168.0.0', 16],
    ['0.0.0.0', 8],
];

function ipv4ToInt(ip: string) {
    return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function isPrivateIPv4(ip: string) {
    const value = ipv4ToInt(ip);
    return PRIVATE_V4_RANGES.some(([range, bits]) => {
        const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
        return (value & mask) === (ipv4ToInt(range) & mask);
    });
}

function isPrivateIPv6(ip: string) {
    const normalized = ip.toLowerCase();
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
}

export async function assertPublicHttpUrl(input: string) {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`);

    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Only HTTP(S) URLs are allowed');
    }

    if (url.username || url.password) {
        throw new Error('Credentials in URL are not allowed');
    }

    const hostname = url.hostname;
    const ipVersion = net.isIP(hostname);
    const addresses = ipVersion ? [{ address: hostname, family: ipVersion }] : await dns.lookup(hostname, { all: true, verbatim: true });

    for (const entry of addresses) {
        if (entry.family === 4 && isPrivateIPv4(entry.address)) {
            throw new Error('Private network URLs are not allowed');
        }
        if (entry.family === 6 && isPrivateIPv6(entry.address)) {
            throw new Error('Private network URLs are not allowed');
        }
    }

    return url;
}
