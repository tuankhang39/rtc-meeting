export const TEACH_PIP_WIDTH = 240
export const TEACH_PIP_TILE_HEIGHT = 180
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

export const TEACH_PIP_CSS = `
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    min-width: 0 !important;
    min-height: 0 !important;
    width: ${TEACH_PIP_WIDTH}px !important;
    height: auto !important;
    overflow: hidden !important;
    background: #1a1a1a;
    font-family: "Segoe UI", system-ui, sans-serif;
  }
  #teach-pip-root {
    display: block;
    width: ${TEACH_PIP_WIDTH}px;
    height: auto;
  }
  * { box-sizing: border-box; }
  *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
  .teach-pip {
    display: flex;
    flex-direction: column;
    width: ${TEACH_PIP_WIDTH}px;
    height: auto;
    background: #1a1a1a;
    overflow: hidden;
  }
  .teach-pip-stage {
    position: relative;
    width: ${TEACH_PIP_WIDTH}px;
    height: auto;
    overflow: hidden;
    background: #111;
  }
  .teach-pip-list,
  .teach-pip-empty {
    display: flex;
    flex-direction: column;
    width: ${TEACH_PIP_WIDTH}px;
    height: auto;
    background: #111;
  }
  .teach-pip-empty {
    display: grid;
    place-items: center;
    height: ${TEACH_PIP_TILE_HEIGHT}px;
    color: #bdbdbd;
    font-size: 13px;
  }
  .teach-pip-panel {
    position: absolute;
    inset: 0;
    z-index: 30;
    overflow: auto;
    padding: 8px;
    background: rgba(16, 16, 16, 0.94);
    pointer-events: auto;
  }
  .teach-strip-tile {
    position: relative;
    width: ${TEACH_PIP_WIDTH}px;
    height: ${TEACH_PIP_TILE_HEIGHT}px;
    flex: none;
    overflow: hidden;
    background: #000;
    outline: 3px solid transparent;
    outline-offset: -3px;
  }
  .teach-strip-tile.is-speaking { outline-color: #2ee56b; }
  .teach-strip-tile video {
    display: block;
    width: ${TEACH_PIP_WIDTH}px;
    height: ${TEACH_PIP_TILE_HEIGHT}px;
    object-fit: cover;
    object-position: center;
    background: #000;
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
    font-size: 2rem;
    font-weight: 700;
    color: #d0d0d0;
    background: #2b2b2b;
  }
  .teach-strip-meta {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 8px;
    padding: 20px 8px 8px;
    background: linear-gradient(transparent, rgba(0,0,0,.78));
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    pointer-events: none;
  }
  .teach-strip-meta-left {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .teach-strip-name {
    overflow: hidden;
    max-width: 150px;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-shadow: 0 1px 2px #000;
  }
  .teach-strip-stars {
    color: #efbf5a;
    font-size: 13px;
    text-shadow: 0 1px 2px #000;
  }
  .teach-strip-meta-right {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    pointer-events: auto;
  }
  .teach-strip-mute {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 999px;
    color: #fff;
    background: #e53935;
    pointer-events: none;
  }
  .teach-strip-star-btn {
    margin: 0;
    padding: 0;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 999px;
    background: rgba(0,0,0,.55);
    color: #efbf5a;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
  }
  .teach-strip-star-btn:hover { background: rgba(196, 138, 34, .9); color: #fff; }
  .teach-pip-dock {
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
    padding: 8px;
    width: ${TEACH_PIP_WIDTH}px;
    background: #242424;
    border-bottom: 1px solid #333;
  }
  .teach-pip-dock button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    margin: 0;
    padding: 8px 4px;
    border: none;
    border-radius: 10px;
    background: #3a3a3a;
    color: #f2f2f2;
    font: 700 10px/1.1 "Segoe UI", system-ui, sans-serif;
    cursor: pointer;
  }
  .teach-pip-dock button:hover { background: #4a4a4a; }
  .teach-pip-dock button.off,
  .teach-pip-dock button.stop { background: #c0392b; color: #fff; }
  .teach-pip-dock button.on { background: #4a6d8c; color: #fff; }
  .teach-pip-dock button svg { display: block; }
  .teach-pip-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin: 0 0 6px;
    padding: 8px 10px;
    border: none;
    border-radius: 10px;
    background: #333;
    color: #f2f2f2;
    font: 600 12px/1.3 "Segoe UI", system-ui, sans-serif;
    text-align: left;
    cursor: pointer;
  }
  .teach-pip-chip:hover { background: #444; }
`
