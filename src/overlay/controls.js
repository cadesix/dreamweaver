/** The controls every tool is built from: drag surfaces, sliders, and the action row. */

/**
 * Drag anywhere in `el`, reporting 0–1 along x and y. Pointer events can
 * outrun the screen, so moves are coalesced to one call a frame, always from
 * the latest position, and the page keeps up with the knob.
 */
export function drag(el, onMove) {
	el.onpointerdown = (event) => {
		event.preventDefault();
		el.setPointerCapture?.(event.pointerId);
		let latest = { x: event.clientX, y: event.clientY };
		let frame = 0;
		const flush = () => {
			frame = 0;
			const box = el.getBoundingClientRect();
			onMove(
				Math.min(1, Math.max(0, (latest.x - box.left) / (box.width || 1))),
				Math.min(1, Math.max(0, (latest.y - box.top) / (box.height || 1))),
			);
		};
		el.onpointermove = (e) => {
			latest = { x: e.clientX, y: e.clientY };
			if (!frame) frame = requestAnimationFrame(flush);
		};
		el.onpointerup = () => {
			el.onpointermove = null;
		};
		flush();
	};
}

/** A slider over [min, max] with a number box beside it, both live. */
export function rangeRow({ root, label, min, max, value, unit, onChange }) {
	const wrap = document.createElement("div");
	wrap.innerHTML = `<div class="label"><span>${label}</span></div>
		<div class="row"><div class="slider"><div class="track"></div><div class="knob"></div></div>
		<input class="num" inputmode="decimal" /></div>`;
	const slider = wrap.querySelector(".slider");
	const input = wrap.querySelector(".num");
	const show = (v) => {
		const at = ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * 100;
		slider.querySelector(".knob").style.left = `${at}%`;
		slider.querySelector(".track").style.width = `${at}%`;
		// The knob stops at the ends; the box says what was really applied ("Full" is 9999).
		if (root.activeElement !== input) input.value = v >= 9999 ? "full" : `${Math.round(v)}${unit}`;
	};
	drag(slider, (x) => {
		const v = Math.round(min + x * (max - min));
		show(v);
		onChange(v);
	});
	input.onkeydown = (event) => {
		event.stopPropagation();
		if (event.key === "Enter") {
			const v = Number.parseFloat(input.value);
			if (Number.isFinite(v)) {
				input.blur();
				show(v);
				onChange(v);
			}
		}
	};
	show(value);
	return { wrap, show };
}

/** Every tool's options end with the same two actions. */
export function actions({ onReset, onNote }) {
	const row = document.createElement("div");
	row.className = "row";
	row.innerHTML = `<button class="btn" data-act="reset">Reset</button>
		<button class="btn dark wide" data-act="note">Add as note</button>`;
	row.querySelector('[data-act="reset"]').onclick = onReset;
	row.querySelector('[data-act="note"]').onclick = onNote;
	return row;
}
