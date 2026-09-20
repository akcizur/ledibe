import React from 'react';
import { X, Box, Palette, Check } from 'lucide-react';
import { BRICK_TYPES, COLORS, Theme } from '../types';
import { playClickSound } from '../audio';

interface InventoryModalProps {
  isOpen: boolean;
  selectedColorIdx: number;
  selectedBrickTypeId: string;
  soundEnabled: boolean;
  theme: Theme;
  onSelectColor: (idx: number) => void;
  onSelectBrickType: (id: string) => void;
  onClose: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen, selectedColorIdx, selectedBrickTypeId, soundEnabled, theme,
  onSelectColor, onSelectBrickType, onClose,
}) => {
  if (!isOpen) return null;
  const isDark = theme === 'dark';

  return (
    <div id="inventory" className="fixed inset-0 z-40 pointer-events-auto flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden ${
        isDark ? 'bg-[#0f1624]/95 border-[#1f2a3f] text-gray-100' : 'bg-white/95 border-slate-200 text-slate-900'
      }`}>
        <header className={`px-5 py-4 border-b flex items-center justify-between ${
          isDark ? 'border-[#1f2a3f]' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-emerald-400" />
            <h2 className="font-bold">Paleta & Kostky</h2>
          </div>
          <button onClick={() => { playClickSound(soundEnabled); onClose(); }} className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isDark ? 'bg-[#1a2336] hover:bg-[#23314c]' : 'bg-slate-100 hover:bg-slate-200'
          }`} aria-label="Zavřít">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-5 grid lg:grid-cols-[1fr_1.2fr] gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3"><Palette className="w-4 h-4 text-emerald-400" /><h3 className="text-sm font-semibold">Barvy</h3></div>
            <div className="grid grid-cols-5 gap-2">
              {COLORS.map((color, idx) => (
                <button key={color.label} onClick={() => { playClickSound(soundEnabled); onSelectColor(idx); }}
                  title={color.label} aria-label={color.label}
                  className={`aspect-square rounded-xl border-2 relative transition-transform hover:scale-105 ${
                    selectedColorIdx === idx ? 'border-emerald-400 ring-2 ring-emerald-400/30' : 'border-white/20'
                  }`}
                  style={{ backgroundColor: color.css }}>
                  {selectedColorIdx === idx && <Check className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3"><Box className="w-4 h-4 text-emerald-400" /><h3 className="text-sm font-semibold">Typ kostky</h3></div>
            <div className="grid sm:grid-cols-2 gap-2">
              {BRICK_TYPES.map((brick) => (
                <button key={brick.id} onClick={() => { playClickSound(soundEnabled); onSelectBrickType(brick.id); }}
                  className={`text-left p-3 rounded-2xl border transition-colors ${
                    selectedBrickTypeId === brick.id
                      ? isDark ? 'bg-emerald-500/10 border-emerald-400/60' : 'bg-emerald-50 border-emerald-300'
                      : isDark ? 'bg-[#141d2e] border-[#1f2a3f] hover:bg-[#1a2336]' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{brick.name}</span>
                    {selectedBrickTypeId === brick.id && <Check className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <div className={`text-[11px] mt-1 ${
                    isDark ? 'text-gray-400' : 'text-slate-500'
                  }`}>{brick.w} × {brick.l} × {brick.h} m · {brick.studsX}×{brick.studsZ} studs</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
