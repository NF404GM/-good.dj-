
import React, { useState } from 'react';

interface OptimizedImageProps {
    src?: string;
    alt: string;
    className?: string;
    style?: React.CSSProperties;
    fallbackGradient?: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({ src, alt, className = "", style, fallbackGradient }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    if (!src || hasError) {
        return (
            <div 
                className={`${className} flex items-center justify-center overflow-hidden bg-surface-idle`}
                style={{ ...style, background: fallbackGradient || 'var(--color-bg-panel)' }}
                title={alt}
            >
                {!fallbackGradient && <span className="text-[9px] text-white/10 font-mono">NO IMG</span>}
            </div>
        );
    }

    return (
        <div className={`relative overflow-hidden bg-surface-idle ${className}`} style={style}>
            <img
                src={src}
                alt={alt}
                loading="lazy"
                decoding="async"
                onLoad={() => setIsLoaded(true)}
                onError={() => setHasError(true)}
                className={`w-full h-full object-cover transition-opacity duration-500 ease-in-out ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
            {/* Loading Placeholder / Skeleton */}
            {!isLoaded && (
                <div className="absolute inset-0 bg-white/5 animate-pulse" />
            )}
        </div>
    );
};
