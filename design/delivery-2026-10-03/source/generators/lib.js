// Moracat asset generator library. Evaluated inside the project's script runner:
//   const M = await (new Function('env', await readFile('moracat-design-delivery/source/generators/lib.js')))({readFile, readFileBinary, createCanvas});
return (async ({ readFile, readFileBinary, createCanvas }) => {
  const C = { emerald:'#045D48', paper:'#FBF8F4', ink:'#0B1E19', copper:'#B6542B', orange:'#F86C30', red:'#B42318',
    cream:'#F7E6D4', butter:'#FBEABC', blush:'#FFB8B9', sage:'#7E9EA9', white:'#FFFFFF',
    walletBg:'rgb(4,91,70)', walletText:'rgb(250,247,242)', walletLabel:'rgb(201,230,214)' };
  const LP = JSON.parse(await readFile('moracat-design-delivery/source/generators/logo-paths.json'));
  const f = v => Math.round(v * 100) / 100;

  // ---------- logo geometry (units = original 409px artwork) ----------
  const HS = 0.84, GAP = 54; // horizontal lockup: arabic scale + gap
  const lockups = {
    stacked: () => ({ d: [{ d: LP.ar }, { d: LP.la }], vb: [0, 0, 408.5, 258.1] }),
    horizontal: () => {
      const tx = 408.5 + GAP - LP.bb.ar[0] * HS, ty = LP.laBaseline - LP.arBaseline * HS;
      const y0 = Math.min(ty + LP.bb.ar[1] * HS, LP.bb.la[1]), y1 = Math.max(ty + LP.bb.ar[3] * HS, LP.bb.la[3]);
      return { d: [{ d: LP.la }, { d: LP.ar, t: `translate(${f(tx)} ${f(ty)}) scale(${HS})` }],
        vb: [0, f(y0), f(408.5 + GAP + (LP.bb.ar[2] - LP.bb.ar[0]) * HS), f(y1 - y0)] };
    },
    arabic: () => ({ d: [{ d: LP.ar }], vb: [LP.bb.ar[0], LP.bb.ar[1], f(LP.bb.ar[2] - LP.bb.ar[0]), f(LP.bb.ar[3] - LP.bb.ar[1])] }),
    symbol: () => ({ d: [{ d: LP.sym }], vb: [LP.bb.sym[0], LP.bb.sym[1], f(LP.bb.sym[2] - LP.bb.sym[0]), f(LP.bb.sym[3] - LP.bb.sym[1])] }),
  };
  // returns <g> markup of a lockup fitted into box (x,y,w,h), centered
  function logoG(kind, color, x, y, w, h, align = 'center') {
    const L = lockups[kind](); const [vx, vy, vw, vh] = L.vb; const s = Math.min(w / vw, h / vh);
    const ox = align === 'left' ? x : align === 'right' ? x + w - vw * s : x + (w - vw * s) / 2;
    const oy = y + (h - vh * s) / 2;
    return `<g fill="${color}" fill-rule="evenodd" transform="translate(${f(ox - vx * s)} ${f(oy - vy * s)}) scale(${f(s * 10000) / 10000})">` +
      L.d.map(p => `<path${p.t ? ` transform="${p.t}"` : ''} d="${p.d}"/>`).join('') + '</g>';
  }
  function logoSVG(kind, color) {
    const L = lockups[kind](); const [vx, vy, vw, vh] = L.vb;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}"><title>Moracat</title><g fill="${color}" fill-rule="evenodd">` +
      L.d.map(p => `<path${p.t ? ` transform="${p.t}"` : ''} d="${p.d}"/>`).join('') + '</g></svg>';
  }
  const aspect = kind => { const v = lockups[kind]().vb; return v[2] / v[3]; };

  // ---------- raster ----------
  async function raster(svg, w, h, bg) {
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
    const c = createCanvas(w, h); const x = c.getContext('2d');
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
    x.drawImage(img, 0, 0, w, h); return c;
  }
  async function toBlob(c, type = 'image/png', q) { return c.convertToBlob ? c.convertToBlob({ type, quality: q }) : c; }

  // ---------- fonts (outlined text) ----------
  let OT = null; const FONTS = {};
  const FURL = {
    lyon: 'LOCAL:_ds/moracat-design-system-ae06fdb9-c46b-4b7a-bb9c-6d8d90f0e3e5/assets/fonts/lyon-arabic-display-regular.otf',
    plexAr400: 'https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-sans-arabic@5/files/ibm-plex-sans-arabic-arabic-400-normal.woff',
    plexAr700: 'https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-sans-arabic@5/files/ibm-plex-sans-arabic-arabic-700-normal.woff',
    fraunces500: 'https://cdn.jsdelivr.net/npm/@fontsource/fraunces@5/files/fraunces-latin-500-normal.woff',
    fraunces600: 'https://cdn.jsdelivr.net/npm/@fontsource/fraunces@5/files/fraunces-latin-600-normal.woff',
    fraunces500i: 'https://cdn.jsdelivr.net/npm/@fontsource/fraunces@5/files/fraunces-latin-500-italic.woff',
    inter400: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-400-normal.woff',
    inter600: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-600-normal.woff',
    inter700: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-700-normal.woff',
    mono400: 'https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono@5/files/ibm-plex-mono-latin-400-normal.woff',
    mono500: 'https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono@5/files/ibm-plex-mono-latin-500-normal.woff',
  };
  async function font(k) {
    if (FONTS[k]) return FONTS[k];
    if (!OT) { const m = await import('https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/+esm'); OT = m.default || m; }
    const u = FURL[k]; let buf;
    if (u.startsWith('LOCAL:')) buf = await (await readFileBinary(u.slice(6))).arrayBuffer();
    else buf = await (await fetch(u)).arrayBuffer();
    return (FONTS[k] = OT.parse(buf));
  }
  // text → path d. align: 'start'|'end'|'center' measured in visual LTR coords (left/right/center)
  async function text(k, str, size, x, y, align = 'left', opts = {}) {
    const F = await font(k); const tr = opts.tracking || 0;
    if (!tr) {
      const w = F.getAdvanceWidth(str, size, { kerning: true });
      const ox = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
      return { d: F.getPath(str, ox, y, size, { kerning: true }).toPathData(2), w };
    }
    // tracking (Latin/mono only — never Arabic)
    const chars = [...str]; let w = 0; const ws = chars.map(ch => F.getAdvanceWidth(ch, size));
    w = ws.reduce((a, b) => a + b, 0) + tr * size * (chars.length - 1);
    let cx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x; let d = '';
    chars.forEach((ch, i) => { d += F.getPath(ch, cx, y, size).toPathData(2); cx += ws[i] + tr * size; });
    return { d, w };
  }
  async function textG(k, str, size, x, y, fill, align = 'left', opts = {}) {
    const t = await text(k, str, size, x, y, align, opts); return `<path fill="${fill}" d="${t.d}"/>`;
  }

  // ---------- favicon 16px hand-tuned pixel map (E emerald, P paper, . transparent) ----------
  const FAV16 = [
    '..EEEEEEEEEEEE..',
    '.EEEEEEEEEEEEEE.',
    'EEEEEEPEEEPEEEEE',
    'EEEEEPPEEPPEEEEE',
    'EEEEEPPEEPPEEEEE',
    'EEEEEEEEEEEEEEEE',
    'EEEEEEPPPPEEEEEE',
    'EEEEEPPPPPPEEEEE',
    'EEEEEPPEEPPEEEEE',
    'EEEEEPPEEPPEEEEE',
    'EEEEPPPPPPPEEEEE',
    'EEEEPPPPPPPEEEEE',
    'EEEEPPPPPPEEEEEE',
    'EEEEEEEEEEEEEEEE',
    '.EEEEEEEEEEEEEE.',
    '..EEEEEEEEEEEE..',
  ];
  function pixelCanvas(map, colors) {
    const n = map.length; const c = createCanvas(n, n); const x = c.getContext('2d');
    map.forEach((row, j) => [...row].forEach((ch, i) => { if (colors[ch]) { x.fillStyle = colors[ch]; x.fillRect(i, j, 1, 1); } }));
    return c;
  }
  async function pngBytes(c) { return new Uint8Array(await (await toBlob(c)).arrayBuffer()); }
  function ico(pngs) { // pngs: [{size, bytes}]
    const head = 6 + 16 * pngs.length; let total = head + pngs.reduce((a, p) => a + p.bytes.length, 0);
    const b = new Uint8Array(total); const dv = new DataView(b.buffer);
    dv.setUint16(0, 0, true); dv.setUint16(2, 1, true); dv.setUint16(4, pngs.length, true);
    let off = head; pngs.forEach((p, i) => { const e = 6 + 16 * i; b[e] = p.size >= 256 ? 0 : p.size; b[e + 1] = p.size >= 256 ? 0 : p.size; b[e + 2] = 0; b[e + 3] = 0;
      dv.setUint16(e + 4, 1, true); dv.setUint16(e + 6, 32, true); dv.setUint32(e + 8, p.bytes.length, true); dv.setUint32(e + 12, off, true); b.set(p.bytes, off); off += p.bytes.length; });
    return new Blob([b], { type: 'image/x-icon' });
  }
  // copper register seal: double ring, perforated inner ring, mono ring text, ق symbol at centre
  async function sealG(cx, cy, r, color = C.copper, ringText = 'MORACAT · THE REGISTER · MORACAT · THE REGISTER · ', opts = {}) {
    const F = await font('mono500'); const size = r * 0.13; const rt = r * 0.74;
    let s = `<g fill="none" stroke="${color}"><circle cx="${cx}" cy="${cy}" r="${r - r * 0.03}" stroke-width="${r * 0.05}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.58}" stroke-width="${r * 0.025}" stroke-dasharray="${r * 0.05} ${r * 0.04}"/></g>`;
    const txt = ringText; const chars = [...txt];
    const adv = chars.map(ch => F.getAdvanceWidth(ch, size) * 1.05); const tot = adv.reduce((a, b) => a + b, 0);
    const scale = (2 * Math.PI * rt) / tot; let a = -Math.PI / 2; let d = '';
    chars.forEach((ch, i) => { const w = adv[i] * scale; const mid = a + (w / 2) / rt;
      const x = cx + rt * Math.cos(mid), y = cy + rt * Math.sin(mid);
      const p = F.getPath(ch, 0, 0, size); const gw = F.getAdvanceWidth(ch, size);
      const cmds = p.commands; const rot = mid + Math.PI / 2;
      const tf = (px, py) => { px -= gw / 2; py += size * 0.36; return [x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot)]; };
      for (const c of cmds) { if (c.type === 'M' || c.type === 'L') { const [X, Y] = tf(c.x, c.y); d += c.type + f(X) + ' ' + f(Y); }
        else if (c.type === 'Q') { const [X1, Y1] = tf(c.x1, c.y1), [X, Y] = tf(c.x, c.y); d += `Q${f(X1)} ${f(Y1)} ${f(X)} ${f(Y)}`; }
        else if (c.type === 'C') { const [X1, Y1] = tf(c.x1, c.y1), [X2, Y2] = tf(c.x2, c.y2), [X, Y] = tf(c.x, c.y); d += `C${f(X1)} ${f(Y1)} ${f(X2)} ${f(Y2)} ${f(X)} ${f(Y)}`; }
        else if (c.type === 'Z') d += 'Z'; }
      a += w / rt; });
    s += `<path fill="${color}" d="${d}"/>`;
    s += logoG('symbol', color, cx - r * 0.4, cy - r * 0.4, r * 0.8, r * 0.8);
    return `<g>${s}</g>`;
  }
  const grain = (id = 'grain', op = 0.06) => `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${op} 0"/></filter>`;
  return { C, LP, lockups, logoG, logoSVG, aspect, raster, toBlob, font, text, textG, FAV16, pixelCanvas, pngBytes, ico, grain, f, sealG };
})(env);
