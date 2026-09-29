import { actions, rangeRow } from "../controls.js";

const WEIGHTS = [
	[300, "Light"],
	[400, "Regular"],
	[500, "Medium"],
	[600, "Semi"],
	[700, "Bold"],
	[800, "Heavy"],
];

/** Text: the element's size and weight. */
export function textSection({ el, set, reset, root, changed, redraw, addNote }) {
	const section = document.createElement("div");
	section.className = "section";
	const style = getComputedStyle(el);
	const size = rangeRow({
		root,
		label: "Size",
		min: 8,
		max: 96,
		value: Number.parseFloat(style.fontSize) || 14,
		unit: "px",
		onChange: (v) => {
			set("font-size", `${v}px`);
			changed();
		},
	});
	section.appendChild(size.wrap);

	const weight = document.createElement("div");
	const current = Number.parseInt(style.fontWeight, 10) || 400;
	weight.innerHTML = `<div class="label"><span>Weight</span><span data-out="weight">${current}</span></div>
		<div class="seg">${WEIGHTS.map(([w, name]) => `<button data-w="${w}" data-on="${w === current}" title="${w}">${name}</button>`).join("")}</div>`;
	for (const button of weight.querySelectorAll("[data-w]")) {
		button.onclick = () => {
			set("font-weight", button.dataset.w);
			for (const other of weight.querySelectorAll("[data-w]")) other.dataset.on = String(other === button);
			weight.querySelector('[data-out="weight"]').textContent = button.dataset.w;
			changed();
		};
	}
	section.appendChild(weight);
	section.appendChild(
		actions({
			onReset: () => {
				reset(["font-size", "font-weight"]);
				redraw();
			},
			onNote: () => void addNote(),
		}),
	);
	return section;
}
