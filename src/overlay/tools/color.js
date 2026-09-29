import { hex, hslCss, rgbToHsl, toRgba } from "../colors.js";
import { actions, drag } from "../controls.js";

const HTML_PROPS = [
	{ key: "background-color", label: "Fill" },
	{ key: "color", label: "Text" },
	{ key: "border-color", label: "Border" },
];
/* Chart shapes (pie slices, bars, lines) are painted by fill and stroke, not a background. */
const SVG_PROPS = [
	{ key: "fill", label: "Fill" },
	{ key: "stroke", label: "Stroke" },
];

/* The color being edited, and which property it paints. Kept across cards, so
   a hue carries from one element to the next and a gray keeps its hue. */
const color = { h: 210, s: 80, l: 50, a: 1 };
let colorProp = null;

export function propsFor(el) {
	return el instanceof SVGElement && el.tagName.toLowerCase() !== "svg" ? SVG_PROPS : HTML_PROPS;
}

function readColor(el, prop) {
	const value = getComputedStyle(el).getPropertyValue(prop).trim();
	// A gradient (`url(#…)`) or nothing at all has no single color to start from.
	if (!value || value === "none" || value.startsWith("url(")) return { ...color, a: 1 };
	const rgba = toRgba(value);
	if (rgba.a === 0) return { ...color, a: 1 };
	return { ...rgbToHsl(rgba, color.h), a: rgba.a };
}

function defaultProp(el) {
	if (propsFor(el) === SVG_PROPS) return getComputedStyle(el).fill === "none" ? "stroke" : "fill";
	const clear = /rgba\(.*,\s*0\)$|transparent/.test(getComputedStyle(el).backgroundColor);
	return clear && (el.innerText ?? "").trim() ? "color" : "background-color";
}

/** Color: a full-spectrum HSL picker that repaints the element as you drag. */
export function colorSection({ el, root, edits, changed, redraw, addNote }) {
	if (!colorProp || !propsFor(el).some((p) => p.key === colorProp)) colorProp = defaultProp(el);
	Object.assign(color, readColor(el, colorProp));

	const paint = () => {
		edits.set(el, colorProp, hslCss(color), `${hslCss(color)} (${hex(color)})`);
		if (colorProp === "border-color" && getComputedStyle(el).borderStyle === "none") {
			edits.set(el, "border-style", "solid");
			if (!Number.parseFloat(getComputedStyle(el).borderWidth)) edits.set(el, "border-width", "1px");
		}
		changed();
	};

	const section = document.createElement("div");
	section.className = "section";
	section.innerHTML = `
		<div class="seg">${propsFor(el).map((p) => `<button data-prop="${p.key}" data-on="${p.key === colorProp}">${p.label}</button>`).join("")}</div>
		<div class="area"><div class="knob"></div></div>
		<div><div class="label"><span>Saturation</span><span data-out="s"></span></div>
			<div class="row"><div class="slider" data-slider="s"><div class="knob"></div></div></div></div>
		<div><div class="label"><span>Opacity</span><span data-out="a"></span></div>
			<div class="row"><div class="slider check" data-slider="a"><div data-fill style="position:absolute;inset:0;border-radius:7px"></div><div class="knob"></div></div></div></div>
		<div class="row"><div class="swatch check"><div data-out="swatch" style="width:100%;height:100%;border-radius:8px"></div></div>
			<input class="value" data-out="value" spellcheck="false" />
			${"EyeDropper" in window ? '<button class="btn" data-act="eyedrop" title="Sample a color from anywhere on screen">Sample</button>' : ""}</div>`;
	for (const tab of section.querySelectorAll("[data-prop]")) {
		tab.onclick = () => {
			colorProp = tab.dataset.prop;
			redraw();
		};
	}

	/* Every drag step: move the knobs, repaint the gradients for the current
	   saturation and hue, rewrite the readouts, and paint the page. */
	const update = (repaint = true) => {
		const hues = [0, 60, 120, 180, 240, 300, 360].map((h) => `hsl(${h} ${color.s}% 50%)`).join(",");
		// Lightness runs white → the hue at 50% → black, which is exactly how HSL mixes.
		const area = section.querySelector(".area");
		area.style.background = `linear-gradient(to bottom, #fff, rgba(255,255,255,0) 50%, rgba(0,0,0,0) 50%, #000), linear-gradient(to right, ${hues})`;
		const knob = area.querySelector(".knob");
		knob.style.left = `${(color.h / 360) * 100}%`;
		knob.style.top = `${100 - color.l}%`;
		knob.style.background = hslCss({ ...color, a: 1 });
		const sat = section.querySelector('[data-slider="s"]');
		sat.style.background = `linear-gradient(to right, hsl(${color.h} 0% ${color.l}%), hsl(${color.h} 100% ${color.l}%))`;
		sat.querySelector(".knob").style.left = `${color.s}%`;
		const alpha = section.querySelector('[data-slider="a"]');
		alpha.querySelector("[data-fill]").style.background =
			`linear-gradient(to right, hsl(${color.h} ${color.s}% ${color.l}% / 0), hsl(${color.h} ${color.s}% ${color.l}%))`;
		alpha.querySelector(".knob").style.left = `${color.a * 100}%`;
		section.querySelector('[data-out="s"]').textContent = `${Math.round(color.s)}%`;
		section.querySelector('[data-out="a"]').textContent = `${Math.round(color.a * 100)}%`;
		section.querySelector('[data-out="swatch"]').style.background = hslCss(color);
		const input = section.querySelector('[data-out="value"]');
		if (root.activeElement !== input) input.value = `${hslCss(color)}  ${hex(color)}`;
		// Opening shows the element's own color; only a change paints it.
		if (repaint) paint();
	};

	drag(section.querySelector(".area"), (x, y) => {
		color.h = x * 360;
		color.l = (1 - y) * 100;
		update();
	});
	drag(section.querySelector('[data-slider="s"]'), (x) => {
		color.s = x * 100;
		update();
	});
	drag(section.querySelector('[data-slider="a"]'), (x) => {
		color.a = Math.round(x * 100) / 100;
		update();
	});

	const input = section.querySelector('[data-out="value"]');
	input.onkeydown = (event) => {
		event.stopPropagation();
		if (event.key === "Enter") {
			const rgba = toRgba(input.value.split(/\s{2,}/)[0]);
			Object.assign(color, rgbToHsl(rgba, color.h), { a: rgba.a });
			input.blur();
			update();
		}
	};
	const eyedrop = section.querySelector('[data-act="eyedrop"]');
	if (eyedrop) {
		eyedrop.onclick = async () => {
			try {
				const { sRGBHex } = await new window.EyeDropper().open();
				Object.assign(color, rgbToHsl(toRgba(sRGBHex), color.h), { a: 1 });
				update();
			} catch {}
		};
	}
	section.appendChild(
		actions({
			onReset: () => {
				edits.reset(el, [colorProp, "border-style", "border-width"]);
				redraw();
			},
			onNote: () => void addNote(),
		}),
	);
	update(false);
	return section;
}
