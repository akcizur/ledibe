import React,{useState} from 'react';
import {Theme} from '../types';
import {ChevronDown,Undo2,RotateCw,Sun,Palette,Volume2,VolumeX,Moon,SunMedium,Settings,HelpCircle,Trash2,Camera,Layers3} from 'lucide-react';
import {playClickSound} from '../audio';

interface TopBarProps{
  canUndo:boolean;brickCount:number;rotation:number;soundEnabled:boolean;playerHeight:number;theme:Theme;
  realisticFx:boolean;ssaoEnabled:boolean;sunAngle:number;dynamicSunOrbit:boolean;
  onUndo:()=>void;onRotate:()=>void;onToggleTheme:()=>void;onToggleSound:()=>void;onToggleRealisticFx:()=>void;
  onToggleSSAO:()=>void;onSetSunAngle:(angle:number)=>void;onToggleDynamicSunOrbit:()=>void;onResetCamera:()=>void;
  onClearScene:()=>void;onOpenHelp:()=>void;onElevate:(d:number)=>void;onLoadPreset:(name:'tower'|'pyramid'|'house')=>void;
}

export const TopBar:React.FC<TopBarProps>=p=>{
  const [menu,setMenu]=useState(false); const dark=p.theme==='dark';
  const cls=dark?'bg-[#0f1624]/95 border-[#1f2a3f] text-gray-100':'bg-white/95 border-slate-200 text-slate-800';
  const click=(fn:()=>void)=>{playClickSound(p.soundEnabled);fn();};
  return <header className="fixed top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none w-[min(96vw,920px)]">
    <div className={`pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-2xl border backdrop-blur-md shadow-xl ${cls}`}>
      <div className="px-3 py-2 mr-auto min-w-0"><div className="text-xs font-bold tracking-widest">BYLDR STUDIO</div><div className="text-[10px] font-mono opacity-50">bb3005 · {p.brickCount} bricks · H {p.playerHeight.toFixed(1)}m</div></div>
      <button disabled={!p.canUndo} onClick={()=>click(p.onUndo)} className="w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-30 hover:bg-black/10" title="Undo"><Undo2 className="w-4 h-4"/></button>
      <button onClick={()=>click(p.onRotate)} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-black/10" title={`Rotace ${p.rotation*90}°`}><RotateCw className="w-4 h-4"/></button>
      <button onClick={()=>click(()=>p.onElevate(.5))} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-black/10" title="Výška +"><Layers3 className="w-4 h-4"/></button>
      <button onClick={()=>click(p.onResetCamera)} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-black/10" title="Reset kamery"><Camera className="w-4 h-4"/></button>
      <button onClick={()=>click(p.onToggleSound)} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-black/10" title="Zvuk">{p.soundEnabled?<Volume2 className="w-4 h-4"/>:<VolumeX className="w-4 h-4"/>}</button>
      <button onClick={()=>click(p.onToggleTheme)} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-black/10" title="Motiv">{dark?<SunMedium className="w-4 h-4"/>:<Moon className="w-4 h-4"/>}</button>
      <div className="relative">
        <button onClick={()=>setMenu(v=>!v)} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-black/10" title="Nastavení"><Settings className="w-4 h-4"/></button>
        {menu&&<div className={`absolute right-0 top-11 w-72 rounded-2xl border p-2 shadow-2xl backdrop-blur-md ${cls}`}>
          <div className="px-2 py-1 text-[10px] uppercase tracking-widest opacity-50">Render</div>
          <button onClick={()=>click(p.onToggleRealisticFx)} className="w-full px-2 py-2 rounded-xl text-left text-xs flex items-center justify-between hover:bg-black/10"><span className="flex items-center gap-2"><Sun className="w-4 h-4"/>Realistic FX</span><span className="font-mono opacity-60">{p.realisticFx?'ON':'OFF'}</span></button>
          <button onClick={()=>click(p.onToggleSSAO)} className="w-full px-2 py-2 rounded-xl text-left text-xs flex items-center justify-between hover:bg-black/10"><span className="flex items-center gap-2"><Palette className="w-4 h-4"/>SSAO</span><span className="font-mono opacity-60">{p.ssaoEnabled?'ON':'OFF'}</span></button>
          <button onClick={()=>click(p.onToggleDynamicSunOrbit)} className="w-full px-2 py-2 rounded-xl text-left text-xs flex items-center justify-between hover:bg-black/10"><span>☼ Orbit slunce</span><span className="font-mono opacity-60">{p.dynamicSunOrbit?'ON':'OFF'}</span></button>
          <label className="block px-2 py-2"><div className="flex justify-between text-xs mb-1"><span>Sun angle</span><span className="font-mono">{Math.round(p.sunAngle)}°</span></div><input type="range" min="0" max="360" value={p.sunAngle} onChange={e=>p.onSetSunAngle(Number(e.target.value))} className="w-full"/></label>
          <div className="h-px my-1 bg-black/10"/>
          <div className="px-2 py-1 text-[10px] uppercase tracking-widest opacity-50">Presets</div>
          <div className="grid grid-cols-3 gap-1 p-1"><button onClick={()=>click(()=>p.onLoadPreset('tower'))} className="px-2 py-2 rounded-xl text-xs hover:bg-black/10">Tower</button><button onClick={()=>click(()=>p.onLoadPreset('pyramid'))} className="px-2 py-2 rounded-xl text-xs hover:bg-black/10">Pyramid</button><button onClick={()=>click(()=>p.onLoadPreset('house'))} className="px-2 py-2 rounded-xl text-xs hover:bg-black/10">House</button></div>
          <button onClick={()=>click(p.onOpenHelp)} className="w-full px-2 py-2 rounded-xl text-left text-xs flex items-center gap-2 hover:bg-black/10"><HelpCircle className="w-4 h-4"/>Nápověda</button>
          {p.brickCount>0&&<button onClick={()=>{click(()=>{if(confirm('Opravdu chcete vyčistit všechny položené kostky?'))p.onClearScene();});setMenu(false)}} className="w-full px-2 py-2 rounded-xl text-left text-xs text-rose-400 flex items-center gap-2 hover:bg-rose-500/10"><Trash2 className="w-4 h-4"/>Smazat scénu</button>}
        </div>}
      </div>
    </div>
  </header>;
};
