
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StemType } from '../types';

interface StemControlProps {
  type: StemType;
  volume: number; // 0 to 1
  param: number; // 0 to 1
  isActive: boolean;
  color: string;
  label: string;
  onToggle: () => void;
  onVolumeChange: (val: number) => void;
  onParamChange: (val: number) => void;
  className?: string;
  hideValue?: boolean;
}

const STEM_ICONS: Record<StemType, React.ReactNode> = {
  [StemType.DRUMS]: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l-9.5 5.5v9L12 22l9.5-5.5v-9L12 2z" />
      <path d="M12 22V6.5" />
      <path d="M2.5 7.5L12 13l9.5-5.5" />
    </svg>
  ),
  [StemType.BASS]: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 10h20" />
      <path d="M6 10V4" />
      <path d="M18 10V4" />
      <path d="M6 20v-6" />
      <path d="M18 20v-6" />
    </svg>
  ),
  [StemType.VOCALS]: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20" />
      <path d="M8 10v4" />
      <path d="M16 10v4" />
      <path d="M4 12h16" />
    </svg>
  ),
  [StemType.HARMONIC]: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h20" />
      <path d="M2 7h20" />
      <path d="M2 17h20" />
    </svg>
  ),
};

// ----------------------------------------------------------------------
// SUB-COMPONENTS (Data Attribute & GPU Pattern)
// ----------------------------------------------------------------------

export const HorizontalBar: React.FC<{
  value: number;
  onChange: (v: number) => void;
  color: string;
  label?: string;
  isActive?: boolean;
  onDoubleClick?: () => void;
}> = ({ value, onChange, color, label, isActive = true, onDoubleClick }) => {
  return (
    <div className="w-full flex flex-col gap-[1px] group relative select-none" data-active={isActive}>
      <div className="relative h-1 w-full bg-canvas border border-white/10 overflow-hidden rounded-btn-sm">
        {/* Fill - GPU Accelerated */}
        <motion.div
          className="absolute top-0 bottom-0 left-0 origin-left opacity-40 group-data-[active=true]:opacity-90 transform-gpu"
          initial={false}
          animate={{
            scaleX: value,
            backgroundColor: isActive ? (color.startsWith('var') ? `var(--${color.split('--')[1]})` : color) : 'rgba(255,255,100,0.2)',
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{
            backgroundColor: isActive ? color : undefined,
            boxShadow: isActive ? `0 0 12px ${color}30` : 'none',
          }}
        />

        {/* Center Marker */}
        <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/20 mix-blend-difference pointer-events-none" />

        {/* Input */}
        <input
          type="range" min="0" max="1" step="0.01" value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onDoubleClick={onDoubleClick}
          className="absolute inset-0 opacity-0 cursor-col-resize active:cursor-grabbing"
          title={label}
        />
      </div>
      {label && (
        <div className="flex justify-between items-center px-[1px]">
          <span className="text-[6px] font-mono text-text-data uppercase tracking-wider truncate max-w-full opacity-60 group-hover:opacity-100 transition-opacity">{label}</span>
        </div>
      )}
    </div>
  );
};

export const VerticalFader: React.FC<{
  value: number;
  onChange: (v: number) => void;
  color: string;
  isActive?: boolean;
  label?: string;
  onDoubleClick?: () => void;
  hideValue?: boolean;
}> = ({ value, onChange, color, isActive = true, label, onDoubleClick, hideValue }) => {
  return (
    <div className="flex-1 w-full relative flex flex-col items-center group min-h-0 select-none" data-active={isActive}>
      <div className="flex-1 w-full bg-canvas border border-white/10 relative overflow-hidden rounded-btn-sm shadow-inner">
        {/* Background Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between py-2 px-1 opacity-10 pointer-events-none">
          {[...Array(9)].map((_, i) => <div key={i} className="w-full h-[1px] bg-white/50" />)}
        </div>

        {/* Active Fill - GPU Accelerated */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 origin-bottom opacity-50 group-data-[active=true]:opacity-90 transform-gpu"
          initial={false}
          animate={{ 
            scaleY: value,
            backgroundColor: isActive ? color : 'rgba(255,255,255,0.05)'
          }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
          style={{
            height: '100%',
            boxShadow: isActive ? `0 0 15px ${color}40, inset 0 0 10px rgba(0,0,0,0.4)` : 'none',
          }}
        >
          {/* Top Edge Highlight */}
          <div
            className="absolute top-0 left-0 right-0 bg-white/90"
            style={{ height: '1px' }}
          />
        </motion.div>

        {/* ── PHASE 6: 3D HANDLE ── */}
        <div
          className="absolute left-0 right-0 w-full pointer-events-none z-10 tactile-fader-cap transition-transform duration-75 ease-out will-change-transform transform-gpu"
          style={{
            bottom: `calc(${value * 100}% - 14px)`,
          }}
        />

        {/* Value Readout (Hover) */}
        {!hideValue && (
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-[7px] font-mono text-white px-1 pointer-events-none z-10">
            {(value * 100).toFixed(0)}
          </div>
        )}

        {/* Interactive Input */}
        <input
          type="range" min="0" max="1" step="0.01" value={value}
          onChange={(e) => {
            e.stopPropagation();
            onChange(parseFloat(e.target.value));
          }}
          onDoubleClick={onDoubleClick}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize appearance-slider-vertical z-20"
        />
      </div>
      {label && <span className="text-[6.5px] font-mono font-bold text-text-secondary mt-1 opacity-60 group-hover:opacity-100 transition-opacity uppercase tracking-[0.15em]">{label}</span>}
    </div>
  );
}

export const VUMeter: React.FC<{ level: number; className?: string }> = ({ level, className = "" }) => {
  return (
    <div className={`relative bg-canvas border border-white/10 overflow-hidden rounded-btn-sm ${className}`}>
      <div className="absolute inset-0 flex flex-col justify-between py-[1px] opacity-20 pointer-events-none z-10">
        {[...Array(15)].map((_, i) => <div key={i} className="w-full h-[1px] bg-black" />)}
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 transition-transform duration-75 ease-out will-change-transform origin-bottom bg-gradient-to-t from-signal-nominal via-text-data to-signal-clipping transform-gpu"
        style={{
          height: '100%',
          transform: `scaleY(${Math.min(level, 1)})`,
        }}
      />
    </div>
  );
};

// ----------------------------------------------------------------------
// MAIN COMPONENT
// ----------------------------------------------------------------------

export const StemControl: React.FC<StemControlProps> = ({
  type,
  volume,
  param,
  isActive,
  color,
  label,
  onToggle,
  onVolumeChange,
  onParamChange,
  className = "",
  hideValue
}) => {
  return (
    <div
      className={`flex flex-col items-center gap-0.5 p-1 bg-surface-idle border border-white/5 rounded-Panel group select-none ${className}`}
      data-active={isActive}
    >

      {/* 1. Parameter (Top) */}
      <div className="w-full shrink-0 mb-0.5">
        <HorizontalBar
          value={param}
          onChange={onParamChange}
          color={color}
          label={label}
          isActive={isActive}
          onDoubleClick={() => onParamChange(0.5)}
        />
      </div>

      {/* 2. Volume Fader & VU Segment (Middle) */}
      <div className="flex-1 w-full flex gap-1.5 min-h-0">
        <VerticalFader
          value={volume}
          onChange={onVolumeChange}
          color={color}
          isActive={isActive}
          onDoubleClick={() => onVolumeChange(1)}
          hideValue={hideValue}
        />
        {/* Isolated Stem VU - Real-time feedback */}
        <VUMeter level={isActive ? Math.pow(volume, 0.5) * (0.7 + Math.random() * 0.3) : 0} className="w-1.5 h-full opacity-60" />
      </div>

      {/* 3. Toggle Pad (Bottom - Compact: h-4 now) */}
      <div className="w-full shrink-0 mt-0.5">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.9, y: 1 }}
          onClick={onToggle}
          className="w-full h-4 flex flex-col items-center justify-center border transition-all duration-100 relative overflow-hidden rounded-btn-sm
                bg-canvas border-white/5 opacity-80 hover:opacity-100
                group-data-[active=true]:opacity-100 group-data-[active=true]:border-white/20 group-data-[active=true]:shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"
          style={{
            backgroundColor: isActive ? `${color}10` : undefined,
          }}
          data-active={isActive}
        >
          {/* Pad Lamp (Top Strip) */}
          <motion.div
            initial={false}
            animate={{ 
                opacity: isActive ? 1 : 0,
                backgroundColor: color,
                boxShadow: isActive ? `0 0 10px ${color}` : 'none'
            }}
            className="absolute top-0 left-0 right-0 h-[1.5px] transition-all duration-300"
            style={{ color: color }}
          />

          <motion.div
            animate={{ 
                scale: isActive ? 0.9 : 0.75,
                filter: isActive ? 'grayscale(0)' : 'grayscale(1)',
                opacity: isActive ? 1 : 0.4,
                color: isActive ? color : '#666'
            }}
            className="transition-all duration-200"
          >
            {STEM_ICONS[type]}
          </motion.div>
          
          {/* Secondary Action: Toggle Flash */}
          <AnimatePresence>
            {isActive && (
                <motion.div 
                    initial={{ opacity: 0.5, scale: 0.8 }}
                    animate={{ opacity: 0, scale: 1.5 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="absolute inset-0 pointer-events-none"
                    style={{ backgroundColor: color }}
                />
            )}
          </AnimatePresence>
        </motion.button>
      </div>

    </div>
  );
};
