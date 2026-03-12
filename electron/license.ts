/**
 * License Key Service for good.DJ
 * Validates Gumroad license keys via their API and caches results locally.
 * 
 * This file runs in Electron's main process (Node.js) — pure TypeScript only.
 */

import fs from 'fs';
import path from 'path';

const LICENSE_FILE = 'license.json';
const REVALIDATION_DAYS = 7;

interface LicenseCache {
    key: string;
    email: string;
    purchaseId: string;
    productId: string;
    validatedAt: string;
    variant: string;
}

/** Get the path to the license cache file */
function getLicensePath(userDataPath: string): string {
    return path.join(userDataPath, LICENSE_FILE);
}

/** Read the cached license from disk */
export function getCachedLicense(userDataPath: string): LicenseCache | null {
    try {
        const licensePath = getLicensePath(userDataPath);
        if (!fs.existsSync(licensePath)) return null;

        const raw = fs.readFileSync(licensePath, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/** Check if the cached license needs re-validation */
export function needsRevalidation(cache: LicenseCache): boolean {
    const validatedAt = new Date(cache.validatedAt).getTime();
    const now = Date.now();
    const daysSince = (now - validatedAt) / (1000 * 60 * 60 * 24);
    return daysSince > REVALIDATION_DAYS;
}

/** Verify a license key against the Gumroad API */
export async function verifyLicense(licenseKey: string, productId: string, userDataPath: string): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                product_id: productId,
                license_key: licenseKey.trim(),
                increment_uses_count: 'true',
            }),
        });

        const data = await response.json();

        if (!data.success) {
            return { success: false, error: data.message || 'Invalid license key.' };
        }

        if (data.purchase.refunded) {
            return { success: false, error: 'This purchase has been refunded.' };
        }

        if (data.purchase.chargebacked) {
            return { success: false, error: 'This purchase has been chargebacked.' };
        }

        // Cache the validated license
        const cache: LicenseCache = {
            key: licenseKey.trim(),
            email: data.purchase.email,
            purchaseId: data.purchase.id,
            productId: data.purchase.product_id,
            validatedAt: new Date().toISOString(),
            variant: data.purchase.variants || '',
        };

        fs.mkdirSync(userDataPath, { recursive: true });
        fs.writeFileSync(getLicensePath(userDataPath), JSON.stringify(cache, null, 2));

        return { success: true };
    } catch (_err) {
        // Network errors — allow offline grace period if previously validated
        const cached = getCachedLicense(userDataPath);
        if (cached) {
            return { success: true }; // Grace period — previously validated
        }
        return { success: false, error: 'Network error. Please check your connection.' };
    }
}

/** Clear the cached license (for deactivation) */
export function clearLicense(userDataPath: string): void {
    try {
        const licensePath = getLicensePath(userDataPath);
        if (fs.existsSync(licensePath)) {
            fs.unlinkSync(licensePath);
        }
    } catch {
        // Ignore errors
    }
}
