import { actions, rangeRow } from "../controls.js";

const PRESETS = [0, 4, 8, 12, 16, 24];
const FULL = 9999;

/** Corners: one radius for all four, with the common steps one click away. */
export function radiusSection({ el, set, reset, root, changed, redraw, addNote }) {
	const section = document.createElement("div");
	section.className = "section";
	const range = rangeRow({
		root,
		label: "Radius",
		min: 0,
		max: 64,
		value: Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0,
		unit: "px",
		onChange: (v) => {
			set("border-radius", `${v}px`);
			changed();
		},
	});
	section.appendChild(range.wrap);

	const presets = document.createElement("div");
	presets.className = "seg";
	presets.innerHTML = `${PRESETS.map((v) => `<button data-r="${v}">${v}</button>`).join("")}<button data-r="${FULL}">Full</button>`;
	for (const button of presets.querySelectorAll("[data-r]")) {
		button.onclick = () => {
			const v = Number(button.dataset.r);
			set("border-radius", `${v}px`);
			range.show(v);
			changed();
		};
	}
	section.appendChild(presets);
	section.appendChild(
		actions({
			onReset: () => {
				reset(["border-radius"]);
				redraw();
			},
			onNote: () => void addNote(),
		}),
	);
	return section;
}
