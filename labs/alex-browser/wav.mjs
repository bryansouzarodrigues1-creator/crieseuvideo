/** PCM float to standard mono signed 16-bit WAV. No resampling or cloud API. */
export function encodeWav(samples,rate){
  if(!(samples instanceof Float32Array)||!samples.length||rate!==24000||samples.length>rate*180)throw new Error('Invalid PCM');
  const buffer=new ArrayBuffer(44+samples.length*2),v=new DataView(buffer);
  const ascii=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
  ascii(0,'RIFF');v.setUint32(4,buffer.byteLength-8,true);ascii(8,'WAVE');ascii(12,'fmt ');
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);
  v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);ascii(36,'data');v.setUint32(40,samples.length*2,true);
  let peak=0;
  for(let i=0;i<samples.length;i++){
    if(!Number.isFinite(samples[i]))throw new Error('Invalid sample');
    const x=Math.max(-1,Math.min(1,samples[i]));peak=Math.max(peak,Math.abs(x));
    v.setInt16(44+i*2,Math.round(x*(x<0?32768:32767)),true);
  }
  if(peak<.001)throw new Error('Model returned silence');
  return buffer;
}
