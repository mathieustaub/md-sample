/* Local audio import. AIFF/AIFF-C PCM is decoded here; compressed formats use Web Audio. */
(function(root){
'use strict';
function aiff(buffer){
 const v=new DataView(buffer),text=(p,n)=>String.fromCharCode(...new Uint8Array(buffer,p,n));
 if(v.byteLength<12||text(0,4)!=='FORM'||!['AIFF','AIFC'].includes(text(8,4)))throw Error('Not an AIFF file.');
 const end=v.getUint32(4,false)+8;if(end>v.byteLength)throw Error('The AIFF file is incomplete.');
 let f=null,offset=-1,available=0;
 for(let p=12;p+8<=end;){const n=v.getUint32(p+4,false),body=p+8;if(body+n>end)throw Error('The AIFF file contains an incomplete chunk.');
  if(text(p,4)==='COMM'){
   if(n<18)throw Error('Invalid AIFF format.');const signExp=v.getUint16(body+8,false),exp=signExp&32767,mantissa=v.getUint32(body+10,false)*4294967296+v.getUint32(body+14,false);
   const rate=Math.round((signExp&32768?-1:1)*mantissa*Math.pow(2,exp-16383-63));
   let codec='NONE';if(text(8,4)==='AIFC'){if(n<22)throw Error('Invalid AIFF-C format.');codec=text(body+18,4);}
   f={channels:v.getUint16(body,false),frames:v.getUint32(body+2,false),bits:v.getUint16(body+6,false),rate,codec};
  }
  if(text(p,4)==='SSND'){if(n<8)throw Error('Invalid AIFF sound chunk.');const skip=v.getUint32(body,false);if(skip>n-8)throw Error('Invalid AIFF sound offset.');offset=body+8+skip;available=n-8-skip;}
  p=body+n+(n%2);
 }
 if(!f||offset<0)throw Error('The AIFF file has no readable audio.');
 if(f.channels<1||f.channels>2)throw Error('Please choose mono or stereo audio.');
 if(!['NONE','twos','sowt','fl32','FL32','fl64','FL64'].includes(f.codec))throw Error('This compressed AIFF-C format is not supported. Export it as PCM AIFF or WAV.');
 const floating=/^fl(32|64)$/i.test(f.codec);
 if(!(floating?[32,64]:[8,16,24,32]).includes(f.bits))throw Error('Unsupported AIFF bit depth.');
 if(!Number.isFinite(f.rate)||f.rate<4000||f.rate>192000)throw Error('Source sample rate must be between 4 and 192 kHz.');
 if(!f.frames||f.frames/f.rate>180)throw Error('Choose a non-empty audio clip shorter than three minutes.');
 const width=f.bits/8,align=f.channels*width;if(f.frames*align>available)throw Error('The AIFF audio data is incomplete.');
 const channels=Array.from({length:f.channels},()=>new Float32Array(f.frames)),little=f.codec==='sowt';let clipped=0;
 for(let i=0;i<f.frames;i++)for(let c=0;c<f.channels;c++){
  const p=offset+i*align+c*width;let x;
  if(floating)x=f.bits===32?v.getFloat32(p,false):v.getFloat64(p,false);
  else if(f.bits===8)x=v.getInt8(p)/128;
  else if(f.bits===16)x=v.getInt16(p,little)/32768;
  else if(f.bits===24){let n=little?v.getUint8(p)|(v.getUint8(p+1)<<8)|(v.getUint8(p+2)<<16):(v.getUint8(p)<<16)|(v.getUint8(p+1)<<8)|v.getUint8(p+2);if(n&8388608)n-=16777216;x=n/8388608;}
  else x=v.getInt32(p,little)/2147483648;
  if(!Number.isFinite(x))throw Error('The file contains non-finite audio values.');if(x>1||x< -1)clipped++;channels[c][i]=Math.max(-1,Math.min(1,x));
 }
 return {...f,channels,duration:f.frames/f.rate,clipped,format:floating?3:1,kind:'AIFF'};
}
async function browserDecode(buffer){
 const Context=root.OfflineAudioContext||root.webkitOfflineAudioContext;
 if(!Context)throw Error('This browser does not provide an audio decoder. Try a recent Chrome, Firefox, Edge or Safari.');
 // A dedicated offline context avoids opening an audio device. Its rate is explicit.
 const context=new Context(1,1,44100);let decoded;
 try{decoded=await context.decodeAudioData(buffer);}catch(e){throw Error('Your browser could not decode this file. The codec may be unsupported, the file incomplete or copy-protected. Try another browser, or export WAV / AIFF.');}
 if(decoded.numberOfChannels<1||decoded.numberOfChannels>2)throw Error('Please choose mono or stereo audio.');
 if(!decoded.length||decoded.duration>180)throw Error('Choose a non-empty audio clip shorter than three minutes.');
 const channels=[];let clipped=0;
 for(let c=0;c<decoded.numberOfChannels;c++){const a=decoded.getChannelData(c).slice();for(let i=0;i<a.length;i++){if(!Number.isFinite(a[i]))throw Error('The file contains invalid audio values.');if(a[i]>1||a[i]< -1)clipped++;a[i]=Math.max(-1,Math.min(1,a[i]));}channels.push(a);}
 return {channels,frames:decoded.length,rate:decoded.sampleRate,duration:decoded.duration,clipped,bits:null,format:3,decoded:true};
}
async function decode(buffer,filename='',fallback=browserDecode){
 const bytes=new Uint8Array(buffer),tag=p=>String.fromCharCode(...bytes.slice(p,p+4));
 if(tag(0)==='RIFF'&&tag(8)==='WAVE'){const engine=root.MDSDS||(typeof require==='function'?require('./sds.js'):null);return {...engine.wav(buffer),kind:'WAV'};}
 if(tag(0)==='FORM'&&['AIFF','AIFC'].includes(tag(8)))return aiff(buffer);
 const out=await fallback(buffer);return {...out,kind:(filename.split('.').pop()||'AUDIO').toUpperCase()};
}
const api={aiff,decode};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MDAudio=api;
})(typeof globalThis!=='undefined'?globalThis:this);
