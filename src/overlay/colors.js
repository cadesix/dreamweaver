/** Color math for the color tool: parse anything the browser can paint, speak HSL. */

/** Any CSS color, as RGBA, by painting it on a one-pixel canvas. */
export function toRgba(css) {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 1;
	const context = canvas.getContext("2d", { willReadFrequently: true });
	if (!context) return { r: 0, g: 0, b: 0, a: 0 };
	context.fillStyle = "#000";
	context.fillStyle = css;
	context.fillRect(0, 0, 1, 1);
	const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
	return { r, g, b, a: a / 255 };
}

/** RGB → HSL; a gray has no hue, so it keeps `fallbackHue` rather than jumping to red. */
export function rgbToHsl({ r, g, b }, fallbackHue = 0) {
	const [rr, gg, bb] = [r / 255, g / 255, b / 255];
	const max = Math.max(rr, gg, bb);
	const min = Math.min(rr, gg, bb);
	const l = (max + min) / 2;
	if (max === min) return { h: fallbackHue, s: 0, l: l * 100 };
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h;
	if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
	else if (max === gg) h = (bb - rr) / d + 2;
	else h = (rr - gg) / d + 4;
	return { h: h * 60, s: s * 100, l: l * 100 };
}

export function hslCss({ h, s, l, a }) {
	const base = `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
	return a < 1 ? `hsl(${base} / ${Math.round(a * 100) / 100})` : `hsl(${base})`;
}

/** HSL → `#rrggbb`, or `#rrggbbaa` when translucent. Pure math, no canvas. */
export function hex({ h, s, l, a }) {
	const sat = s / 100;
	const light = l / 100;
	const k = (n) => (n + h / 30) % 12;
	const chroma = sat * Math.min(light, 1 - light);
	const channel = (n) => light - chroma * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
	const parts = [channel(0), channel(8), channel(4)].map((v) =>
		Math.round(v * 255)
			.toString(16)
			.padStart(2, "0"),
	);
	if (a < 1) parts.push(Math.round(a * 255).toString(16).padStart(2, "0"));
	return `#${parts.join("")}`;
}
