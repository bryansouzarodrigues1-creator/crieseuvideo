"""Original stereo music and effects; action times match the native movie."""
from pathlib import Path
import json,math,wave
import numpy as np
from scipy.signal import butter,sosfilt
ROOT=Path(__file__).resolve().parents[1]/'tmp'/'end-battle2-audio'
ROOT.mkdir(parents=True,exist_ok=True)
sr=48000;duration=120;n=sr*duration
rng=np.random.default_rng(202611202)
t=np.arange(n,dtype=np.float32)/sr
out=np.zeros((n,2),dtype=np.float32)
def add(start,sound,gain=1,pan=0):
    k=max(0,round(start*sr));m=min(len(sound),n-k)
    if m<=0:return
    out[k:k+m,0]+=sound[:m]*gain*math.sqrt((1-pan)/2)
    out[k:k+m,1]+=sound[:m]*gain*math.sqrt((1+pan)/2)
def tt(length):return np.arange(round(length*sr),dtype=np.float32)/sr
def noise_band(length,lo,hi):
    z=rng.standard_normal(round(length*sr)).astype(np.float32)
    z=sosfilt(butter(2,[lo,hi],btype='band',fs=sr,output='sos'),z).astype(np.float32)
    return z/max(.001,float(z.std()))
def thunk(start,freq=95,amp=.05,metal=False,pan=0):
    q=tt(.45)
    s=np.sin(2*np.pi*(freq*q-6*q*q))*np.exp(-q*18)
    if metal:s+=.24*np.sin(2*np.pi*freq*2.76*q)*np.exp(-q*14)
    s+=.22*rng.standard_normal(len(q))*np.exp(-q*80)
    s*=1-np.exp(-q*450)
    add(start,s.astype(np.float32),amp,pan)
def whoosh(start,length=.5,amp=.04,pan=0):
    q=tt(length);s=noise_band(length,120,2600)*np.sin(np.pi*q/length)**2
    add(start,s,amp,pan)
def impact(start,amp=.3):
    q=tt(1.25)
    s=(np.sin(2*np.pi*(62*q-9*q*q))*np.exp(-q*4.4)
       +.28*noise_band(1.25,80,2700)*np.exp(-q*13))*(1-np.exp(-q*600))
    add(start,s,amp)
    for j in range(4):thunk(start+.025*j,170+37*j,amp*.11,True,(j-1.5)*.16)
def roar(start,length,amp):
    q=tt(length);freq=72+18*np.sin(np.pi*q/length)
    phase=2*np.pi*np.cumsum(freq)/sr
    s=(np.sin(phase)+.4*np.sin(phase*2.03))*(.65+.35*np.sin(2*np.pi*31*q))
    s+=.27*noise_band(length,90,1100)
    add(start,s*np.sin(np.pi*q/length)**1.2,amp)
# An original D-minor progression, with space for the action.
chords=[(146.83,174.61,220),(116.54,146.83,174.61),(98,116.54,146.83),(110,138.59,164.81)]
energy=[.32,.58,.62,.34,.60,.64,.76,.78,.47,.40,.92,.32]
for scene in range(12):
    chord=chords[(scene//2)%4]
    if scene==11:chord=(146.83,185,220)
    q=tt(10.5);env=np.clip(q/.45,0,1)*np.clip((10.5-q)/.7,0,1)
    pad=sum(np.sin(2*np.pi*f*q+.18*np.sin(q*.8))+.12*np.sin(2*np.pi*f*2*q) for f in chord)/3
    add(scene*10,pad*env,.017+energy[scene]*.012)
    for beat in range(16):
        start=scene*10+beat*.625;q=tt(.82);freq=chord[beat%3]*(2 if beat%4 else 1)
        pl=(np.sin(2*np.pi*freq*q)+.23*np.sin(2*np.pi*freq*2*q))*np.exp(-q*5.7)*(1-np.exp(-q*80))
        add(start,pl,.018*energy[scene],(-1 if beat%2 else 1)*.24)
        if scene not in (0,3,9,11) and beat%2==0:thunk(start,49+(beat%4)*4,.026*energy[scene])
        if scene in (6,7,10) and beat%4==2:
            q=tt(.16);add(start,noise_band(.16,300,7000)*np.exp(-q*25),.011)
# Continuous End ambience with separate channels.
for channel in range(2):
    air=noise_band(duration,100,1900)
    out[:,channel]+=.0045*air*(.8+.2*np.sin(t*.13+channel))
    out[:,channel]+=.008*np.sin(2*np.pi*55*t+.3*np.sin(t*.26+channel))
# Wing downbeats follow the animation frequency (3.5 radians/sec).
for tm in np.arange(.35,112,2*np.pi/3.5):
    grounded=18.5<tm<25.6 or 68.5<tm<85.4 or 102.5<tm<110.4
    whoosh(float(tm),.45,.009 if grounded else .031,math.sin(tm*.15)*.4)
for start,end in [(13,15.3),(43.8,46.3),(63,66.3)]:
    q=tt(end-start);e=np.clip(q/.18,0,1)*np.clip((end-start-q)/.3,0,1)
    s=(noise_band(end-start,150,2500)+.28*np.sin(2*np.pi*163*q)*np.sin(q*33)**2)*e
    add(start,s,.075);roar(start-.3,.85,.041)
for j,event in enumerate(json.loads((ROOT/'footsteps.json').read_text())):
    loud=.020+min(event['speed'],3)*.006
    thunk(event['time'],106+(event['actor']%3)*9,loud,True,event['pan'])
for hit in [23.4,106.5]:
    whoosh(hit-.24,.24,.09);impact(hit,.32 if hit>100 else .25);roar(hit+.18,1.1,.065)
# Healing crystal shimmer, then a distinct glass-like shatter.
q=tt(32.3);e=np.clip(q/.6,0,1)*np.clip((32.3-q)/.2,0,1)
add(24.5,(np.sin(2*np.pi*329.63*q+.8*np.sin(q*4))+.25*np.sin(2*np.pi*659.26*q))*e,.012,-.35)
whoosh(56.5,.3,.065);impact(56.8,.15)
for i in range(24):
    q=tt(.75);freq=880+173*(i%7);s=(np.sin(2*np.pi*freq*q)+.25*np.sin(2*np.pi*freq*1.414*q))*np.exp(-q*(5+i%4))*(1-np.exp(-q*600))
    add(56.8+i*.035,s,.014,(i%5-2)*.2)
roar(60.1,1.9,.075)
for tm in [72.8,75.4,78.2]:thunk(tm,80,.08,True)
whoosh(81.85,.55,.10,.35);impact(82.4,.24);thunk(83.4,87,.13,True,.4)
for tm in [90.8,92.6,94.4,95.8]:thunk(tm,180,.022,True,.2)
roar(109.8,2.3,.057);whoosh(111.1,1.7,.10)
for i in range(30):
    q=tt(1.7);freq=440*2**((i%12)/12);s=np.sin(2*np.pi*freq*q)*np.exp(-q*3.7)*(1-np.exp(-q*50))
    add(111.5+i*.045,s,.010,(i%7-3)*.15)
q=tt(5);e=np.clip(q/.8,0,1)*np.clip((5-q)/.9,0,1)
add(115,(np.sin(2*np.pi*164.81*q)+.3*np.sin(2*np.pi*329.63*q))*e,.025)
fade=np.clip(t/.3,0,1)*np.clip((120-t)/1.2,0,1);out*=fade[:,None]
peak=float(np.abs(out).max());out*=.80/max(.80,peak)
with wave.open(str(ROOT/'batalha-end-sound.wav'),'wb') as f:
    f.setnchannels(2);f.setsampwidth(2);f.setframerate(sr);f.writeframes((np.clip(out,-1,1)*32767).astype('<i2').tobytes())
(ROOT/'audio-cues.json').write_text(json.dumps({'duration':120,'sample_rate':48000,'channels':2,'original_music':True,'narration':False,'punches':[23.4,106.5],'crystal':56.8,'tail_hit':82.4,'rescue':[90.8,95.8],'defeat':111.5,'peak_before_mastering':peak},indent=2))
print('Original stereo music and action effects:',duration,'seconds; pre-master peak:',round(peak,4))
