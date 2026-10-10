import { actions, rangeRow } from "../controls.js";

const PRESETS = [0, 4, 8, 12, 16, 24, 32];
const px = (value) => Number.parseFloat(value) || 0;

/** The children that take up room in the flow: not hidden, not lifted out of it. */
function flowing(el) {
	return [...el.children].filter((child) => {
		const style = getComputedStyle(child);
		return style.display !== "none" && style.position !== "absolute" && style.position !== "fixed";
	});
}

/**
 * How a container spaces its children, which decides what "gap" means for it:
 * a flex row's is `column-gap`, a flex column's `row-gap`, a grid's `gap`. A
 * plain block has no gap of its own: its children stack with margins, so there
 * the gap is theirs (`margin-top` on every one after the first).
 */
export function layoutOf(el) {
	const style = getComputedStyle(el);
	if (style.display.includes("grid")) return { way: "grid", prop: "gap", gap: px(style.rowGap) };
	if (style.display.includes("flex")) {
		return style.flexDirection.startsWith("column")
			? { way: "column", prop: "row-gap", gap: px(style.rowGap) }
			: { way: "row", prop: "column-gap", gap: px(style.columnGap) };
	}
	const [first, second] = flowing(el);
	// Stacked margins collapse: the gap is the larger of the two that meet.
	const gap = second ? Math.max(px(getComputedStyle(first).marginBottom), px(getComputedStyle(second).marginTop)) : 0;
	return { way: "stack", prop: null, gap };
}

const GAP_LABELS = { row: "Gap ↔ (row)", column: "Gap ↕ (column)", grid: "Gap (grid)", stack: "Gap ↕ (children's margins)" };
const STACK_GAP = "gap between children (margin-top on each after the first)";

/** Spacing: the gap between a container's children, along the way they flow, and its padding. */
export function spacingSection({ el, els, set, remark, reset, root, changed, redraw, addNote }) {
	const section = document.createElement("div");
	section.className = "section";
	const first = layoutOf(el);
	const style = getComputedStyle(el);

	/* Each picked container gets the gap its own layout calls for. */
	const setGap = (v) => {
		for (const target of els) {
			const layout = layoutOf(target);
			if (layout.prop) {
				set(layout.prop, `${v}px`, undefined, [target]);
				continue;
			}
			const children = flowing(target);
			if (children.length < 2) continue;
			// Both margins that meet, or the larger one left behind would still win.
			set("margin-bottom", "0px", undefined, children.slice(0, -1));
			set("margin-top", `${v}px`, undefined, children.slice(1));
			remark(STACK_GAP, `${layout.gap}px`, `${v}px`, [target]);
		}
		changed();
	};

	const gap = rangeRow({ root, label: GAP_LABELS[first.way], min: 0, max: 64, value: first.gap, unit: "px", onChange: setGap });
	section.appendChild(gap.wrap);
	const presets = document.createElement("div");
	presets.className = "seg";
	presets.innerHTML = PRESETS.map((v) => `<button data-gap="${v}">${v}</button>`).join("");
	for (const button of presets.querySelectorAll("[data-gap]")) {
		button.onclick = () => {
			const v = Number(button.dataset.gap);
			gap.show(v);
			setGap(v);
		};
	}
	section.appendChild(presets);

	for (const [label, prop, value] of [
		["Padding ↔", "padding-inline", px(style.paddingLeft)],
		["Padding ↕", "padding-block", px(style.paddingTop)],
	]) {
		section.appendChild(
			rangeRow({
				root,
				label,
				min: 0,
				max: 64,
				value,
				unit: "px",
				onChange: (v) => {
					set(prop, `${v}px`);
					changed();
				},
			}).wrap,
		);
	}

	section.appendChild(
		actions({
			onReset: () => {
				reset(["gap", "row-gap", "column-gap", "padding-inline", "padding-block", STACK_GAP]);
				for (const target of els) reset(["margin-top", "margin-bottom"], flowing(target));
				redraw();
			},
			onNote: () => void addNote(),
		}),
	);
	return section;
}
