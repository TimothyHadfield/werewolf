/* Narrator: reads lines aloud with the browser's free speech engine
 * (speechSynthesis) and shows each line on screen. Works silently (timed
 * lines) when speech is off or missing. One generation token per run so an
 * old narration can never fire into a new screen.
 */
(function () {
  "use strict";
  const hasSpeech = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  let gen = 0;
  let voice = null;
  let beat = null;

  function pickVoice() {
    if (!hasSpeech()) return null;
    const all = window.speechSynthesis.getVoices() || [];
    const eng = all.filter((v) => /^en(-|_|$)/i.test(v.lang));
    const pool = eng.length ? eng : all;
    let best = null, bs = -1;
    pool.forEach((v) => {
      const n = (v.name || "").toLowerCase();
      let s = 0;
      if (/natural|neural|online|premium|enhanced|siri/.test(n)) s += 50;
      if (/^en-us/i.test(v.lang)) s += 10; else if (/^en-gb/i.test(v.lang)) s += 8;
      if (/daniel|guy|ryan|arthur|alex|aaron|fred/.test(n)) s += 5; // a deeper storyteller voice when there is one
      if (s > bs) { bs = s; best = v; }
    });
    return best;
  }
  if (hasSpeech()) {
    try {
      voice = pickVoice();
      window.speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); };
    } catch (e) { /* no voices */ }
  }

  function stop() {
    gen++;
    if (beat) { clearInterval(beat); beat = null; }
    if (hasSpeech()) { try { window.speechSynthesis.cancel(); } catch (e) {} }
  }

  // lines: [{say, wait?}] ; opts: {voice: bool, rate: number, onLine(i, text), onDone()}
  function play(lines, opts) {
    stop();
    const my = ++gen;
    opts = opts || {};
    const sc = opts.scale || 1;
    const speak = opts.voice !== false && hasSpeech() && sc === 1;
    let i = 0;
    if (speak) beat = setInterval(() => { try { if (window.speechSynthesis.speaking) window.speechSynthesis.resume(); } catch (e) {} }, 4000);
    function next() {
      if (my !== gen) return;
      if (i >= lines.length) { if (beat) { clearInterval(beat); beat = null; } if (opts.onDone) opts.onDone(); return; }
      const ln = lines[i];
      if (opts.onLine) opts.onLine(i, ln.say);
      const after = () => { if (my !== gen) return; i++; setTimeout(next, (ln.wait != null ? ln.wait : 350) * sc); };
      if (!speak || !ln.say) { setTimeout(after, Math.max(900, ln.say ? ln.say.length * 55 : 0) * sc); return; }
      let done = false;
      const fin = () => { if (done) return; done = true; after(); };
      try {
        const u = new SpeechSynthesisUtterance(ln.say);
        if (voice) u.voice = voice;
        u.rate = opts.rate || 0.92; u.pitch = 0.95; u.volume = 1;
        u.onend = fin; u.onerror = fin;
        window.speechSynthesis.speak(u);
        // Safety net: some engines never fire onend.
        setTimeout(fin, 2500 + ln.say.length * 110);
      } catch (e) { setTimeout(fin, 1200); }
    }
    next();
  }

  // iOS only speaks after a tap has started speech once: call this in a tap.
  function unlock() {
    if (!hasSpeech()) return;
    try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; window.speechSynthesis.speak(u); } catch (e) {}
  }

  window.Narrator = { play, stop, unlock, available: hasSpeech };
})();
