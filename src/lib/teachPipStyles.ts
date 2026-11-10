import { BEAR_KINDS, bearPalette } from './bearArt'

export const TEACH_PIP_WIDTH = 240
/** Chiều cao gợi ý mỗi ô lúc mở; sau đó tile giãn theo cửa sổ user kéo. */
export const TEACH_PIP_TILE_HEIGHT = 180
export const TEACH_PIP_TILE_MIN_HEIGHT = 120
export const TEACH_PIP_DOCK_HEIGHT = 72
export const TEACH_PIP_DOCK_HOST_HEIGHT = 118

export function teachPipSize(peopleCount = 1, isHost = false) {
  const n = Math.max(1, peopleCount)
  const dock = isHost ? TEACH_PIP_DOCK_HOST_HEIGHT : TEACH_PIP_DOCK_HEIGHT
  return {
    width: TEACH_PIP_WIDTH,
    height: dock + TEACH_PIP_TILE_HEIGHT * n,
  }
}

/** Nền avatar pastel riêng cho từng kiểu gấu. */
const BEAR_AVATAR_CSS = BEAR_KINDS.map((kind) => {
  const [a, b] = bearPalette(kind).bg
  return `.teach-strip-tile.bear-${kind} .teach-strip-avatar { background: radial-gradient(circle at 50% 38%, ${a} 0%, ${b} 100%); }`
}).join('\n  ')

const FONT = `"Nunito", "Segoe UI Rounded", "Segoe UI", system-ui, sans-serif`

export const TEACH_PIP_CSS = `
  :root {
    --bp-cream: #fdf3f7;
    --bp-cream-2: #f8e1ea;
    --bp-ink: #4a3040;
    --bp-ink-soft: #8f6a7c;
    --bp-accent: #d889a6;
    --bp-accent-deep: #b56b88;
    --bp-speak: #e8578a;
    --bp-coral: #e5738f;
    --bp-gold: #f2bf4f;
    --bp-line: rgba(150, 80, 110, .14);
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    min-width: 0 !important;
    min-height: 0 !important;
    width: 100% !important;
    height: 100% !important;
    overflow: hidden !important;
    background: var(--bp-cream);
    color: var(--bp-ink);
    font-family: ${FONT};
  }
  #teach-pip-root { display: block; width: 100%; height: 100%; }
  * { box-sizing: border-box; }
  *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }

  .teach-pip {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: var(--bp-cream);
    background-size: 200px 200px;
    background-repeat: repeat;
  }

  /* ---------- Dock ---------- */
  .teach-pip-dock {
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    padding: 8px 8px 6px;
    width: 100%;
    background: linear-gradient(180deg, rgba(248, 225, 234, .96), rgba(253, 243, 247, .9));
    border-bottom: 1px solid var(--bp-line);
    backdrop-filter: blur(4px);
  }
  .teach-pip-dock button {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    margin: 0;
    padding: 6px 4px 5px;
    border: none;
    border-radius: 16px;
    background: #fff;
    color: var(--bp-ink);
    font: 800 10.5px/1.1 ${FONT};
    letter-spacing: .01em;
    cursor: pointer;
    box-shadow: 0 2px 0 rgba(150, 80, 110, .16), 0 0 0 1px var(--bp-line) inset;
    transition: transform .12s ease, box-shadow .12s ease, background .15s ease;
  }
  .teach-pip-dock button:hover { transform: translateY(-1px); box-shadow: 0 3px 0 rgba(150, 80, 110, .18), 0 0 0 1px var(--bp-line) inset; }
  .teach-pip-dock button:active { transform: translateY(1px); box-shadow: 0 1px 0 rgba(150, 80, 110, .16), 0 0 0 1px var(--bp-line) inset; }
  .teach-pip-dock button:focus-visible { outline: 2px solid var(--bp-accent); outline-offset: 2px; }
  .teach-pip-dock-ico {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 999px;
    background: var(--bp-cream-2);
    color: var(--bp-ink);
  }
  .teach-pip-dock-ico svg { display: block; }
  .teach-pip-dock button.is-on .teach-pip-dock-ico { background: #fbe3ec; color: #c0577f; }
  .teach-pip-dock button.off { background: #fdecef; color: #c04a68; }
  .teach-pip-dock button.off .teach-pip-dock-ico { background: var(--bp-coral); color: #fff; }
  .teach-pip-dock button.stop { background: var(--bp-coral); color: #fff; box-shadow: 0 2px 0 #b9526d; }
  .teach-pip-dock button.stop .teach-pip-dock-ico { background: rgba(255, 255, 255, .22); color: #fff; }
  .teach-pip-dock button.stop:hover { background: #de6282; box-shadow: 0 3px 0 #b9526d; }
  .teach-pip-dock button.wide {
    grid-column: 1 / -1;
    flex-direction: row;
    gap: 8px;
    padding: 4px 10px;
    font-size: 11.5px;
  }
  .teach-pip-dock button.wide .teach-pip-dock-ico { width: 26px; height: 26px; background: #fde7ef; color: var(--bp-accent-deep); }
  .teach-pip-dock button.on { background: var(--bp-accent); color: #fff; box-shadow: 0 2px 0 var(--bp-accent-deep); }
  .teach-pip-dock button.on .teach-pip-dock-ico { background: rgba(255, 255, 255, .28); color: #fff; }

  /* ---------- Stage ---------- */
  .teach-pip-stage {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    overflow: hidden;
  }
  .teach-pip-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 6px;
    overflow-x: hidden;
    overflow-y: auto;
  }
  .teach-pip-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    height: 100%;
    min-height: ${TEACH_PIP_TILE_MIN_HEIGHT}px;
    color: var(--bp-ink-soft);
    font-size: 13px;
    font-weight: 800;
  }
  .teach-pip-empty-bear {
    display: block;
    line-height: 0;
    animation: bp-bob 2.6s ease-in-out infinite;
    filter: drop-shadow(0 4px 6px rgba(150, 80, 110, .18));
  }
  @keyframes bp-bob {
    0%, 100% { transform: translateY(0) rotate(-3deg); }
    50% { transform: translateY(-4px) rotate(3deg); }
  }

  /* ---------- Tile ---------- */
  .teach-strip-tile {
    position: relative;
    width: 100%;
    flex: 1 1 0;
    min-height: ${TEACH_PIP_TILE_MIN_HEIGHT}px;
    overflow: hidden;
    border-radius: 16px;
    background: #3a2a34;
    box-shadow: 0 0 0 2px #fff, 0 3px 8px rgba(150, 80, 110, .22);
    transition: box-shadow .2s ease;
  }
  .teach-strip-tile.is-speaking { box-shadow: 0 0 0 3px var(--bp-speak), 0 0 14px rgba(232, 87, 138, .5); }
  .teach-strip-tile.is-pinned { order: -1; box-shadow: 0 0 0 3px var(--bp-accent), 0 3px 10px rgba(216, 137, 166, .45); }
  .teach-strip-tile.is-pinned.is-speaking { box-shadow: 0 0 0 3px var(--bp-speak), 0 0 0 5px var(--bp-accent); }

  .teach-strip-tile video {
    display: block;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    background: #3a2a34;
    pointer-events: none;
  }
  .teach-strip-tile video.mirror { transform: scaleX(-1); }
  .teach-strip-tile.cam-off video { opacity: 0; }
  video::-webkit-media-controls,
  video::-webkit-media-controls-enclosure,
  video::-webkit-media-controls-panel {
    display: none !important;
    opacity: 0 !important;
  }

  .teach-strip-avatar {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding-bottom: 18px;
  }
  .teach-strip-bear {
    position: relative;
    display: block;
    line-height: 0;
    filter: drop-shadow(0 4px 6px rgba(150, 80, 110, .22));
  }
  .teach-strip-initial {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(16px, 4px);
    display: grid;
    place-items: center;
    min-width: 22px;
    height: 22px;
    padding: 0 5px;
    border-radius: 999px;
    background: #fff;
    color: var(--bp-ink);
    font-size: 11px;
    font-weight: 900;
    box-shadow: 0 2px 4px rgba(150, 80, 110, .25);
  }
  .teach-strip-tile.is-speaking .teach-strip-bear { animation: bp-talk .5s ease-in-out infinite alternate; }
  @keyframes bp-talk {
    from { transform: scale(1); }
    to { transform: scale(1.06) rotate(-2deg); }
  }
  ${BEAR_AVATAR_CSS}

  .teach-strip-badges {
    position: absolute;
    top: 6px;
    left: 6px;
    z-index: 2;
    display: flex;
    gap: 4px;
    pointer-events: none;
  }
  .teach-strip-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 7px 2px 5px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
    box-shadow: 0 1px 3px rgba(0, 0, 0, .25);
  }
  .teach-strip-badge.pin { background: var(--bp-accent); color: #fff; }
  .teach-strip-badge.host { background: #fff; color: var(--bp-accent-deep); }
  .teach-strip-badge.host svg { color: var(--bp-gold); }

  .teach-strip-meta {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 6px;
    padding: 22px 7px 7px;
    background: linear-gradient(transparent, rgba(74, 48, 64, .66));
    color: #fff;
    font-size: 12px;
    font-weight: 800;
    pointer-events: none;
  }
  .teach-strip-tile.cam-off .teach-strip-meta { background: linear-gradient(transparent, rgba(150, 80, 110, .42)); }
  .teach-strip-meta-left {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
  }
  .teach-strip-name {
    overflow: hidden;
    max-width: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-shadow: 0 1px 2px rgba(0, 0, 0, .6);
  }
  .teach-strip-stars {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 7px 1px 4px;
    border-radius: 999px;
    background: rgba(253, 243, 247, .95);
    color: var(--bp-accent-deep);
    font-size: 11px;
    font-weight: 900;
  }
  .teach-strip-stars svg { color: var(--bp-gold); }
  .teach-strip-meta-right {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 5px;
    pointer-events: auto;
  }
  .teach-strip-mute {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    color: #fff;
    background: var(--bp-coral);
    box-shadow: 0 0 0 2px rgba(255, 255, 255, .85);
    pointer-events: none;
  }
  .teach-strip-star-group {
    display: flex;
    padding: 2px;
    gap: 2px;
    border-radius: 999px;
    background: rgba(253, 243, 247, .95);
    box-shadow: 0 1px 4px rgba(0, 0, 0, .25);
  }
  .teach-strip-star-btn {
    display: grid;
    place-items: center;
    margin: 0;
    padding: 0;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 999px;
    cursor: pointer;
    transition: transform .1s ease, background .15s ease;
  }
  .teach-strip-star-btn.give { background: var(--bp-accent); color: #fff; }
  .teach-strip-star-btn.give:hover { background: var(--bp-accent-deep); transform: scale(1.08); }
  .teach-strip-star-btn.take { background: transparent; color: #c04a68; }
  .teach-strip-star-btn.take:hover { background: #fbdfe6; }
  .teach-strip-star-btn:disabled { opacity: .35; cursor: not-allowed; transform: none; background: transparent; }

  /* ---------- Quick panel ---------- */
  .teach-pip-panel {
    position: absolute;
    inset: 0;
    z-index: 30;
    overflow: auto;
    padding: 8px;
    background: rgba(253, 243, 247, .95);
    backdrop-filter: blur(6px);
    pointer-events: auto;
  }
  .teach-pip-panel-head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 2px 2px 8px;
    color: var(--bp-accent-deep);
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .06em;
  }
  .teach-pip-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin: 0 0 6px;
    padding: 6px 10px 6px 6px;
    border: none;
    border-radius: 14px;
    background: #fff;
    color: var(--bp-ink);
    font: 700 12px/1.3 ${FONT};
    text-align: left;
    cursor: pointer;
    box-shadow: 0 1px 0 rgba(150, 80, 110, .14), 0 0 0 1px var(--bp-line) inset;
    transition: background .15s ease, transform .1s ease;
  }
  .teach-pip-chip:hover { background: #fde7ef; transform: translateX(2px); }
  .teach-pip-chip-emoji {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 26px;
    height: 26px;
    border-radius: 999px;
    background: var(--bp-cream-2);
    font-size: 14px;
  }
  @media (prefers-reduced-motion: reduce) {
    .teach-pip-empty-bear, .teach-strip-tile.is-speaking .teach-strip-bear { animation: none; }
  }
`
