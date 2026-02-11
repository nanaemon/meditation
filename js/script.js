/* ========= 設定 ========= */
const FADE_MS = 1200;
const SCENES = {
  deepsea: {
    title: "深海", caption: "深い海の底で",
    video: "./video/deepsea.mp4",
    audio: { mp3: "./audio/deepsea.wav" }
  },
  firewood: {
    title: "薪", caption: "静かな炎のそばで",
    video: "./video/firewood.mp4",
    audio: { mp3: "./audio/firewood.wav"}
  },
  rain: {
    title: "雨", caption: "言葉のかわりに降る",
    video: "./video/rain.mp4",
    audio: { mp3: "./audio/rain.mp3", ogg: "./audio/rain.wav" }
  },
  thunder: {
    title: "海", caption: "絶え間ない流れ",
    video: "./video/sea.mp4",
    audio: { mp3: "./audio/thunder.mp3", ogg: "./audio/sea.wav" }
  },
  forest: {
    title: "森", caption: "風が木々を渡る音のなかで",
    video: "./video/forest.mp4",
    audio: { mp3: "./audio/forest.mp3", ogg: "./audio/forest.wav" }
  }
};

/* ========= 要素参照 ========= */
const vidA = document.getElementById('vidA');
const vidB = document.getElementById('vidB');
let front = vidA, back = vidB;
const titleEl = document.getElementById('sceneTitle');
const captionEl = document.getElementById('sceneCaption');
const sceneButtons = Array.from(document.querySelectorAll('.scenes [data-scene]'));
const vol = document.getElementById('vol');
const bright = document.getElementById('bright');
const timerSel = document.getElementById('timer');
const pauseBtn = document.getElementById('pauseBtn');
const fsBtn = document.getElementById('fullscreenBtn');
const gate = document.getElementById('gate');
const startBtn = document.getElementById('startBtn');
const videoWrap = document.getElementById('videoWrap');

/* ========= オーディオ ========= */
let audioA = new Audio(), audioB = new Audio();
let aFront = audioA, aBack = audioB;
[audioA, audioB].forEach(a => {
  a.loop = true;
  a.preload = 'auto';
  a.crossOrigin = 'anonymous';
  a.volume = 0;
});

let currentScene = 'deepsea';
let timerId = 0, fadeOutInt = 0;
let fadeTimer = null, pauseFadeTimer = null;
let isPaused = false;

/* ========= ユーティリティ ========= */
function cancelFades(){
  if (fadeTimer){ clearInterval(fadeTimer); fadeTimer = null; }
  if (pauseFadeTimer){ clearInterval(pauseFadeTimer); pauseFadeTimer = null; }
  if (fadeOutInt){ clearInterval(fadeOutInt); fadeOutInt = 0; }
}
function pickAudioSrc(obj){
  const test = document.createElement('audio');
  if(obj.ogg && test.canPlayType('audio/ogg')) return obj.ogg;
  return obj.mp3;
}
function waitCanPlay(el){
  return new Promise(resolve=>{
    if(el.readyState >= 2) return resolve();
    const on = ()=>{ el.removeEventListener('canplay', on); resolve(); };
    el.addEventListener('canplay', on, { once:true });
  });
}
function setMedia(el, scene){ el.src = SCENES[scene].video; el.load(); }
function setAudio(el, scene){ el.src = pickAudioSrc(SCENES[scene].audio); el.load(); }

/* ========= 初期化 ========= */
setMedia(front, currentScene);
setAudio(aFront, currentScene);
front.classList.add('active');

/* ========= SFX（クリック音） ========= */
let sfxCtx = null;
let sfxBuffers = {};
let sfxReady = false;
let sfxEnabled = false;

async function loadSfx(name, url){
  try{
    const res = await fetch(url);
    if(!res.ok) throw new Error('HTTP '+res.status+' '+res.statusText);
    const buf = await res.arrayBuffer();
    sfxBuffers[name] = await sfxCtx.decodeAudioData(buf);
    console.log('[SFX] loaded:', name);
  }catch(err){
    console.error('[SFX] load error:', err);
  }
}

function playSfx(name, baseGain = 0.6){
  if(!sfxEnabled || !sfxReady) return;
  const b = sfxBuffers[name]; if(!b) return;
  if(sfxCtx.state === 'suspended'){ sfxCtx.resume().catch(()=>{}); }

  const src = sfxCtx.createBufferSource();
  const g = sfxCtx.createGain();
  src.buffer = b;
  src.playbackRate.value = 0.96 + Math.random()*0.08;

  const t = sfxCtx.currentTime;
  g.gain.setValueAtTime(0.0, t);
  g.gain.linearRampToValueAtTime(baseGain, t + 0.01);
  g.gain.linearRampToValueAtTime(0.0, t + 0.35);

  src.connect(g).connect(sfxCtx.destination);
  src.start(t);
  src.stop(t + 0.37);
}

/* ========= 再生許可 ========= */
startBtn.addEventListener('click', async ()=>{
  gate.style.display = 'none';
  try{
    await front.play();
    aFront.volume = parseFloat(vol.value);
    await aFront.play();
  }catch(e){ console.warn(e); }

  // 🎵 SFX初期化：初回と通常で別の音
  try {
    sfxCtx = new (window.AudioContext || window.webkitAudioContext)();
    await sfxCtx.resume();
    await loadSfx('start', './sfx/start.wav'); // 初回専用音
    await loadSfx('click', './sfx/click.mp3'); // 通常クリック音
    sfxReady = true;
    sfxEnabled = true;
    playSfx('start', 0.8); // 初回クリック音
  } catch(e) {
    console.warn('SFX init failed:', e);
  }

  updateTexts(currentScene, true);
});

/* ========= シーン切替 ========= */
sceneButtons.forEach(btn=>btn.addEventListener('click', ()=> switchScene(btn.dataset.scene)));

async function switchScene(scene){
  if(scene === currentScene) return;
  cancelFades();

  sceneButtons.forEach(b=>b.setAttribute('aria-current', b.dataset.scene===scene ? 'true':'false'));
  videoWrap.style.setProperty('--br', bright.value);

  back.pause(); back.removeAttribute('src'); back.load();
  const videoReady = waitCanPlay(back);
  back.src = SCENES[scene].video; back.load();
  await videoReady;
  if(!isPaused){ try{ await back.play(); }catch(e){} }

  aBack.pause(); aBack.removeAttribute('src'); aBack.load();
  const audioSrc = pickAudioSrc(SCENES[scene].audio);
  const audioReady = waitCanPlay(aBack);
  aBack.src = audioSrc; aBack.load();
  await audioReady;
  if(!isPaused){ try{ await aBack.play(); }catch(e){} }

  back.classList.add('active');
  front.classList.remove('active');
  updateTexts(scene);

  if(!isPaused){
    fadeVolumes(aFront, aBack, parseFloat(vol.value), FADE_MS);
  }else{
    aBack.volume = 0;
  }

  [front, back] = [back, front];
  [aFront, aBack] = [aBack, aFront];
  currentScene = scene;

  playSfx('click', 0.65);
}

/* ========= 音量・明るさ ========= */
vol.addEventListener('input', ()=>{ aFront.volume = parseFloat(vol.value); });
bright.addEventListener('input', ()=>{ videoWrap.style.setProperty('--br', bright.value); });

/* ========= タイマー ========= */
timerSel.addEventListener('change', ()=>{
  if(timerId){ clearTimeout(timerId); timerId=0; }
  if(fadeOutInt){ clearInterval(fadeOutInt); fadeOutInt=0; }
  const sec = parseInt(timerSel.value,10);
  if(!sec) return;
  timerId = setTimeout(()=>{
    const startVol = parseFloat(vol.value);
    const start = performance.now();
    fadeOutInt = setInterval(()=>{
      const p = Math.min(1,(performance.now()-start)/4000);
      const v = startVol*(1-p);
      aFront.volume = v;
      if(p>=1){
        clearInterval(fadeOutInt);
        fadeOutInt=0;
        aFront.pause(); front.pause();
        isPaused = true;
        pauseBtn.setAttribute('aria-pressed','true');
        pauseBtn.textContent = '▶ 再開';
      }
    }, 50);
  }, sec*1000);
});

/* ========= 一時停止 / 再開 ========= */
pauseBtn.addEventListener('click', async ()=>{
  cancelFades();
  if(!isPaused){
    isPaused = true;
    pauseBtn.setAttribute('aria-pressed','true');
    pauseBtn.textContent = '▶ 再開';
    const v0 = aFront.volume;
    const t0 = performance.now();
    pauseFadeTimer = setInterval(()=>{
      const p = Math.min(1,(performance.now()-t0)/300);
      aFront.volume = v0*(1-p);
      if(p>=1){
        clearInterval(pauseFadeTimer); pauseFadeTimer=null;
        [aFront,aBack].forEach(a=>{ a.pause(); a.volume=0; });
        [front,back].forEach(v=>v.pause());
      }
    },30);
  }else{
    isPaused = false;
    pauseBtn.setAttribute('aria-pressed','false');
    pauseBtn.textContent = '⏸ 一時停止';
    try{ await front.play(); }catch(e){}
    try{ await aFront.play(); }catch(e){}
    aFront.volume = parseFloat(vol.value);
    playSfx('click', 0.5);
  }
});

/* ========= フェード ========= */
function fadeVolumes(from,to,target,ms){
  if(fadeTimer){ clearInterval(fadeTimer); fadeTimer=null; }
  const t0 = performance.now();
  const v0 = from.volume;
  to.volume = 0;
  fadeTimer = setInterval(()=>{
    const p = Math.min(1,(performance.now()-t0)/ms);
    from.volume = v0*(1-p);
    to.volume = target*p;
    if(p>=1){
      clearInterval(fadeTimer); fadeTimer=null;
      from.volume=0; to.volume=target; from.pause();
    }
  },50);
}

/* ========= テキスト更新 ========= */
function updateTexts(scene,instant=false){
  const s = SCENES[scene];
  [titleEl, captionEl].forEach(el=>el.classList.remove('show'));
  setTimeout(()=>{
    titleEl.textContent=s.title;
    captionEl.textContent=s.caption;
    [titleEl, captionEl].forEach(el=>{
      if(instant){ el.style.transition='none'; }
      el.classList.add('show');
    });
    if(instant){
      requestAnimationFrame(()=>{ [titleEl, captionEl].forEach(el=>el.style.transition=''); });
    }
  },150);
}

/* ========= 全画面 ========= */
if(fsBtn){
  fsBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`全画面エラー: ${err.message}`);
      });
      playSfx('click', 0.5);
    } else {
      document.exitFullscreen();
      playSfx('click', 0.5);
    }
  });
}

/* ========= UIフェード ========= */
let uiTimer = null;
const uiTimeout = 3000;
function showUI() {
  document.body.classList.add('ui-visible');
  if (uiTimer) clearTimeout(uiTimer);
  uiTimer = setTimeout(() => {
    document.body.classList.remove('ui-visible');
  }, uiTimeout);
}
showUI();
['mousemove','mousedown','touchstart','keydown'].forEach(ev=>{
  document.addEventListener(ev, showUI, {passive:true});
});

/* ========= 復帰時のAudioContext対策 ========= */
document.addEventListener('visibilitychange', ()=>{
  if(sfxCtx && sfxCtx.state === 'suspended'){ sfxCtx.resume().catch(()=>{}); }
});

/* ========= 初期明るさ反映 ========= */
videoWrap.style.setProperty('--br', bright.value);
