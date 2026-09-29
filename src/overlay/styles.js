/** The tools' own styles. They live in a shadow root, so the page cannot reach them and they cannot reach the page. */
export const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; font-family: ui-sans-serif, -apple-system, system-ui, sans-serif; }
[hidden] { display: none !important; }
.ring { position: fixed; border: 2px solid #1e3fd8; border-radius: 4px; background: rgba(30,63,216,.08);
        pointer-events: none; transition: all 60ms ease; }
.mark { position: fixed; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%; background: #1e3fd8;
        border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.35); pointer-events: none; }
.pin { position: fixed; width: 20px; height: 20px; border-radius: 50%; background: #1e3fd8; color: #fff;
       font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;
       pointer-events: auto; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,.3); }

/* The dock: the cursor alone, or the cursor at the end of a toolbar. */
.dock { position: fixed; right: 18px; bottom: 18px; pointer-events: auto; display: flex; align-items: center;
        gap: 2px; padding: 4px; border-radius: 14px; background: rgba(255,255,255,.78);
        border: 1px solid rgba(23,18,15,.09); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
        box-shadow: 0 8px 28px rgba(23,18,15,.14); }
.dock button { position: relative; border: 0; background: transparent; color: rgba(23,18,15,.62);
               width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center;
               justify-content: center; cursor: pointer; transition: background 120ms ease, color 120ms ease; }
.dock button:hover { background: rgba(23,18,15,.07); color: #17120f; }
.dock button[data-on="true"] { background: rgba(30,63,216,.14); color: #1731a8; }
.dock button svg { width: 18px; height: 18px; display: block; }
.dock .pixel { width: 15px; height: 24px; image-rendering: pixelated; }
.dock .sep { width: 1px; height: 20px; background: rgba(23,18,15,.12); margin: 0 4px; }
.dock .count { font-size: 12px; font-weight: 600; color: rgba(23,18,15,.6); padding: 0 6px; white-space: nowrap; }
.dock .bubble { position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px; padding: 0 4px;
                border-radius: 8px; background: #1e3fd8; color: #fff; font-size: 10px; font-weight: 700;
                display: flex; align-items: center; justify-content: center; }
.dock .hint { font-size: 12px; font-weight: 600; color: #1731a8; padding: 0 8px; white-space: nowrap; }

.build { position: fixed; right: 18px; bottom: 70px; pointer-events: auto;
         padding: 12px 22px; border: 0; border-radius: 13px; background: #17120f; color: #fff;
         font-size: 13.5px; font-weight: 600; cursor: pointer;
         box-shadow: 0 10px 32px rgba(23,18,15,.3); transition: background 120ms ease, transform 120ms ease; }
.build:hover { background: #000; transform: translateY(-1px); }
.build:disabled { background: rgba(23,18,15,.5); cursor: default; transform: none; }

/* The card beside a selected element: note on top, the tool's options below. */
.card { position: fixed; width: 280px; pointer-events: auto; background: #fff; border-radius: 14px;
        box-shadow: 0 18px 48px rgba(23,18,15,.22), 0 0 0 1px rgba(23,18,15,.06);
        font-size: 12px; color: #17120f; overflow: hidden; }
.card-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px 0; cursor: grab;
             user-select: none; touch-action: none; }
.card-head:active { cursor: grabbing; }
/* The tools, above whatever the card is showing: note or a tool's controls. */
.shelf { display: flex; gap: 2px; margin: 8px 12px 0; padding: 2px; background: rgba(23,18,15,.06); border-radius: 10px; }
.shelf button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; border: 0;
                background: transparent; border-radius: 8px; padding: 5px 0 4px; font-size: 10.5px; font-weight: 600;
                color: rgba(23,18,15,.55); cursor: pointer; transition: background 120ms ease, color 120ms ease; }
.shelf button:hover { color: #17120f; }
.shelf button[data-on="true"] { background: #fff; color: #17120f; box-shadow: 0 1px 3px rgba(23,18,15,.15); }
.shelf svg { width: 16px; height: 16px; display: block; }
.card-head b { flex: 1; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-head .x { border: 0; background: transparent; color: rgba(23,18,15,.45); padding: 4px 6px;
                border-radius: 7px; font-size: 13px; cursor: pointer; }
.card-head .x:hover { background: rgba(23,18,15,.07); color: #17120f; }
.section { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 10px; }
.section + .section { border-top: 1px solid rgba(23,18,15,.08); }
.note textarea { width: 100%; min-height: 64px; resize: vertical; border: 1px solid #e2dfdc; border-radius: 9px;
                 padding: 8px 10px; font-size: 13px; color: #17120f; line-height: 1.4; }
.note textarea:focus { outline: none; border-color: #1e3fd8; }
.changes { color: rgba(23,18,15,.6); font: 11px/1.5 ui-monospace, SFMono-Regular, monospace; }
.row { display: flex; gap: 6px; align-items: center; }
.row > * { min-width: 0; }
.btn { border: 0; background: rgba(23,18,15,.06); color: inherit; border-radius: 8px; padding: 7px 10px;
       font-size: 12px; font-weight: 600; cursor: pointer; transition: background 120ms ease; }
.btn:hover { background: rgba(23,18,15,.12); }
.btn.wide { flex: 1; }
.btn.dark { background: #17120f; color: #fff; }
.btn.dark:hover { background: #000; }
.label { display: flex; justify-content: space-between; color: rgba(23,18,15,.55); font-size: 11px; margin-bottom: 5px; }
.seg { display: flex; gap: 2px; padding: 2px; background: rgba(23,18,15,.06); border-radius: 9px; }
.seg button { flex: 1; border: 0; background: transparent; border-radius: 7px; padding: 5px 0;
              font-size: 11.5px; font-weight: 600; color: rgba(23,18,15,.6); cursor: pointer; }
.seg button[data-on="true"] { background: #fff; color: #17120f; box-shadow: 0 1px 3px rgba(23,18,15,.15); }
.num { width: 64px; border: 1px solid #e2dfdc; border-radius: 8px; padding: 6px 8px; text-align: right;
       font: 12px ui-monospace, SFMono-Regular, monospace; color: #17120f; }
.num:focus, .value:focus { outline: none; border-color: #1e3fd8; }
.area { position: relative; height: 150px; border-radius: 9px; cursor: crosshair; touch-action: none; }
.knob { position: absolute; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%;
        border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.35), 0 2px 6px rgba(0,0,0,.3); pointer-events: none; }
.slider { position: relative; flex: 1; height: 14px; border-radius: 7px; cursor: pointer; touch-action: none;
          background: rgba(23,18,15,.08); }
.slider .knob { top: 50%; }
.slider .track { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 7px; background: #1e3fd8; opacity: .85; }
.check { background-image: linear-gradient(45deg,#ddd 25%,transparent 25%),linear-gradient(-45deg,#ddd 25%,transparent 25%),
         linear-gradient(45deg,transparent 75%,#ddd 75%),linear-gradient(-45deg,transparent 75%,#ddd 75%);
         background-size: 8px 8px; background-position: 0 0,0 4px,4px -4px,-4px 0; }
.swatch { width: 28px; height: 28px; border-radius: 8px; flex: none; box-shadow: inset 0 0 0 1px rgba(0,0,0,.1); }
.value { flex: 1; border: 1px solid #e2dfdc; border-radius: 8px; padding: 6px 8px;
         font: 12px ui-monospace, SFMono-Regular, monospace; color: #17120f; }
`;
