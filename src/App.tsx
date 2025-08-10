import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

/******************
 * Focus Flow — Clean Build (focus-only)
 * - YouTube removed
 * - Motivational Speeches loads from Internet Archive (dynamic)
 * - Guaranteed fallback: full MP3 list from the item page
 ******************/

/************ utils ************/
function uid(){ return Math.random().toString(36).slice(2, 10); }
function usePersistentState<T>(key:string, initial:T){
  const isClient = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  const [state, setState] = useState<T>(()=> {
    if(!isClient) return initial;
    try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : initial; }catch{ return initial; }
  });
  useEffect(()=>{ if(!isClient) return; try{ localStorage.setItem(key, JSON.stringify(state)); }catch{} },[key,state,isClient]);
  return [state, setState] as const;
}
const sanitizeSummary = (txt:string)=> (txt||'').replace(/\r?\n/g,' ');

/************ sample media ************/
const MUSIC = [
  { title: 'Lo-fi Stream (sample)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { title: 'Piano Ambient (sample)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
];

/** Archive fallback (from https://archive.org/details/motivational-speech) **/
const ARCHIVE_ID = 'motivational-speech';
const HARDCODED_ARCHIVE_MP3S = [
  'DO IT FOR YOU - Motivational Speech.mp3',
  'DO IT FOR YOU - Powerful Motivational Speech.mp3',
  'DO IT FOR YOU (Best Motivational Speeches EVER!)-1.mp3',
  'DO IT FOR YOU (Best Motivational Speeches EVER!).mp3',
  'DO IT FOR YOU (Best Self Discipline Motivational Speech).mp3',
  'DO NOT FEAR _ Believe in Yourself - Inspirational & Motivational Speech.mp3',
  'DO NOT FEAR _ Believe in Yourself - Inspirational & Motivational Video.mp3',
  "DON'T WASTE ANOTHER YEAR _ Best Motivational Speech.mp3",
  "DON'T WASTE ANOTHER YEAR!!! - Best Motivational Speech.mp3",
  "DON'T WASTE YOUR LIFE _ Morning Motivation _ Motivational Speech 2022.mp3",
  'WATCH THIS EVERYDAY AND CHANGE YOUR LIFE - Best Motivational Speech 2021.mp3',
  'WHEN IT HURTS - Best Motivational Speech 2020.mp3',
  'WHEN LIFE BREAKS YOU (Best Self Discipline Motivational Speech).mp3',
  'WINNERS NEVER GIVE UP - Best Motivational Speech.mp3',
  'YOU VS YOU __ Best Self Discipline Motivational Speech.mp3',
  'YOU WILL GET THROUGH THIS - Powerful Motivational Speech 2020.mp3',
  'You Will NEVER BE LAZY Again _ Best Motivational Speech 2022.mp3',
].map(name => ({ title: name.replace(/_/g,' ').replace(/\.mp3$/i,''), url: `https://archive.org/download/${ARCHIVE_ID}/${encodeURIComponent(name)}` }));

const QUOTES = [
  { text: 'Discipline beats motivation.', author:'Unknown' },
  { text: 'Small daily wins become momentum.', author:'Unknown' },
  { text: "You don't need more time; you need more focus.", author:'Unknown' },
  { text: 'Simplicity is the ultimate sophistication.', author:'Leonardo da Vinci' },
  { text: 'It always seems impossible until it’s done.', author:'Nelson Mandela' },
];

/************ types ************/
type Task = { id:string; text:string; done:boolean; today:boolean; createdAt?:number; due?:number };
type Note = { id:string; text:string; ts:number };

/************ timer ************/
function useFocusTimer(){
  const [mode,setMode] = usePersistentState<'focus'|'break'>('ff.mode','focus');
  const [workLen,setWorkLen] = usePersistentState<number>('ff.work', 25);
  const [breakLen,setBreakLen] = usePersistentState<number>('ff.break', 5);
  const [seconds,setSeconds] = usePersistentState<number>('ff.seconds', 25*60);
  const [running,setRunning] = usePersistentState<boolean>('ff.running', false);

  useEffect(()=>{ if(!running && mode==='focus') setSeconds(workLen*60); },[workLen, running, mode, setSeconds]);
  useEffect(()=>{ if(!running && mode==='break') setSeconds(breakLen*60); },[breakLen, running, mode, setSeconds]);

  useEffect(()=>{
    if(!running) return;
    const id = window.setInterval(()=>{
      setSeconds(s=>{
        if(s>0) return s-1;
        const next = mode==='focus'? 'break' : 'focus';
        setMode(next);
        return next==='focus'? workLen*60 : breakLen*60;
      });
    },1000);
    return ()=> clearInterval(id);
  },[running, mode, workLen, breakLen, setSeconds, setMode]);

  const reset = ()=>{ setRunning(false); setSeconds(mode==='focus'? workLen*60 : breakLen*60); };
  const mm = String(Math.floor(seconds/60)).padStart(2,'0');
  const ss = String(seconds%60).padStart(2,'0');
  return {mode,setMode,workLen,setWorkLen,breakLen,setBreakLen,seconds,running,setRunning,reset,mm,ss} as const;
}

/************ soundscapes ************/
function useSoundscapes(){
  const ctxRef = useRef<any>(null);
  const nodeRef = useRef<ScriptProcessorNode|null>(null);
  const gainRef = useRef<GainNode|null>(null);
    const [playing,setPlaying] = useState(false);
  const [kind,setKind] = useState<'white'|'brown'|null>(null);
  const ensure = ()=>{ if(ctxRef.current) return ctxRef.current; const Ctx:any=(window as any).AudioContext||(window as any).webkitAudioContext; ctxRef.current = new Ctx(); return ctxRef.current; };
  const stop = ()=>{ nodeRef.current?.disconnect(); gainRef.current?.disconnect(); nodeRef.current=null; gainRef.current=null; setPlaying(false); setKind(null); };
  const start = (type:'white'|'brown')=>{
    stop(); const ctx=ensure(); if(ctx.state==='suspended'){ try{ ctx.resume(); }catch{} }
    const g=ctx.createGain(); g.gain.value=0.14; g.connect(ctx.destination); gainRef.current=g;
    const node=ctx.createScriptProcessor(4096,1,1); let last=0;
    node.onaudioprocess=(e:any)=>{ const out=e.outputBuffer.getChannelData(0); for(let i=0;i<out.length;i++){ let v=Math.random()*2-1; if(type==='brown'){ v=(last+0.02*v)/1.02; last=v; v*=3.5; } out[i]=v; } };
    node.connect(g); nodeRef.current=node; setPlaying(true); setKind(type);
  };
  return { start, stop, playing, kind } as const;
}

/************ App ************/
export default function App(){
  const [dark,setDark] = usePersistentState<boolean>('ff.dark', true);
  const noise = useSoundscapes();

  // one-time cleanup of old keys
  useEffect(()=>{
    try{
      if(typeof window==='undefined' || typeof localStorage==='undefined') return;
      if(localStorage.getItem('ff.cleanedOnce')==='1') return;
      const WHITELIST = new Set([
        'ff.dark','ff.tasks','ff.notesV2','ff.activeNote',
        'ff.mode','ff.work','ff.break','ff.seconds','ff.running',
        'ff.tracks','ff.track','ff.muted',
        'ff.speech.idx','ff.speech.muted',
        'ff.quote','ff.streak','ff.cleanedOnce'
      ]);
      const toDelete:string[]=[];
      for(let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i)!; const lower=k.toLowerCase();
        const isCFA = lower.startsWith('ff.cfa') || lower.includes('cfa');
        const notWhitelisted = !WHITELIST.has(k);
        if(isCFA || notWhitelisted) toDelete.push(k);
      }
      toDelete.forEach(k=> localStorage.removeItem(k));
      localStorage.setItem('ff.cleanedOnce','1');
    }catch{}
  },[]);

  // tasks
  const [tasks,setTasks] = usePersistentState<Task[]>('ff.tasks', []);
  const [newTask,setNewTask] = useState('');
  const [newTaskDue,setNewTaskDue] = useState<string>('');
  const addTask = (txt:string)=>{ const t=txt.trim(); if(!t) return; const dueTs = newTaskDue? Date.parse(newTaskDue):undefined; setTasks(v=>[{id:uid(), text:t, done:false, today:true, createdAt:Date.now(), due:dueTs}, ...v]); setNewTask(''); setNewTaskDue(''); };
  const toggleTask = (id:string)=> setTasks(v=> v.map(x=> x.id===id? {...x, done:!x.done}:x));
  const delTask = (id:string)=> setTasks(v=> v.filter(x=> x.id!==id));

  // notes
  const [notes,setNotes] = usePersistentState<Note[]>('ff.notesV2', []);
  const [noteText,setNoteText] = useState('');
  const addNote = ()=>{ const t=noteText.trim(); if(!t) return; setNotes(v=> [{id:uid(), text:t, ts:Date.now()}, ...v]); setNoteText(''); };
  const delNote = (id:string)=> setNotes(v=> v.filter(n=> n.id!==id));

  // timer
  const {mode,setMode,workLen,setWorkLen,breakLen,setBreakLen,seconds,running,setRunning,reset,mm,ss} = useFocusTimer();

  // music
  const [playlist] = usePersistentState('ff.tracks', MUSIC);
  const [track,setTrack] = usePersistentState<number>('ff.track', 0);
  const [muted,setMuted] = usePersistentState<boolean>('ff.muted', false);
  const audioRef = useRef<HTMLAudioElement|null>(null);
  useEffect(()=>{ const a=audioRef.current; if(!a) return; a.src = playlist[track]?.url || ''; a.load(); },[track, playlist]);

  // speeches (MP3) — dynamic + hard fallback
  const [speeches, setSpeeches] = useState<{ title: string; url: string }[]>(HARDCODED_ARCHIVE_MP3S); // start with guaranteed list
  const [speechIdx,setSpeechIdx] = usePersistentState<number>('ff.speech.idx', 0);
  const [speechMuted,setSpeechMuted] = usePersistentState<boolean>('ff.speech.muted', false);
  const speechRef = useRef<HTMLAudioElement|null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(`https://archive.org/metadata/${ARCHIVE_ID}`, {
          mode: 'cors',
          headers: { 'Accept': 'application/json' },
          signal: ctrl.signal
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const mp3s = Array.isArray(data?.files)
          ? data.files
              .filter((f: any) => f?.name && typeof f.name === 'string' && f.name.toLowerCase().endsWith('.mp3'))
              .map((f: any) => ({
                title: (f.title || f.name || '').replace(/_/g, ' ').replace(/\.mp3$/i,''),
                url: `https://archive.org/download/${ARCHIVE_ID}/${encodeURIComponent(f.name)}`
              }))
              .sort((a:any,b:any)=> a.title.localeCompare(b.title))
          : [];
        if (mp3s.length) {
          setSpeeches(mp3s);
        }
      } catch (e) {
        // keep fallback; nothing else to do
        console.warn('Using fallback MP3 list (Archive fetch failed or empty).', e);
      }
    })();
    return () => ctrl.abort();
  }, []);

  // keep index in range if list size changes
  useEffect(() => {
    setSpeechIdx(i => speeches.length ? (i % speeches.length) : 0);
  }, [speeches, setSpeechIdx]);

  useEffect(()=>{ 
    const el=speechRef.current; 
    if(!el || !speeches.length) return; 
    el.src = speeches[speechIdx % speeches.length]?.url || ''; 
    el.load(); 
  },[speechIdx, speeches]);

  // quotes
  const [quoteIdx,setQuoteIdx] = usePersistentState<number>('ff.quote', 0);

  // sanity
  useEffect(()=>{ try{
    console.assert('X\nY'.replace(/\n/g,' ')==='X Y');
    console.assert(sanitizeSummary('A\nB\r\nC')==='A B C');
  }catch{} },[]);

  const today = tasks.filter(t=> t.today && !t.done);
  const inbox = tasks.filter(t=> !t.today && !t.done);
  const done  = tasks.filter(t=> t.done);

  return (
    <div className={`min-h-screen ${dark? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'}`}>
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-black/10 backdrop-blur supports-[backdrop-filter]:bg-black/30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-semibold tracking-tight">FocusFlow</div>
          <div className="flex items-center gap-2 text-sm">
            <button className="rounded-lg border px-3 py-1" onClick={()=> setDark(!dark)}>{dark? 'Light' : 'Dark'}</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Timer + Audio */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timer */}
          <section className={`rounded-2xl border ${dark? 'bg-zinc-900 border-zinc-800':'bg-white'} shadow-sm`}>
            <div className="p-4 border-b border-black/10 flex items-center justify-between">
              <div className="font-semibold text-lg">Focus Timer</div>
              <div className="flex items-center gap-2 text-xs">
                <button className={`px-3 py-1 rounded-xl border ${mode==='focus'? 'bg-orange-600 text-white':''}`} onClick={()=> setMode('focus')}>Focus</button>
                <button className={`px-3 py-1 rounded-xl border ${mode==='break'? 'bg-orange-600 text-white':''}`} onClick={()=> setMode('break')}>Break</button>
              </div>
            </div>
            <div className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="text-6xl font-bold tabular-nums" style={{color:'#e6a15c'}}>{mm}:{ss}</div>
              <div className="flex items-center gap-2">
                {!running ? (
                  <button className="px-3 py-2 rounded-xl bg-orange-600 text-white" onClick={()=> setRunning(true)}>Start</button>
                ) : (
                  <button className="px-3 py-2 rounded-xl border" onClick={()=> setRunning(false)}>Pause</button>
                )}
                <button className="px-3 py-2 rounded-xl border" onClick={reset}>Reset</button>
              </div>
            </div>
            <div className="px-6 pb-5 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <label className="flex items-center justify-between gap-2 p-2 rounded-xl border"><span>Focus (min)</span>
                <input type="number" min={5} max={120} value={workLen} onChange={e=>{ const v=Math.max(5,Math.min(120,Number(e.target.value)||25)); setWorkLen(v); }} className={`w-20 rounded-md border px-2 py-1 ${dark? 'bg-zinc-800 border-zinc-700 text-zinc-100':''}`}/>
              </label>
              <label className="flex items-center justify-between gap-2 p-2 rounded-xl border"><span>Break (min)</span>
                <input type="number" min={1} max={60} value={breakLen} onChange={e=>{ const v=Math.max(1,Math.min(60,Number(e.target.value)||5)); setBreakLen(v); }} className={`w-20 rounded-md border px-2 py-1 ${dark? 'bg-zinc-800 border-zinc-700 text-zinc-100':''}`}/>
              </label>
            </div>
          </section>

          {/* Focus Music */}
          <section className={`rounded-2xl border ${dark? 'bg-zinc-900 border-zinc-800':'bg-white'} shadow-sm`}>
            <div className="p-4 border-b border-black/10 flex items-center justify-between">
              <div className="font-semibold text-lg">Focus Music</div>
              <div className="text-xs opacity-70">Now: <span className="font-medium">{MUSIC[track]?.title||'—'}</span></div>
            </div>
            <div className="p-4">
              <audio ref={audioRef} className="w-full" muted={muted} controls playsInline preload="none" onEnded={()=> setTrack((t)=> (t+1)%MUSIC.length)} />
              <div className="flex flex-wrap gap-2 mt-3 text-sm">
                <button className="px-3 py-1 rounded-xl border" onClick={()=> audioRef.current?.play().catch(()=>{})}>Play</button>
                <button className="px-3 py-1 rounded-xl border" onClick={()=> audioRef.current?.pause()}>Pause</button>
                <button className="px-3 py-1 rounded-xl border" onClick={()=>{ const a=audioRef.current; if(a){ a.pause(); a.currentTime=0; } }}>Stop</button>
                <button className="px-3 py-1 rounded-xl border" onClick={()=>{ const a=audioRef.current; if(a){ a.pause(); a.currentTime=0; } setTrack((t)=> (t+1)%MUSIC.length); setTimeout(()=> audioRef.current?.play().catch(()=>{}),60); }}>Next</button>
                <button className="px-3 py-1 rounded-xl border" onClick={()=> setMuted(m=>!m)}>{muted? 'Unmute':'Mute'}</button>
              </div>
            </div>
            <div className="px-4 pb-4 border-t border-black/10">
              <div className="font-medium text-sm mb-2">Soundscapes</div>
              <div className="flex flex-wrap gap-2 text-sm">
                <button className={`px-3 py-1 rounded-xl border ${noise.playing && noise.kind==='white'? 'bg-orange-600 text-white':''}`} onClick={()=> noise.start('white')}>White Noise</button>
                <button className={`px-3 py-1 rounded-xl border ${noise.playing && noise.kind==='brown'? 'bg-orange-600 text-white':''}`} onClick={()=> noise.start('brown')}>Brown Noise</button>
                <button className="px-3 py-1 rounded-xl border" onClick={()=> noise.stop()}>Stop</button>
              </div>
            </div>
          </section>

          {/* Motivational Speeches (MP3) */}
          <section className={`rounded-2xl border ${dark? 'bg-zinc-900 border-zinc-800':'bg-white'} shadow-sm`}>
            <div className="p-4 border-b border-black/10 flex items-center justify-between">
              <div className="font-semibold text-lg">Motivational Speeches</div>
              <div className="text-xs opacity-70">
                Now: <span className="font-medium">{speeches[speechIdx % speeches.length]?.title || '—'}</span>
              </div>
            </div>
            <div className="p-4">
              <audio ref={speechRef} className="w-full" muted={speechMuted} controls playsInline preload="none" onEnded={()=> setSpeechIdx((i)=> (i+1)%speeches.length)} />
              <div className="flex flex-wrap gap-2 mt-3 text-sm">
                <button className="px-3 py-1 rounded-xl border" onClick={()=> speechRef.current?.play().catch(()=>{})}>Play</button>
                <button className="px-3 py-1 rounded-xl border" onClick={()=> speechRef.current?.pause()}>Pause</button>
                <button className="px-3 py-1 rounded-xl border" onClick={()=>{ const a=speechRef.current; if(a){ a.pause(); a.currentTime=0; } }}>Stop</button>
                <button className="px-3 py-1 rounded-xl border" onClick={()=>{ const a=speechRef.current; if(a){ a.pause(); a.currentTime=0; } setSpeechIdx((i)=> (i+1)%speeches.length); setTimeout(()=> speechRef.current?.play().catch(()=>{}),60); }}>Next</button>
                <button className="px-3 py-1 rounded-xl border" onClick={()=> setSpeechMuted(m=>!m)}>{speechMuted? 'Unmute':'Mute'}</button>
              </div>

              {/* quick picker */}
              <div className="mt-3">
                <select
                  value={speechIdx % speeches.length}
                  onChange={e => setSpeechIdx(Number(e.target.value))}
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${dark? 'bg-zinc-800 border-zinc-700 text-zinc-100':''}`}
                >
                  {speeches.map((s, i) => <option key={s.url} value={i}>{s.title}</option>)}
                </select>
              </div>
            </div>
          </section>
        </div>

        {/* Right: Tasks + Notes + Quote */}
        <div className="space-y-6">
          {/* Tasks */}
          <section className={`rounded-2xl border ${dark? 'bg-zinc-900 border-zinc-800':'bg-white'} shadow-sm`}>
            <div className="p-4 border-b border-black/10 flex items-center justify-between">
              <div className="font-semibold text-lg">Tasks</div>
            </div>
            <div className="p-4">
              <div className="flex gap-2 mb-3">
                <input value={newTask} onChange={e=> setNewTask(e.target.value)} placeholder="Add a task…" className={`flex-1 rounded-xl border px-3 py-2 text-sm ${dark? 'bg-zinc-800 border-zinc-700 text-zinc-100':''}`}/>
                <input type="datetime-local" value={newTaskDue} onChange={e=> setNewTaskDue(e.target.value)} className={`rounded-xl border px-3 py-2 text-sm ${dark? 'bg-zinc-800 border-zinc-700 text-zinc-100':''}`}/>
                <button className="px-3 py-2 rounded-xl bg-orange-600 text-white" onClick={()=> addTask(newTask)}>Add</button>
              </div>
              <div className="space-y-2">
                {today.length>0 && <div className="text-xs uppercase tracking-wide opacity-70">Today</div>}
                {today.map(t=> <TaskRow key={t.id} t={t} onToggle={()=> toggleTask(t.id)} onDelete={()=> delTask(t.id)} dark={dark} />)}
                {inbox.length>0 && <div className="text-xs uppercase tracking-wide opacity-70 mt-3">Inbox</div>}
                {inbox.map(t=> <TaskRow key={t.id} t={t} onToggle={()=> toggleTask(t.id)} onDelete={()=> delTask(t.id)} dark={dark} />)}
                {done.length>0 && <div className="text-xs uppercase tracking-wide opacity-70 mt-3">Done</div>}
                {done.map(t=> <TaskRow key={t.id} t={t} onToggle={()=> toggleTask(t.id)} onDelete={()=> delTask(t.id)} dark={dark} />)}
              </div>
            </div>
          </section>

          {/* Notes */}
          <section className={`rounded-2xl border ${dark? 'bg-zinc-900 border-zinc-800':'bg-white'} shadow-sm`}>
            <div className="p-4 border-b border-black/10 font-semibold text-lg">Notes</div>
            <div className="p-4 text-sm space-y-3">
              <textarea value={noteText} onChange={e=> setNoteText(e.target.value)} rows={4} placeholder="Write a note…" className={`w-full rounded-xl border px-3 py-2 text-sm ${dark? 'bg-zinc-800 border-zinc-700 text-zinc-100':''}`}></textarea>
              <button className="px-3 py-2 rounded-xl bg-orange-600 text-white" onClick={addNote}>Add Note</button>
              {notes.length===0 ? (
                <div className={`text-xs border border-dashed rounded-xl p-3 ${dark? 'border-zinc-700 opacity-70' : 'text-slate-500'}`}>No notes yet.</div>
              ) : (
                <div className="space-y-2">
                  {notes.map(n=> (
                    <div key={n.id} className={`${dark? 'bg-zinc-800' : 'bg-slate-50'} p-3 rounded-xl flex items-start justify-between gap-3`}>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] opacity-60 mb-1">{new Date(n.ts).toLocaleString()}</div>
                        <div className="whitespace-pre-wrap break-words">{n.text}</div>
                      </div>
                      <div className="shrink-0">
                        <button className="px-3 py-1 rounded-xl border" onClick={()=> delNote(n.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Quote */}
          <section className={`rounded-2xl border ${dark? 'bg-zinc-900 border-zinc-800':'bg-white'} shadow-sm`}>
            <div className="p-4 border-b border-black/10 font-semibold text-lg">Focus Quote</div>
            <div className="p-4">
              <blockquote className={`${dark? 'bg-zinc-800' : 'bg-slate-100'} p-3 rounded-xl`}>
                <div className="italic">{QUOTES[quoteIdx%QUOTES.length].text}</div>
                <div className="text-xs opacity-70 mt-1">— {QUOTES[quoteIdx%QUOTES.length].author}</div>
              </blockquote>
              <button className="mt-3 text-xs underline" onClick={()=> setQuoteIdx(q=>q+1)}>New Quote</button>
            </div>
          </section>
        </div>
      </div>

      <div className="py-6 text-center text-xs opacity-60">FocusFlow • clean build</div>
    </div>
  );
}

function TaskRow({t,onToggle,onDelete,dark}:{t:Task,onToggle:()=>void,onDelete:()=>void,dark:boolean}){
  return (
    <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} className={`flex items-start justify-between gap-3 p-3 rounded-xl ${dark? 'bg-zinc-800' : 'bg-slate-50'}`}>
      <div className="flex-1 min-w-0">
        <div className={`text-sm break-words whitespace-pre-wrap ${t.done? 'line-through opacity-60':''}`}>{t.text}</div>
        <div className="text-[11px] opacity-60 mt-1 flex flex-wrap items-center gap-2">
          {t.createdAt && <span>Added {new Date(t.createdAt).toLocaleString()}</span>}
          {t.due && <span>• Due {new Date(t.due).toLocaleString()}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button className="px-3 py-1 rounded-xl bg-orange-600 text-white" onClick={onToggle}>{t.done? 'Undo':'Done'}</button>
        <button className="px-3 py-1 rounded-xl border" onClick={onDelete}>Delete</button>
      </div>
    </motion.div>
  );
}
