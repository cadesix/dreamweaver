/** The tools, their shortcuts, and how they are drawn. */

export const TOOLS = [
	{ id: "note", label: "Note", key: "a" },
	{ id: "color", label: "Color", key: "c" },
	{ id: "text", label: "Text", key: "t" },
	{ id: "radius", label: "Corners", key: "r" },
];
/* ⌥ letters on a Mac keyboard type these instead of the letter. */
export const OPTION_KEYS = { "å": "a", "ç": "c", "†": "t", "®": "r", "˙": "h" };

/** Lucide-style glyphs (ISC), drawn at 18px. */
export const ICONS = {
	note: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
	color:
		'<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>',
	text: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
	radius: '<path d="M4 20V11a7 7 0 0 1 7-7h9"/>',
};
export const icon = (id) =>
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id]}</svg>`;

/*
 * The dock's mark: a Windows 95 arrow, pixel for pixel. B is the outline,
 * W the fill. Drawn as one rect per pixel with crisp edges so it stays
 * chunky at any size rather than smoothing into a modern cursor.
 */
export const CURSOR = [
	"B...........",
	"BB..........",
	"BWB.........",
	"BWWB........",
	"BWWWB.......",
	"BWWWWB......",
	"BWWWWWB.....",
	"BWWWWWWB....",
	"BWWWWWWWB...",
	"BWWWWWWWWB..",
	"BWWWWWWWWWB.",
	"BWWWWWWBBBBB",
	"BWWWBWWB....",
	"BWWBBWWB....",
	"BWB..BWWB...",
	"BB...BWWB...",
	"B.....BWWB..",
	"......BWWB..",
	".......BB...",
];
export const cursorSvg = () => {
	const rects = [];
	CURSOR.forEach((row, y) => {
		[...row].forEach((cell, x) => {
			if (cell !== ".") {
				rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${cell === "B" ? "#17120f" : "#fff"}"/>`);
			}
		});
	});
	return `<svg class="pixel" viewBox="0 0 12 19" shape-rendering="crispEdges" aria-hidden="true">${rects.join("")}</svg>`;
};
