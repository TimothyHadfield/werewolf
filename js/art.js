/* Werewolf / Mafia — original card art as SVG strings (browser + Node). No DOM.
 *
 *   WWArt.role(key, theme, size) -> "<svg ...>"   key: wolf seer doctor bodyguard witch hunter mason prince villager
 *                                                  theme: "werewolf" (default) or "mafia"
 *   WWArt.back(size)             -> card back
 *   WWArt.moon(size) / WWArt.sun(size) -> small 24x24 icons
 *
 * Cards use viewBox 0 0 120 160; `size` is the width in px (height follows).
 * Every call gets its own id suffix, so many SVGs can share one page.
 * All drawings are original to this project.
 */
(function (root) {
  "use strict";

  let uid = 0;
  const next = () => "wa" + (++uid).toString(36);

  const TEAM = { wolf: "wolves", seer: "village", doctor: "village", bodyguard: "village", witch: "village", hunter: "village", mason: "village", prince: "village", villager: "village" };

  // Per-team palette: sky (top, bottom), frame colour, ornament colour.
  const PAL = {
    wolves: { skyTop: "#3a1418", skyBot: "#120a10", frame: "#e0605a", frame2: "#8e2f2c", orn: "#f08a7e", halo: "#e0605a" },
    village: { skyTop: "#1d2850", skyBot: "#0d1020", frame: "#6ea8fe", frame2: "#f0b354", orn: "#f0b354", halo: "#6ea8fe" },
  };

  // Emblem accent per role (light, dark).
  const ACC = {
    wolf: ["#e0605a", "#5a1c1e"],
    seer: ["#a9b8ff", "#3b3f8f"],
    doctor: ["#7ee0b5", "#1f6b52"],
    bodyguard: ["#9fc3ff", "#2a4d8a"],
    witch: ["#c49bff", "#4b2a7a"],
    hunter: ["#f0b354", "#7a4a12"],
    mason: ["#d7b48a", "#6b4a2a"],
    prince: ["#ffd66e", "#8a5a12"],
    villager: ["#f0b354", "#6b4718"],
  };

  // Small deterministic random so stars stay put between renders.
  function rng(seed) {
    let s = 0;
    for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    s = s || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  function stars(seed, n, x0, y0, w, h, color) {
    const r = rng(seed);
    let out = "";
    for (let i = 0; i < n; i++) {
      const x = (x0 + r() * w).toFixed(1), y = (y0 + r() * h).toFixed(1);
      const rad = (0.35 + r() * 0.65).toFixed(2), op = (0.25 + r() * 0.6).toFixed(2);
      out += `<circle cx="${x}" cy="${y}" r="${rad}" fill="${color}" opacity="${op}"/>`;
    }
    return out;
  }

  function svgOpen(size, vbW, vbH, label) {
    const w = Math.round(size || vbW), h = Math.round(w * vbH / vbW);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="${w}" height="${h}" role="img" aria-label="${label}">`;
  }

  /* ---------- background silhouettes along the bottom ---------- */

  function pines(fill) {
    // Rolling hill with a row of pines.
    const tree = (x, s) => `<path d="M${x} ${136 - 22 * s}L${x + 6 * s} ${136 - 10 * s}H${x + 3 * s}L${x + 8 * s} ${136}H${x - 8 * s}L${x - 3 * s} ${136 - 10 * s}H${x - 6 * s}Z"/>`;
    return `<g fill="${fill}">` +
      tree(16, 1.1) + tree(28, 0.8) + tree(98, 1.2) + tree(108, 0.85) + tree(86, 0.7) +
      `<path d="M5 140C26 130 44 134 60 136C78 138 96 128 115 134V150H5Z"/></g>`;
  }

  function skyline(fill, lit) {
    const b = [[5, 128, 10], [15, 120, 8], [23, 132, 9], [32, 116, 7], [88, 118, 9], [97, 126, 8], [105, 112, 10]];
    let s = `<g fill="${fill}">`;
    let win = "";
    const r = rng("skyline");
    b.forEach(([x, y, w]) => {
      s += `<rect x="${x}" y="${y}" width="${w}" height="${150 - y}"/>`;
      for (let wy = y + 3; wy < 136; wy += 4.5) {
        for (let wx = x + 1.6; wx + 1.6 <= x + w - 1; wx += 3) {
          if (r() < 0.3) win += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="1.4" height="2"/>`;
        }
      }
    });
    s += `<path d="M5 138H115V150H5Z"/></g><g fill="${lit}" opacity=".7">${win}</g>`;
    return s;
  }

  /* ---------- emblems (centre ~ 60,80) ---------- */

  function wolfHead(id, a) {
    return `
<defs>
  <linearGradient id="${id}wf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b5f73"/><stop offset="1" stop-color="#2a2d3b"/></linearGradient>
  <radialGradient id="${id}we" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe9a8"/><stop offset="1" stop-color="#f0b354"/></radialGradient>
</defs>
<g stroke-linejoin="round">
  <path d="M60 60L72 56L86 36L91 66L99 80L95 93L84 99L74 115L60 122L46 115L36 99L25 93L21 80L29 66L34 36L48 56Z" fill="url(#${id}wf)" stroke="${a[0]}" stroke-width="1.6"/>
  <path d="M60 60L48 56L34 36L29 66L21 80L25 93L36 99L46 115L60 122Z" fill="#000" opacity=".22"/>
  <path d="M37 44L46 58L35 62Z M83 44L74 58L85 62Z" fill="${a[1]}"/>
  <path d="M60 60L66 70L60 88L54 70Z" fill="#8a8fa6" opacity=".55"/>
  <path d="M29 66L44 74L36 99Z M91 66L76 74L84 99Z" fill="#fff" opacity=".06"/>
  <path d="M41 77L54 82L44 85Z M79 77L66 82L76 85Z" fill="url(#${id}we)"/>
  <path d="M52 92L60 88L68 92L67 108L60 113L53 108Z" fill="#9aa0b8"/>
  <path d="M55 104H65L60 111Z" fill="#14161f"/>
  <path d="M50 112L53 120L56 113 M70 112L67 120L64 113" fill="#fff" stroke="#fff" stroke-width=".6"/>
</g>`;
  }

  function fedora(id, a) {
    return `
<defs>
  <linearGradient id="${id}hf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4f63"/><stop offset="1" stop-color="#1e2130"/></linearGradient>
  <linearGradient id="${id}sf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e3244"/><stop offset="1" stop-color="#151722"/></linearGradient>
</defs>
<path d="M26 142C28 122 42 114 60 116C78 114 92 122 94 142Z" fill="url(#${id}sf)" stroke="${a[0]}" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M52 116L60 134L68 116Z" fill="#d9dce6"/>
<path d="M58 119H62L63 124L60 136L57 124Z" fill="${a[0]}"/>
<path d="M44 117L56 132L52 118Z M76 117L64 132L68 118Z" fill="#0c0d14" opacity=".7"/>
<path d="M44 86C44 104 51 115 60 115C69 115 76 104 76 86Z" fill="#11131b"/>
<path d="M50 96L56 98 M70 96L64 98" stroke="${a[0]}" stroke-width="1.6" stroke-linecap="round"/>
<path d="M37 82C37 64 43 52 51 53C55 54 57 58 60 58C63 58 65 54 69 53C77 52 83 64 83 82Z" fill="url(#${id}hf)" stroke="${a[0]}" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M60 58C58 66 58 74 60 80" stroke="#0c0d14" stroke-width="1.4" fill="none" opacity=".7"/>
<path d="M37.6 74H82.4V82H37.6Z" fill="${a[0]}"/>
<path d="M16 88C28 79 92 79 104 88C98 95 22 95 16 88Z" fill="url(#${id}hf)" stroke="${a[0]}" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M40 60C42 56 46 54 49 55" stroke="#fff" stroke-width="1.2" fill="none" opacity=".25" stroke-linecap="round"/>`;
  }

  function eye(id, a) {
    let rays = "";
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const r1 = 36, r2 = i % 3 === 0 ? 46 : 42;
      rays += `M${(60 + Math.cos(ang) * r1).toFixed(1)} ${(80 + Math.sin(ang) * r1).toFixed(1)}L${(60 + Math.cos(ang) * r2).toFixed(1)} ${(80 + Math.sin(ang) * r2).toFixed(1)}`;
    }
    return `
<defs>
  <radialGradient id="${id}ir" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#e6ecff"/><stop offset=".45" stop-color="${a[0]}"/><stop offset="1" stop-color="${a[1]}"/></radialGradient>
  <linearGradient id="${id}wh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6ff"/><stop offset="1" stop-color="#b9c0dc"/></linearGradient>
</defs>
<path d="${rays}" stroke="${a[0]}" stroke-width="1.6" stroke-linecap="round" opacity=".75"/>
<path d="M22 80C38 56 82 56 98 80C82 104 38 104 22 80Z" fill="url(#${id}wh)" stroke="${a[0]}" stroke-width="2" stroke-linejoin="round"/>
<circle cx="60" cy="80" r="15" fill="url(#${id}ir)"/>
<circle cx="60" cy="80" r="6.5" fill="#0d1020"/>
<circle cx="55" cy="75" r="3" fill="#fff" opacity=".9"/>
<circle cx="64.5" cy="84" r="1.3" fill="#fff" opacity=".6"/>
<path d="M22 80C38 56 82 56 98 80" fill="none" stroke="#0d1020" stroke-width="3" stroke-linecap="round" opacity=".55"/>
<path d="M54 46A9 9 0 1 0 66 46A7 7 0 1 1 54 46Z" fill="#f0d9a0" opacity=".9" transform="translate(0 -6)"/>`;
  }

  function magnifier(id, a) {
    let prints = "";
    for (let i = 0; i < 5; i++) {
      const r = 3 + i * 3.2;
      prints += `<path d="M${(53 - r).toFixed(1)} 76A${r.toFixed(1)} ${(r * 1.2).toFixed(1)} 0 0 1 ${(53 + r).toFixed(1)} 76" />`;
    }
    return `
<defs>
  <radialGradient id="${id}gl" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#dbe4ff" stop-opacity=".55"/><stop offset=".6" stop-color="${a[0]}" stop-opacity=".18"/><stop offset="1" stop-color="${a[1]}" stop-opacity=".35"/></radialGradient>
  <linearGradient id="${id}hd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b57a3c"/><stop offset="1" stop-color="#5a3412"/></linearGradient>
</defs>
<path d="M71 95L94 122" stroke="url(#${id}hd)" stroke-width="9" stroke-linecap="round"/>
<path d="M69 93L74 98" stroke="#c9ced9" stroke-width="10"/>
<circle cx="53" cy="74" r="25" fill="url(#${id}gl)"/>
<g fill="none" stroke="${a[0]}" stroke-width="1.4" stroke-linecap="round" opacity=".8" transform="translate(0 4)">${prints}<path d="M44 86C48 90 58 90 62 86"/></g>
<circle cx="53" cy="74" r="25" fill="none" stroke="#c9ced9" stroke-width="5"/>
<circle cx="53" cy="74" r="25" fill="none" stroke="#fff" stroke-width="1" opacity=".5"/>
<path d="M38 64C41 57 47 53 54 52" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".7"/>`;
  }

  function cross(id, a) {
    return `
<defs>
  <linearGradient id="${id}cr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9fbe9"/><stop offset="1" stop-color="${a[0]}"/></linearGradient>
  <linearGradient id="${id}ht" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8f87"/><stop offset="1" stop-color="#c8423d"/></linearGradient>
</defs>
<circle cx="60" cy="78" r="34" fill="none" stroke="${a[0]}" stroke-width="1.4" opacity=".55"/>
<path d="M50 46H70A3 3 0 0 1 73 49V65H89A3 3 0 0 1 92 68V88A3 3 0 0 1 89 91H73V107A3 3 0 0 1 70 110H50A3 3 0 0 1 47 107V91H31A3 3 0 0 1 28 88V68A3 3 0 0 1 31 65H47V49A3 3 0 0 1 50 46Z" fill="url(#${id}cr)" stroke="${a[1]}" stroke-width="1.5"/>
<path d="M60 92C52 86 46 81 46 75C46 70 50 67 54 67C57 67 59 69 60 71C61 69 63 67 66 67C70 67 74 70 74 75C74 81 68 86 60 92Z" fill="url(#${id}ht)" stroke="#7d2420" stroke-width="1"/>
<path d="M51 72C52 70 54 70 55 71" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".75"/>
<path d="M22 124H44L49 116L54 132L59 110L64 128L68 124H98" fill="none" stroke="${a[0]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }

  function shield(id, a) {
    return `
<defs>
  <linearGradient id="${id}sh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfe0ff"/><stop offset=".5" stop-color="${a[0]}"/><stop offset="1" stop-color="${a[1]}"/></linearGradient>
  <linearGradient id="${id}gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe2a6"/><stop offset="1" stop-color="#c98a2a"/></linearGradient>
</defs>
<path d="M60 40L95 51C95 90 84 112 60 128C36 112 25 90 25 51Z" fill="url(#${id}gd)"/>
<path d="M60 45L90 54.5C90 88 80 107 60 121.5C40 107 30 88 30 54.5Z" fill="url(#${id}sh)"/>
<path d="M60 45L90 54.5C90 88 80 107 60 121.5Z" fill="#000" opacity=".16"/>
<path d="M60 52V115 M36 74H84" stroke="#fff" stroke-width="1.2" opacity=".35"/>
<path d="M60 66L64 76L75 76.5L66.5 83L69.5 93.5L60 87.5L50.5 93.5L53.5 83L45 76.5L56 76Z" fill="url(#${id}gd)" stroke="#7a4a12" stroke-width=".8" stroke-linejoin="round"/>
<path d="M36 58L58 51" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".55"/>`;
  }

  function potions(id, a) {
    return `
<defs>
  <linearGradient id="${id}gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6f5c8"/><stop offset="1" stop-color="#2c9a64"/></linearGradient>
  <linearGradient id="${id}pu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7b8ff"/><stop offset="1" stop-color="#6a3cb0"/></linearGradient>
  <linearGradient id="${id}gs" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity=".04"/></linearGradient>
</defs>
<!-- tall poison bottle -->
<rect x="70" y="40" width="10" height="6" rx="1.5" fill="#8a5a2c"/>
<path d="M71 46H79V58L87 66V118A4 4 0 0 1 83 122H67A4 4 0 0 1 63 118V66L71 58Z" fill="url(#${id}gs)" stroke="#d9dce6" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M64.5 80C70 77 78 83 85.5 80V118A2.5 2.5 0 0 1 83 120.5H67A2.5 2.5 0 0 1 64.5 118Z" fill="url(#${id}pu)"/>
<g fill="#2a1240" opacity=".75"><circle cx="75" cy="96" r="5.5"/><rect x="72" y="100" width="6" height="4" rx="1"/></g>
<g fill="${a[0]}"><circle cx="73" cy="95.5" r="1.4"/><circle cx="77" cy="95.5" r="1.4"/></g>
<!-- round healing flask -->
<rect x="36" y="60" width="11" height="6" rx="1.5" fill="#8a5a2c"/>
<path d="M37.5 66H45.5V76C55 79 60 86 60 96C60 108 52 118 41.5 118C31 118 23 108 23 96C23 86 28 79 37.5 76Z" fill="url(#${id}gs)" stroke="#d9dce6" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M24.6 94C31 90 37 98 44 94C50 91 54 95 58.4 94C58.6 107 51 116.4 41.5 116.4C32 116.4 24.4 107 24.6 94Z" fill="url(#${id}gr)"/>
<path d="M30 84C32 80 35 78.5 37.5 78" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/>
<g fill="#e9fff2" opacity=".85"><circle cx="38" cy="104" r="1.6"/><circle cx="45" cy="99" r="1.1"/><circle cx="42" cy="86" r="1.3"/><circle cx="44" cy="54" r="1.6"/><circle cx="40" cy="47" r="1.1"/></g>
<g fill="#e7d6ff" opacity=".8"><circle cx="75" cy="72" r="1.2"/><circle cx="72" cy="34" r="1.4"/><circle cx="79" cy="28" r="1"/></g>`;
  }

  function hunterMark(id, a) {
    const arrow = (flip) => {
      const t = flip ? ' transform="translate(120 0) scale(-1 1)"' : "";
      return `<g${t}>
  <path d="M30 128L90 44" stroke="#c99a5b" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M90 44L92.5 32L84 40.5Z" fill="#d9dce6" stroke="#d9dce6" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M33 124L24 122L28 130Z M37 118L28 116L32 124Z" fill="${a[0]}"/>
</g>`;
    };
    let ticks = "";
    [0, 90, 180, 270].forEach((deg) => { ticks += `<path d="M60 52V64" transform="rotate(${deg} 60 80)"/>`; });
    return `
<defs>
  <radialGradient id="${id}tg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${a[0]}" stop-opacity=".25"/><stop offset="1" stop-color="${a[0]}" stop-opacity="0"/></radialGradient>
</defs>
${arrow(false)}${arrow(true)}
<circle cx="60" cy="80" r="30" fill="url(#${id}tg)"/>
<circle cx="60" cy="80" r="24" fill="#0d1020" fill-opacity=".55" stroke="${a[0]}" stroke-width="3"/>
<circle cx="60" cy="80" r="12" fill="none" stroke="${a[0]}" stroke-width="2"/>
<g stroke="${a[0]}" stroke-width="2.4" stroke-linecap="round">${ticks}</g>
<circle cx="60" cy="80" r="3" fill="#e0605a"/>`;
  }

  function cottage(id, a) {
    return `
<defs>
  <linearGradient id="${id}wl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b5a4a"/><stop offset="1" stop-color="#3b3027"/></linearGradient>
  <linearGradient id="${id}rf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a4b2e"/><stop offset="1" stop-color="#4f2817"/></linearGradient>
  <radialGradient id="${id}lt" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe3a0" stop-opacity=".9"/><stop offset="1" stop-color="${a[0]}" stop-opacity="0"/></radialGradient>
</defs>
<circle cx="88" cy="74" r="18" fill="url(#${id}lt)"/>
<rect x="38" y="56" width="7" height="16" fill="#3b3027"/>
<path d="M30 86H76V122H30Z" fill="url(#${id}wl)"/>
<path d="M24 88L53 60L82 88Z" fill="url(#${id}rf)" stroke="#2c160c" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M53 60L82 88H72Z" fill="#000" opacity=".18"/>
<rect x="35" y="94" width="13" height="12" rx="1" fill="#ffd27a"/>
<path d="M41.5 94V106M35 100H48" stroke="#5a3a1a" stroke-width="1.4"/>
<path d="M57 122V104A6 6 0 0 1 69 104V122Z" fill="#2a1d14"/>
<circle cx="66" cy="113" r="1" fill="${a[0]}"/>
<circle cx="53" cy="77" r="4" fill="#ffd27a"/>
<path d="M53 73V81M49 77H57" stroke="#5a3a1a" stroke-width="1"/>
<!-- lantern post -->
<path d="M92 122V62H84" stroke="#2c2f3d" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<path d="M84 62V66" stroke="#2c2f3d" stroke-width="1.2"/>
<path d="M80 68H88L87 80H81Z" fill="#ffd27a" stroke="#2c2f3d" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M79 66H89L84 63Z" fill="#2c2f3d"/>
<path d="M80 80H88" stroke="#2c2f3d" stroke-width="2"/>`;
  }

  function citizen(id, a) {
    return `
<defs>
  <linearGradient id="${id}ct" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b5a4a"/><stop offset="1" stop-color="#3b3027"/></linearGradient>
  <linearGradient id="${id}sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8c4a0"/><stop offset="1" stop-color="#c49a74"/></linearGradient>
  <linearGradient id="${id}cp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b8f9e"/><stop offset="1" stop-color="#4a4e5e"/></linearGradient>
</defs>
<path d="M28 132C30 112 42 104 60 104C78 104 90 112 92 132Z" fill="url(#${id}ct)" stroke="${a[0]}" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M50 105L60 122L70 105" fill="#e8eaf0" stroke="#e8eaf0" stroke-width="1" stroke-linejoin="round"/>
<path d="M55 110L60 118L65 110L60 107Z" fill="${a[1]}"/>
<path d="M52 104H68L64 98H56Z" fill="url(#${id}sk)"/>
<path d="M42 80C42 68 50 61 60 61C70 61 78 68 78 80C78 93 70 101 60 101C50 101 42 93 42 80Z" fill="url(#${id}sk)"/>
<circle cx="53.5" cy="83" r="1.8" fill="#2a1d14"/><circle cx="66.5" cy="83" r="1.8" fill="#2a1d14"/>
<path d="M54 92C57 94.5 63 94.5 66 92" stroke="#7a4a32" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<path d="M40 76C40 64 48 57 60 57C72 57 82 63 84 71C84 75 80 76 74 76H40Z" fill="url(#${id}cp)" stroke="#2c2f3d" stroke-width="1" stroke-linejoin="round"/>
<path d="M74 76C80 76 86 75 88 72C86 70 82 70 78 71Z" fill="#3a3e4d"/>
<circle cx="60" cy="58" r="1.6" fill="#3a3e4d"/>
<path d="M46 66C49 62 54 60 58 60" stroke="#fff" stroke-width="1.2" fill="none" opacity=".35" stroke-linecap="round"/>`;
  }

  // Mason: a stone arch being built, a trowel across it (the two Masons' shared work).
  function masonArch(id, a) {
    let bricks = "";
    const row = (y, off, n) => { for (let i = 0; i < n; i++) bricks += `<rect x="${(26 + off + i * 14).toFixed(1)}" y="${y}" width="12.6" height="7" rx="1.2"/>`; };
    row(110, 0, 5); row(102, 7, 4); row(94, 0, 2); row(94, 56, 2); row(86, 7, 1); row(86, 49, 1);
    return `
<defs>
  <linearGradient id="${id}st" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cdb89c"/><stop offset="1" stop-color="#7d6a52"/></linearGradient>
  <linearGradient id="${id}bl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9edf5"/><stop offset="1" stop-color="#8e96a8"/></linearGradient>
</defs>
<g fill="url(#${id}st)" stroke="#3b2e20" stroke-width=".8">${bricks}</g>
<path d="M40 86C40 66 48 56 60 56C72 56 80 66 80 86" fill="none" stroke="url(#${id}st)" stroke-width="9"/>
<path d="M40 86C40 66 48 56 60 56C72 56 80 66 80 86" fill="none" stroke="#3b2e20" stroke-width=".8" stroke-dasharray="7 2"/>
<path d="M56 52L64 52L62 60L58 60Z" fill="${a[0]}" stroke="#3b2e20" stroke-width=".8"/>
<g transform="rotate(-28 70 72)">
  <path d="M58 70H86L80 80H64Z" fill="url(#${id}bl)" stroke="#2c2f3d" stroke-width="1"/>
  <path d="M72 70V62" stroke="#2c2f3d" stroke-width="2"/>
  <rect x="68" y="50" width="8" height="13" rx="3" fill="${a[1]}" stroke="#2c160c" stroke-width=".8"/>
</g>`;
  }

  // Prince: a crown on a cushion.
  function crown(id, a) {
    return `
<defs>
  <linearGradient id="${id}gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset=".5" stop-color="${a[0]}"/><stop offset="1" stop-color="${a[1]}"/></linearGradient>
  <linearGradient id="${id}cu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b0485a"/><stop offset="1" stop-color="#5e1a2a"/></linearGradient>
</defs>
<path d="M26 112C26 102 40 98 60 98C80 98 94 102 94 112C94 122 80 126 60 126C40 126 26 122 26 112Z" fill="url(#${id}cu)" stroke="#3a0e18" stroke-width="1"/>
<circle cx="28" cy="112" r="3" fill="${a[0]}"/><circle cx="92" cy="112" r="3" fill="${a[0]}"/>
<path d="M36 100L32 62L48 78L60 52L72 78L88 62L84 100Z" fill="url(#${id}gd)" stroke="${a[1]}" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M36 92H84V100H36Z" fill="${a[1]}" opacity=".55"/>
<circle cx="32" cy="60" r="3.4" fill="#fff6d0"/><circle cx="60" cy="49" r="4" fill="#fff6d0"/><circle cx="88" cy="60" r="3.4" fill="#fff6d0"/>
<circle cx="60" cy="86" r="5" fill="#6ea8fe" stroke="#fff" stroke-width=".8"/>
<circle cx="45" cy="88" r="3" fill="#e0605a"/><circle cx="75" cy="88" r="3" fill="#e0605a"/>
<path d="M40 70L44 90" stroke="#fff" stroke-width="1.6" opacity=".45" stroke-linecap="round"/>`;
  }

  const EMBLEM = {
    werewolf: { wolf: wolfHead, seer: eye, doctor: cross, bodyguard: shield, witch: potions, hunter: hunterMark, mason: masonArch, prince: crown, villager: cottage },
    mafia: { wolf: fedora, seer: magnifier, doctor: cross, bodyguard: shield, witch: potions, hunter: hunterMark, mason: masonArch, prince: crown, villager: citizen },
  };

  /* ---------- card frame ---------- */

  function corner(x, y, c) {
    return `<path d="M${x} ${y - 3}L${x + 3} ${y}L${x} ${y + 3}L${x - 3} ${y}Z" fill="${c}"/>`;
  }

  function role(key, theme, size) {
    key = TEAM[key] ? key : "villager";
    theme = theme === "mafia" ? "mafia" : "werewolf";
    const id = next();
    const team = TEAM[key];
    const p = PAL[team];
    const a = ACC[key];
    const ground = theme === "mafia" ? skyline("#07080d", "#f0b354") : pines("#07080d");
    const emblem = EMBLEM[theme][key](id, a);
    return svgOpen(size, 120, 160, key) + `
<defs>
  <linearGradient id="${id}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.skyTop}"/><stop offset="1" stop-color="${p.skyBot}"/></linearGradient>
  <linearGradient id="${id}fr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.frame}"/><stop offset=".5" stop-color="${p.frame2}"/><stop offset="1" stop-color="${p.frame}"/></linearGradient>
  <radialGradient id="${id}ha" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${a[0]}" stop-opacity=".38"/><stop offset=".6" stop-color="${a[0]}" stop-opacity=".08"/><stop offset="1" stop-color="${a[0]}" stop-opacity="0"/></radialGradient>
  <clipPath id="${id}cl"><rect x="5" y="5" width="110" height="150" rx="7"/></clipPath>
</defs>
<rect x=".5" y=".5" width="119" height="159" rx="10" fill="#0f1117" stroke="url(#${id}fr)" stroke-width="1"/>
<g clip-path="url(#${id}cl)">
  <rect x="5" y="5" width="110" height="150" fill="url(#${id}bg)"/>
  ${stars(key + theme, 26, 6, 6, 108, 70, "#e8eaf0")}
  <circle cx="60" cy="80" r="50" fill="url(#${id}ha)"/>
  ${ground}
  <g>${emblem}</g>
</g>
<rect x="5" y="5" width="110" height="150" rx="7" fill="none" stroke="url(#${id}fr)" stroke-width="1.6"/>
<rect x="8.5" y="8.5" width="103" height="143" rx="5" fill="none" stroke="${p.frame}" stroke-width=".5" opacity=".45"/>
${corner(5, 5, p.orn)}${corner(115, 5, p.orn)}${corner(5, 155, p.orn)}${corner(115, 155, p.orn)}
${corner(60, 155, p.orn)}
</svg>`;
  }

  /* ---------- card back ---------- */

  function back(size) {
    const id = next();
    return svgOpen(size, 120, 160, "card back") + `
<defs>
  <linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f2a55"/><stop offset="1" stop-color="#0d1020"/></linearGradient>
  <pattern id="${id}pt" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45 60 80)">
    <path d="M0 0H12M0 0V12" stroke="#6ea8fe" stroke-width=".5" opacity=".18"/>
    <circle cx="6" cy="6" r=".7" fill="#f0b354" opacity=".35"/>
  </pattern>
  <radialGradient id="${id}mn" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff6d8"/><stop offset="1" stop-color="#f0b354"/></radialGradient>
  <radialGradient id="${id}gl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f0b354" stop-opacity=".35"/><stop offset="1" stop-color="#f0b354" stop-opacity="0"/></radialGradient>
  <mask id="${id}mk"><rect width="120" height="160" fill="#fff"/><circle cx="68" cy="72" r="17" fill="#000"/></mask>
</defs>
<rect x=".5" y=".5" width="119" height="159" rx="10" fill="url(#${id}bg)" stroke="#f0b354" stroke-width="1"/>
<rect x="6" y="6" width="108" height="148" rx="7" fill="url(#${id}pt)"/>
<rect x="6" y="6" width="108" height="148" rx="7" fill="none" stroke="#f0b354" stroke-width="1.4"/>
<rect x="10" y="10" width="100" height="140" rx="5" fill="none" stroke="#6ea8fe" stroke-width=".6" opacity=".6"/>
<circle cx="60" cy="80" r="40" fill="url(#${id}gl)"/>
<circle cx="60" cy="80" r="32" fill="#0d1020" stroke="#f0b354" stroke-width="1.2"/>
<circle cx="60" cy="80" r="27" fill="none" stroke="#6ea8fe" stroke-width=".6" stroke-dasharray="1.5 2.5" opacity=".8"/>
<circle cx="60" cy="80" r="20" fill="url(#${id}mn)" mask="url(#${id}mk)"/>
<g fill="#e8eaf0"><circle cx="72" cy="88" r=".9"/><circle cx="78" cy="78" r=".6"/><circle cx="74" cy="96" r=".5"/></g>
<g fill="#f0b354">
  <path d="M60 36L62 42L60 48L58 42Z"/><path d="M60 112L62 118L60 124L58 118Z"/>
  <path d="M16 80L22 78L28 80L22 82Z"/><path d="M92 80L98 78L104 80L98 82Z"/>
</g>
<g fill="#f0b354">${corner(6, 6, "#f0b354")}${corner(114, 6, "#f0b354")}${corner(6, 154, "#f0b354")}${corner(114, 154, "#f0b354")}</g>
</svg>`;
  }

  /* ---------- small icons ---------- */

  function moon(size) {
    const id = next();
    return svgOpen(size || 24, 24, 24, "night") + `
<defs><linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2c9"/><stop offset="1" stop-color="#f0b354"/></linearGradient></defs>
<path d="M14.5 3A9 9 0 1 0 21 15.5A7.2 7.2 0 0 1 14.5 3Z" fill="url(#${id}m)"/>
<circle cx="19" cy="5" r=".9" fill="#e8eaf0"/><circle cx="21.5" cy="9" r=".6" fill="#e8eaf0"/>
</svg>`;
  }

  function sun(size) {
    const id = next();
    let rays = "";
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      rays += `M${(12 + Math.cos(ang) * 7.5).toFixed(2)} ${(12 + Math.sin(ang) * 7.5).toFixed(2)}L${(12 + Math.cos(ang) * 10.5).toFixed(2)} ${(12 + Math.sin(ang) * 10.5).toFixed(2)}`;
    }
    return svgOpen(size || 24, 24, 24, "day") + `
<defs><radialGradient id="${id}s" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff2c9"/><stop offset="1" stop-color="#f0b354"/></radialGradient></defs>
<path d="${rays}" stroke="#f0b354" stroke-width="1.8" stroke-linecap="round"/>
<circle cx="12" cy="12" r="5.2" fill="url(#${id}s)"/>
</svg>`;
  }

  const WWArt = { role, back, moon, sun, ROLES: Object.keys(TEAM) };
  root.WWArt = WWArt;
  if (typeof module !== "undefined" && module.exports) module.exports = WWArt;
})(typeof window !== "undefined" ? window : globalThis);
