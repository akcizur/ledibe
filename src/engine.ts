import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { SSRPass } from 'three/examples/jsm/postprocessing/SSRPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { BRICK_TYPES, COLORS, BRICK_GRID_UNIT, BuildMode } from './types';
import { playSnapSound, playRemoveSound, playRotateSound } from './audio';

export interface EngineCallbacks {
  onBrickCountChange: (count:number) => void;
  onCanUndoChange: (canUndo:boolean) => void;
  onStatusChange: (status:'loading'|'ready'|'error', text?:string) => void;
  onHeightChange?: (height:number) => void;
  onEscape?: () => boolean;
}

function roundedBox(w:number,h:number,d:number,r=.035){
  const s=new THREE.Shape(), x=w/2, z=d/2, rr=Math.min(r,x-.005,z-.005);
  s.moveTo(-x+rr,-z); s.lineTo(x-rr,-z); s.quadraticCurveTo(x,-z,x,-z+rr);
  s.lineTo(x,z-rr); s.quadraticCurveTo(x,z,x-rr,z); s.lineTo(-x+rr,z);
  s.quadraticCurveTo(-x,z,-x,z-rr); s.lineTo(-x,-z+rr); s.quadraticCurveTo(-x,-z,-x+rr,-z);
  const g=new THREE.ExtrudeGeometry(s,{depth:Math.max(.02,h-.012),bevelEnabled:true,bevelSegments:3,bevelSize:.006,bevelThickness:.006,curveSegments:8});
  g.rotateX(Math.PI/2); g.center(); return g;
}

export class BrickEngine {
  public mode:BuildMode='BUILD'; public colorIdx=1; public rotation=0; public brickTypeId='bb3005';
  public soundEnabled=true; public realisticFx=true; public ssaoEnabled=true;
  public sunAngle=65; public dynamicSunOrbit=false; public playerHeight=1.6; public minPlayerHeight=.6; public maxPlayerHeight=16;
  public readonly EYE_HEIGHT=1.6;
  private container:HTMLElement; private callbacks:EngineCallbacks;
  private scene=new THREE.Scene(); private camera:THREE.PerspectiveCamera; private renderer:THREE.WebGLRenderer;
  private composer:EffectComposer; private ssao:SSAOPass; private ssr:SSRPass; private bokeh:BokehPass;
  private bricks:THREE.Group[]=[]; private undoStack:THREE.Group[]=[]; private ghost:THREE.Group|null=null;
  private floor:THREE.Mesh; private keyLight:THREE.DirectionalLight; private hemi:THREE.HemisphereLight;
  private input={forward:0,side:0,pitch:0,yaw:0}; private keys=new Set<string>(); private mouseDown=false;
  private lastX=0; private lastY=0; private raf=0; private destroyed=false; private theme:'dark'|'light'='dark';
  private fogStart=40; private fogEnd=200; private focusDistance=4.5;
  private raycaster=new THREE.Raycaster();

  constructor(container:HTMLElement,callbacks:EngineCallbacks){
    this.container=container; this.callbacks=callbacks;
    this.scene.background=new THREE.Color(0x0a0e17); this.scene.fog=new THREE.Fog(0x0a0e17,this.fogStart,this.fogEnd);
    const w=Math.max(1,container.clientWidth), h=Math.max(1,container.clientHeight);
    this.camera=new THREE.PerspectiveCamera(70,w/h,.05,300); this.camera.position.set(0,1.6,7);
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setSize(w,h); this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.shadowMap.enabled=true; this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=1.15;
    container.appendChild(this.renderer.domElement);

    this.composer=new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.ssao=new SSAOPass(this.scene,this.camera,w,h); this.ssao.kernelRadius=.38; this.ssao.minDistance=.001; this.ssao.maxDistance=.22;
    this.composer.addPass(this.ssao);
    this.ssr=new SSRPass({renderer:this.renderer,scene:this.scene,camera:this.camera,width:w,height:h});
    this.ssr.selective=true; this.ssr.selects=this.bricks; this.ssr.opacity=.16; this.ssr.maxDistance=12; this.ssr.thickness=.025; this.ssr.blur=true;
    this.ssr.fresnel=true; this.ssr.distanceAttenuation=true; this.ssr.resolutionScale=.5; this.composer.addPass(this.ssr);
    this.bokeh=new BokehPass(this.scene,this.camera,{focus:this.focusDistance,aperture:.000015,maxblur:.008}); this.composer.addPass(this.bokeh);
    this.composer.addPass(new OutputPass());

    this.hemi=new THREE.HemisphereLight(0xffffff,0x111827,.9); this.scene.add(this.hemi);
    this.keyLight=new THREE.DirectionalLight(0xffffff,1.35); this.keyLight.castShadow=true;
    this.keyLight.shadow.mapSize.set(2048,2048); this.keyLight.shadow.camera.near=.1; this.keyLight.shadow.camera.far=80;
    this.scene.add(this.keyLight);
    const fill=new THREE.DirectionalLight(0x99bbff,.45); fill.position.set(-6,5,6); this.scene.add(fill);

    const floorMat=new THREE.MeshStandardMaterial({color:0x262a32,roughness:.74,metalness:.05});
    this.floor=new THREE.Mesh(new THREE.PlaneGeometry(80,80),floorMat);
    this.floor.rotation.x=-Math.PI/2; this.floor.name='FLOOR'; this.floor.receiveShadow=true; this.scene.add(this.floor);
    const grid=new THREE.GridHelper(40,80,0x3a414c,0x202631); grid.position.y=.004; this.scene.add(grid);
    this.updateSunPosition(); this.setupEvents(); this.updateGhost(); this.callbacks.onStatusChange('loading','INICIALIZACE MODELU...');
    setTimeout(()=>{if(!this.destroyed){this.callbacks.onStatusChange('ready','READY');this.animate();}},120);
  }

  private createBrickGroup(typeId:string,colorIdx:number=this.colorIdx){
    const type=BRICK_TYPES.find(x=>x.id===typeId)??BRICK_TYPES[0];
    const group=new THREE.Group(); group.userData={typeId:type.id,w:type.w,l:type.l,h:type.h};
    const mat=new THREE.MeshStandardMaterial({color:COLORS[colorIdx]?.hex??0x34c759,roughness:.28,metalness:0});
    const body=new THREE.Mesh(roundedBox(type.w-.012,type.h,type.l-.012),mat);
    body.castShadow=true; body.receiveShadow=true; group.add(body);
    for(let x=0;x<type.studsX;x++) for(let z=0;z<type.studsZ;z++){
      const r=new THREE.Mesh(new THREE.CylinderGeometry(.085,.085,.055,24),mat);
      r.position.set((x-(type.studsX-1)/2)*.5,.5*type.h+.03,(z-(type.studsZ-1)/2)*.5); r.castShadow=true; group.add(r);
    }
    return group;
  }

  private snap(v:number,size=.5){ return Math.round(v/(BRICK_GRID_UNIT*Math.max(1,size/.5)))*(BRICK_GRID_UNIT*Math.max(1,size/.5)); }

  private updateGhost(){
    if(this.ghost) this.scene.remove(this.ghost);
    this.ghost=this.createBrickGroup(this.brickTypeId,this.colorIdx);
    this.ghost.traverse(o=>{const m=(o as THREE.Mesh).material;if(m&&!(m instanceof THREE.Material))return;if(m){const c=(m as THREE.MeshStandardMaterial).color.clone();(m as THREE.MeshStandardMaterial).color.setHex(c.getHex());(m as THREE.MeshStandardMaterial).transparent=true;(m as THREE.MeshStandardMaterial).opacity=.28;}}});
    this.ghost.visible=false; this.scene.add(this.ghost);
  }

  private updateSunPosition(){
    const a=THREE.MathUtils.degToRad(this.sunAngle), e=THREE.MathUtils.degToRad(42);
    this.keyLight.position.set(Math.cos(a)*12,Math.sin(e)*16,Math.sin(a)*12);
  }

  private setupEvents(){
    const kd=(e:KeyboardEvent)=>{if(['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName))return;this.keys.add(e.code);
      if(e.code==='Escape'){if(!(this.callbacks.onEscape?.()??false)){if(this.mode==='ERASE')this.setMode('BUILD');else this.undo();}}
      else if(e.code==='KeyR')this.rotate(); else if(e.code==='KeyB')this.setMode('BUILD'); else if(e.code==='KeyE'||e.code==='KeyX')this.setMode('ERASE');
      else if(e.code==='KeyZ'&&(e.ctrlKey||e.metaKey))this.undo(); else if(e.code==='PageUp')this.elevate(.5); else if(e.code==='PageDown')this.elevate(-.5);
      else if(e.code==='Space'){e.preventDefault();this.performAction();}
    };
    const ku=(e:KeyboardEvent)=>this.keys.delete(e.code);
    const md=(e:MouseEvent)=>{if(e.target===this.renderer.domElement){this.mouseDown=true;this.lastX=e.clientX;this.lastY=e.clientY;}};
    const mm=(e:MouseEvent)=>{if(!this.mouseDown)return;this.addTouchLook(e.clientX-this.lastX,e.clientY-this.lastY);this.lastX=e.clientX;this.lastY=e.clientY;};
    const mu=(e:MouseEvent)=>{if(e.target===this.renderer.domElement && this.mouseDown && Math.hypot(e.clientX-this.lastX,e.clientY-this.lastY)<4)this.performAction();this.mouseDown=false;};
    const wh=(e:WheelEvent)=>{if(e.target===this.renderer.domElement){e.preventDefault();this.elevate(e.deltaY>0?-.25:.25);}};
    this._onKeyDown=kd;this._onKeyUp=ku;this._onMouseDown=md;this._onMouseMove=mm;this._onMouseUp=mu;this._onWheel=wh;
    addEventListener('keydown',kd);addEventListener('keyup',ku);addEventListener('mousedown',md);addEventListener('mousemove',mm);addEventListener('mouseup',mu);addEventListener('wheel',wh,{passive:false});addEventListener('resize',this.onResize);
  }
  private _onKeyDown!:(e:KeyboardEvent)=>void; private _onKeyUp!:(e:KeyboardEvent)=>void; private _onMouseDown!:(e:MouseEvent)=>void; private _onMouseMove!:(e:MouseEvent)=>void; private _onMouseUp!:(e:MouseEvent)=>void; private _onWheel!:(e:WheelEvent)=>void;

  public performAction(){
    this.raycaster.setFromCamera(new THREE.Vector2(0,0),this.camera);
    const hits=this.raycaster.intersectObjects([this.floor,...this.bricks],true); const hit=hits[0];
    if(this.mode==='ERASE'){if(hit){let g:THREE.Object3D=hit.object;while(g.parent&&!this.bricks.includes(g as THREE.Group))g=g.parent;const idx=this.bricks.indexOf(g as THREE.Group);if(idx>=0){this.scene.remove(this.bricks[idx]);this.undoStack.push(this.bricks[idx]);this.bricks.splice(idx,1);playRemoveSound(this.soundEnabled);this.sync();}}return;}
    if(hit){const normal=hit.face?hit.face.normal.clone().transformDirection(hit.object.matrixWorld):new THREE.Vector3(0,1,0);const p=hit.point.clone().addScaledVector(normal,.26);const type=BRICK_TYPES.find(x=>x.id===this.brickTypeId)??BRICK_TYPES[0];
      const g=this.createBrickGroup(this.brickTypeId); g.rotation.y=this.rotation*Math.PI/2; g.position.set(this.snap(p.x,type.w),this.mode==='BUILD'?(hit.object===this.floor?type.h/2:(hit.object.parent as THREE.Object3D)?.position?.y+type.h||type.h/2):type.h/2,this.snap(p.z,type.l));
      this.scene.add(g);this.bricks.push(g);this.undoStack=[];this.ssr.selects=this.bricks;playSnapSound(this.soundEnabled);this.sync();
    }
  }

  private sync(){this.callbacks.onBrickCountChange(this.bricks.length);this.callbacks.onCanUndoChange(this.undoStack.length>0);}
  public undo(){const g=this.bricks.pop();if(g){this.scene.remove(g);this.undoStack.push(g);this.sync();}}
  public clearAll(){for(const g of this.bricks)this.scene.remove(g);this.bricks=[];this.undoStack=[];this.sync();}
  public setMode(mode:BuildMode){this.mode=mode;this.updateGhost();}
  public setColorIdx(i:number){this.colorIdx=i;this.updateGhost();}
  public setBrickType(id:string){this.brickTypeId=id;this.updateGhost();}
  public rotate(){this.rotation=(this.rotation+1)%4;playRotateSound(this.soundEnabled);}
  public resetCamera(){this.camera.position.set(0,this.playerHeight,7);this.input.pitch=0;this.input.yaw=0;}
  public elevate(d:number){this.playerHeight=THREE.MathUtils.clamp(this.playerHeight+d,this.minPlayerHeight,this.maxPlayerHeight);this.callbacks.onHeightChange?.(this.playerHeight);}
  public setTheme(theme:'dark'|'light'){this.theme=theme;const c=theme==='dark'?0x0a0e17:0xe2e8f0;this.scene.background=new THREE.Color(c);this.scene.fog=new THREE.Fog(c,this.fogStart,this.fogEnd);}
  public setRealisticFx(v:boolean){this.realisticFx=v;}
  public setSSAOEnabled(v:boolean){this.ssaoEnabled=v;}
  public setSunAngle(v:number){this.sunAngle=v%360;this.updateSunPosition();}
  public setDynamicSunOrbit(v:boolean){this.dynamicSunOrbit=v;}
  public setJoystickInput(forward:number,side:number){this.input.forward=forward;this.input.side=side;}
  public addTouchLook(dx:number,dy:number){this.input.yaw-=dx*.003;this.input.pitch=THREE.MathUtils.clamp(this.input.pitch-dy*.003,-1.5,1.5);}
  public loadPreset(name:'tower'|'pyramid'|'house'){
    this.clearAll();
    const add=(x:number,y:number,z:number,color:number)=>{const g=this.createBrickGroup(this.brickTypeId,color);g.position.set(x,y,z);this.scene.add(g);this.bricks.push(g);};
    if(name==='tower')for(let i=0;i<6;i++)add(0,.3+i*.6,0,i%COLORS.length);
    else if(name==='pyramid')for(let y=0;y<4;y++)for(let x=-3+y;x<=3-y;x+=2)for(let z=-3+y;z<=3-y;z+=2)add(x*.25,.3+y*.6,z*.25,(x+z+y+10)%COLORS.length);
    else {for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)add(x*.5,.3,z*.5,(x+z+10)%COLORS.length);for(let y=1;y<3;y++)for(let x=-1;x<=1;x++)for(const z of [-.5,.5])add(x*.5,.3+y*.6,z,(x+y+3)%COLORS.length);}
    this.sync();this.ssr.selects=this.bricks;
  }

  private animate=()=>{if(this.destroyed)return;this.raf=requestAnimationFrame(this.animate);
    if(this.dynamicSunOrbit){this.sunAngle=(this.sunAngle+.12)%360;this.updateSunPosition();}
    let f=this.input.forward,s=this.input.side;if(!f&&!s){if(this.keys.has('KeyW')||this.keys.has('ArrowUp'))f=1;if(this.keys.has('KeyS')||this.keys.has('ArrowDown'))f=-1;if(this.keys.has('KeyA')||this.keys.has('ArrowLeft'))s=-1;if(this.keys.has('KeyD')||this.keys.has('ArrowRight'))s=1;}
    const forward=new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion);forward.y=0;forward.normalize();const side=new THREE.Vector3(1,0,0).applyQuaternion(this.camera.quaternion);side.y=0;side.normalize();
    this.camera.position.addScaledVector(forward,f*.08);this.camera.position.addScaledVector(side,s*.08);this.camera.position.y=this.playerHeight;
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.input.pitch,this.input.yaw,0,'YXZ'));
    if(this.ghost&&this.mode==='BUILD'){this.raycaster.setFromCamera(new THREE.Vector2(0,0),this.camera);const h=this.raycaster.intersectObjects([this.floor,...this.bricks],true)[0];if(h){const type=BRICK_TYPES.find(x=>x.id===this.brickTypeId)??BRICK_TYPES[0];const n=h.face?h.face.normal.clone().transformDirection(h.object.matrixWorld):new THREE.Vector3(0,1,0);const p=h.point.clone().addScaledVector(n,.26);this.ghost.position.set(this.snap(p.x,type.w),h.object===this.floor?type.h/2:(h.object.parent as THREE.Object3D)?.position.y??type.h/2,this.snap(p.z,type.l));this.ghost.visible=true;}else this.ghost.visible=false;}
    const fh=this.raycaster.intersectObjects([this.floor,...this.bricks],true)[0];const focus=fh?THREE.MathUtils.clamp(fh.distance,1.5,12):this.focusDistance;this.bokeh.uniforms['focus'].value=focus;
    if(this.realisticFx){this.ssao.enabled=this.ssaoEnabled;this.ssr.enabled=true;this.bokeh.enabled=true;this.composer.render();}else this.renderer.render(this.scene,this.camera);
  };
  public onResize=()=>{const w=Math.max(1,this.container.clientWidth),h=Math.max(1,this.container.clientHeight);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);this.composer.setSize(w,h);this.ssao.setSize(w,h);this.ssr.setSize(w,h);this.bokeh.setSize(w,h);};
  public destroy(){this.destroyed=true;cancelAnimationFrame(this.raf);removeEventListener('keydown',this._onKeyDown);removeEventListener('keyup',this._onKeyUp);removeEventListener('mousedown',this._onMouseDown);removeEventListener('mousemove',this._onMouseMove);removeEventListener('mouseup',this._onMouseUp);removeEventListener('wheel',this._onWheel);removeEventListener('resize',this.onResize);this.composer.dispose();this.renderer.dispose();this.renderer.domElement.remove();}
}
