// SVG icon components
/* ============================================================
   ICONS
   ============================================================ */
const Ic = {
  tower:(p)=>h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,...p},
    h('path',{d:'M12 2v20M7 7l10 10M17 7L7 17M5 22h14'})),
  map:(p)=>h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,...p},
    h('path',{d:'M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2zM9 3v16M15 5v16'})),
  notam:(p)=>h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,...p},
    h('path',{d:'M12 2 2 20h20L12 2zM12 9v5M12 17h.01'})),
  log:(p)=>h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,...p},
    h('path',{d:'M4 4h16v16H4zM8 9h8M8 13h8M8 17h5'})),
  brief:(p)=>h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,...p},
    h('path',{d:'M4 6h16v12H4zM4 10h16M9 6V4h6v2'})),
  search:(p)=>h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,...p},
    h('circle',{cx:11,cy:11,r:7}),h('path',{d:'m21 21-4.3-4.3'})),
  users:(p)=>h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,...p},
    h('path',{d:'M16 19v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 19v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11'})),
  cfg:(p)=>h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,...p},
    h('path',{d:'M4 6h9M19 6h1M4 12h1M11 12h9M4 18h5M15 18h5'}),
    h('circle',{cx:16,cy:6,r:2}),h('circle',{cx:8,cy:12,r:2}),h('circle',{cx:12,cy:18,r:2})),
  book:(p)=>h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,...p},
    h('path',{d:'M4 4h11a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V4zM17 6h3v12a2 2 0 0 1-2 2M8 8h6M8 12h6'})),
  rot:(p)=>h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,...p},
    h('path',{d:'M20 11a8 8 0 1 0-.9 4M20 5v4h-4'})),
  dash:(p)=>h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,...p},
    h('path',{d:'M3 3v18h18M7 16v2M11.5 11v7M16 13v5M20.5 7v11'})),
};

const GLYPH = h('svg',{className:'glyph',viewBox:'0 0 48 48',fill:'none'},
  h('circle',{cx:24,cy:24,r:21,stroke:'var(--phos)',strokeWidth:1.5,opacity:.4}),
  h('circle',{cx:24,cy:24,r:13,stroke:'var(--phos)',strokeWidth:1.5,opacity:.6}),
  h('path',{d:'M24 3v42M3 24h42',stroke:'var(--phos)',strokeWidth:1,opacity:.35}),
  h('path',{d:'M24 24 38 13',stroke:'var(--phos)',strokeWidth:2.2,strokeLinecap:'round'}),
  h('circle',{cx:24,cy:24,r:2.5,fill:'var(--phos)'}));
