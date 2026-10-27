/* MD Sample · WAV decoder and MIDI Sample Dump Standard encoder. No network. */
(function(root){
'use strict';
function wav(buffer){
 const v=new DataView(buffer), text=(p,n)=>String.fromCharCode(...new Uint8Array(buffer,p,n));
 if(v.byteLength<12||text(0,4)!=='RIFF'||text(8,4)!=='WAVE')throw Error('This is not a RIFF WAV file. Choose the original audio file.');
 const end=v.getUint32(4,true)+8;if(end>v.byteLength)throw Error('The WAV file is incomplete.');
 let f,offset=-1,size=0;
 for(let p=12;p+8<=end;){const len=v.getUint32(p+4,true),body=p+8;if(body+len>end)throw Error('The WAV file contains an incomplete chunk.');
  if(text(p,4)==='fmt '){if(len<16)throw Error('Invalid WAV format.');let format=v.getUint16(body,true),bits=v.getUint16(body+14,true);if(format===65534){if(len<40||v.getUint16(body+16,true)<22)throw Error('Invalid extensible WAV format.');const guid=[0,0,0,0,16,0,128,0,0,170,0,56,155,113];if(!guid.every((x,i)=>v.getUint8(body+26+i)===x))throw Error('This WAV subformat is not supported.');format=v.getUint16(body+24,true);if(v.getUint16(body+18,true)!==bits)throw Error('This extensible WAV uses a different valid bit depth. Export standard PCM WAV.');}f={format,bits,channels:v.getUint16(body+2,true),rate:v.getUint32(body+4,true),align:v.getUint16(body+12,true)};}
  if(text(p,4)==='data'&&offset<0){offset=body;size=len;}p=body+len+(len%2);
 }
 if(!f||offset<0)throw Error('The WAV file has no readable audio data.');
 if(f.channels<1||f.channels>2)throw Error('Please choose mono or stereo audio.');
 if(!((f.format===1&&[8,16,24,32].includes(f.bits))||(f.format===3&&[32,64].includes(f.bits))))throw Error('Supported WAV formats: PCM 8/16/24/32-bit or float 32/64-bit.');
 if(f.rate<4000||f.rate>192000)throw Error('Source sample rate must be between 4 and 192 kHz.');
 if(f.align!==f.channels*f.bits/8||size%f.align)throw Error('Inconsistent WAV audio structure.');
 const frames=size/f.align;if(!frames)throw Error('This audio file is empty.');if(frames/f.rate>180)throw Error('Choose an audio clip shorter than three minutes.');
 const channels=Array.from({length:f.channels},()=>new Float32Array(frames));let clipped=0;
 for(let i=0;i<frames;i++)for(let c=0;c<f.channels;c++){
  const p=offset+i*f.align+c*f.bits/8;let x;
  if(f.format===3)x=f.bits===32?v.getFloat32(p,true):v.getFloat64(p,true);
  else if(f.bits===8)x=(v.getUint8(p)-128)/128;
  else if(f.bits===16)x=v.getInt16(p,true)/32768;
  else if(f.bits===24){let n=v.getUint8(p)|(v.getUint8(p+1)<<8)|(v.getUint8(p+2)<<16);if(n&0x800000)n-=0x1000000;x=n/8388608;}
  else x=v.getInt32(p,true)/2147483648;
  if(!Number.isFinite(x))throw Error('The WAV contains non-finite audio values.');if(x>1||x< -1)clipped++;channels[c][i]=Math.max(-1,Math.min(1,x));
 }
 return {...f,frames,channels,duration:frames/f.rate,clipped};
}
function mono(w,mode='mix'){if(mode==='left'||w.channels.length===1)return w.channels[0].slice();if(mode==='right')return w.channels[1].slice();const a=new Float32Array(w.frames);for(let i=0;i<a.length;i++)a[i]=(w.channels[0][i]+w.channels[1][i])/2;return a;}
// Windowed-sinc reconstruction with a low-pass cutoff when reducing sample rate.
function resample(a,from,to){if(from===to)return a;const n=Math.round(a.length*to/from),b=new Float32Array(n),cut=Math.min(1,to/from)*0.94,radius=24;for(let i=0;i<n;i++){const pos=i*from/to,base=Math.floor(pos);let sum=0,weight=0;for(let j=base-radius+1;j<=base+radius;j++){const d=pos-j;if(Math.abs(d)>=radius)continue;const sinc=d===0?cut:Math.sin(Math.PI*cut*d)/(Math.PI*d);const win=0.5+0.5*Math.cos(Math.PI*d/radius),k=sinc*win;if(j>=0&&j<a.length){sum+=a[j]*k;weight+=k;}}b[i]=weight?sum/weight:0;}return b;}
function pcm(x){return Math.max(-32768,Math.min(32767,Math.round(Math.max(-1,Math.min(1,x))*32768)));}
function encode(samples,rate,slot=0){if(!Number.isInteger(rate)||rate<4000||rate>48000)throw Error('Invalid output sample rate.');if(!samples.length||samples.length>1000000)throw Error('This tool allows up to 1,000,000 mono samples. Shorten the clip or lower the output sample rate.');if(!Number.isInteger(slot)||slot<0||slot>16383)throw Error('Invalid SDS sample slot.');
 const packets=Math.ceil(samples.length/40),out=new Uint8Array(21+packets*127);let p=0;const put=(...a)=>{out.set(a,p);p+=a.length;},u21=n=>put(n&127,(n>>>7)&127,(n>>>14)&127);
 put(240,126,0,1,slot&127,(slot>>>7)&127,16);u21(Math.round(1e9/rate));u21(samples.length);u21(0);u21(0);put(127,247);
 for(let k=0;k<packets;k++){const begin=p;put(240,126,0,2,k&127);for(let j=0;j<40;j++){const idx=k*40+j;if(idx>=samples.length){put(0,0,0);continue;}if(!Number.isFinite(samples[idx]))throw Error('Invalid audio value.');const u=pcm(samples[idx])+32768;put((u>>>9)&127,(u>>>2)&127,(u&3)<<5);}let check=0;for(let q=begin+1;q<p;q++)check^=out[q];put(check&127,247);}return out;
}
function preview(samples,rate){const b=new ArrayBuffer(44+samples.length*2),v=new DataView(b);let p=0;const str=s=>{for(const c of s)v.setUint8(p++,c.charCodeAt(0));},u16=n=>{v.setUint16(p,n,true);p+=2;},u32=n=>{v.setUint32(p,n,true);p+=4;};str('RIFF');u32(b.byteLength-8);str('WAVEfmt ');u32(16);u16(1);u16(1);u32(rate);u32(rate*2);u16(2);u16(16);str('data');u32(samples.length*2);for(const x of samples){v.setInt16(p,pcm(x),true);p+=2;}return b;}
const api={wav,mono,resample,encode,preview};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MDSDS=api;
})(typeof globalThis!=='undefined'?globalThis:this);
