import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ActivationGate — License key entry screen.
 * Shown before the main app when running in Electron without a valid license.
 * In browser/dev mode, this component is bypassed entirely.
 */

import { LicenseStatus } from '../types';

interface ActivationGateProps {
    children: React.ReactNode;
}

export const ActivationGate: React.FC<ActivationGateProps> = ({ children }) => {
    const [status, setStatus] = useState<'checking' | 'activated' | 'needs_activation'>('checking');
    const [licenseKey, setLicenseKey] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [version, setVersion] = useState('');

    // Check if we're running in Electron
    const isElectron = !!window.gooddj;

    useEffect(() => {
        if (!isElectron) {
            setStatus('activated');
            return;
        }

        // Check existing license
        window.gooddj!.license.getStatus().then((result) => {
            if (result.activated) {
                setStatus('activated');
            } else {
                setStatus('needs_activation');
                if (result.error) setError(result.error);
            }
        });

        window.gooddj!.getVersion().then(setVersion);
    }, []);

    const handleActivate = async () => {
        if (!licenseKey.trim() || !window.gooddj) return;

        setIsVerifying(true);
        setError(null);

        const result = await window.gooddj.license.verify(licenseKey.trim());

        if (result.success) {
            setStatus('activated');
        } else {
            setError(result.error || 'Activation failed.');
        }

        setIsVerifying(false);
    };

    // In browser mode or already activated — render children
    if (status === 'activated') {
        return <>{children}</>;
    }

    // Loading state
    if (status === 'checking') {
        return (
            <div className="w-screen h-screen bg-canvas flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-4"
                >
                    <div className="w-8 h-8 border-2 border-signal-nominal border-t-transparent rounded-full animate-spin" />
                    <span className="text-[11px] font-mono text-[#888] tracking-widest">VERIFYING LICENSE...</span>
                </motion.div>
            </div>
        );
    }

    // Activation screen
    return (
        <div className="w-screen h-screen bg-canvas flex items-center justify-center overflow-hidden relative">
            {/* Subtle background pattern */}
            <div className="absolute inset-0 opacity-[0.02]"
                style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)`,
                    backgroundSize: '32px 32px'
                }}
            />

            {/* Ambient glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-signal-nominal/5 rounded-full blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 w-[420px] flex flex-col items-center"
            >
                {/* Logo */}
                <div className="mb-8 flex flex-col items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tighter text-white">
                        good.<span className="font-medium text-text-secondary">DJ</span>
                    </h1>
                    {version && (
                        <span className="text-[9px] font-mono text-[#888] px-2 py-0.5 border border-white/10 rounded-sm">
                            v{version}
                        </span>
                    )}
                </div>

                {/* Activation Card */}
                <div className="w-full bg-surface-idle border border-white/10 rounded-md p-6 shadow-2xl">
                    <h2 className="text-[11px] font-bold text-[#888] uppercase tracking-[0.2em] mb-6 text-center">
                        Activate Your License
                    </h2>

                    <div className="flex flex-col gap-4">
                        {/* Key Input */}
                        <div className="relative">
                            <input
                                type="text"
                                value={licenseKey}
                                onChange={(e) => {
                                    setLicenseKey(e.target.value);
                                    if (error) setError(null);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleActivate();
                                }}
                                placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
                                className="w-full bg-canvas border border-white/10 rounded-sm px-4 py-3 text-[12px] font-mono text-white placeholder-white/20 focus:border-signal-nominal/50 focus:outline-none transition-colors tracking-wider"
                                autoFocus
                                disabled={isVerifying}
                            />
                        </div>

                        {/* Error Message */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="text-[10px] text-signal-clipping font-mono px-3 py-2 bg-signal-clipping/10 border border-signal-clipping/20 rounded-sm"
                                >
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Activate Button */}
                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={handleActivate}
                            disabled={!licenseKey.trim() || isVerifying}
                            className={`w-full py-3 rounded-sm text-[11px] font-bold uppercase tracking-[0.15em] transition-all duration-200
                                ${licenseKey.trim() && !isVerifying
                                    ? 'bg-signal-nominal text-white shadow-[0_0_20px_rgba(var(--signal-nominal-rgb),0.3)] hover:shadow-[0_0_30px_rgba(var(--signal-nominal-rgb),0.4)] hover:opacity-90'
                                    : 'bg-white/5 text-white/30 cursor-not-allowed'
                                }`}
                        >
                            {isVerifying ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Verifying...
                                </span>
                            ) : (
                                'Activate'
                            )}
                        </motion.button>
                    </div>
                </div>

                {/* Help Text */}
                <p className="mt-6 text-[9px] text-[#555] text-center leading-relaxed max-w-[300px]">
                    Enter the license key from your Gumroad purchase email.
                    <br />
                    Need help? Contact <span className="text-[#888]">support@goodcompany.dj</span>
                </p>
            </motion.div>
        </div>
    );
};
