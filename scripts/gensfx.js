const fs = require('fs');
const SR = 22050;
function wav(samples){
  const n=samples.length, buf=Buffer.alloc(44+n*2);
  buf.write('RIFF',0); buf.writeUInt32LE(36+n*2,4); buf.write('WAVE',8);
  buf.write('fmt ',12); buf.writeUInt32LE(16,16); buf.writeUInt16LE(1,20);
  buf.writeUInt16LE(1,22); buf.writeUInt32LE(SR,24); buf.writeUInt32LE(SR*2,28);
  buf.writeUInt16LE(2,32); buf.writeUInt16LE(16,34); buf.write('data',36); buf.writeUInt32LE(n*2,40);
  for(let i=0;i<n;i++){let s=Math.max(-1,Math.min(1,samples[i]));buf.writeInt16LE(s*32767|0,44+i*2);}
  return buf;
}
const env=(i,n,a=0.005,d=0.3)=>{const t=i/SR,T=n/SR;const at=Math.min(1,t/a);const rel=Math.max(0,1-(t)/(T));return at*Math.pow(rel,1);};
function tone(dur,f,type='sine',decay=1){const n=dur*SR|0,o=new Float32Array(n);for(let i=0;i<n;i++){const t=i/SR;let v;const ph=2*Math.PI*f*t;v=type==='sine'?Math.sin(ph):type==='square'?Math.sign(Math.sin(ph)):type==='saw'?2*((f*t)%1)-1:(Math.random()*2-1);o[i]=v*Math.pow(1-i/n,decay)*0.5;}return o;}
function noise(dur,decay=3){const n=dur*SR|0,o=new Float32Array(n);for(let i=0;i<n;i++)o[i]=(Math.random()*2-1)*Math.pow(1-i/n,decay)*0.5;return o;}
function mix(...arrs){const n=Math.max(...arrs.map(a=>a.length));const o=new Float32Array(n);for(const a of arrs)for(let i=0;i<a.length;i++)o[i]+=a[i];return o;}
// chop: a low thud + woody crack
function chop(){const a=tone(0.12,120,'sine',2);const b=noise(0.08,5).map((v)=>v*0.4);return mix(a,Float32Array.from(b));}
// ui click: short blip
function click(){return tone(0.05,880,'square',3);}
// build: rising two-tone
function build(){const a=tone(0.1,440,'sine',1);const b=tone(0.12,660,'sine',1);const o=new Float32Array(a.length+b.length);a.forEach((v,i)=>o[i]=v);b.forEach((v,i)=>o[a.length+i]=v);return o;}
// error: low buzz
function err(){return tone(0.18,140,'square',1);}
// shoot: noise burst + click
function shoot(){return mix(noise(0.09,6),Float32Array.from(tone(0.05,300,'saw',4)));}
const map={chop,ui_click:click,building_upgrade:build,ui_error:err,building_hit:chop,shoot_ak:shoot,player_hurt:()=>tone(0.15,200,'saw',2)};
for(const [name,fn] of Object.entries(map)){fs.writeFileSync(`assets/audio/sfx/${name}.wav`,wav(fn()));console.log('wrote',name);}
