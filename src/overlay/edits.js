/**
 * Live edits to the page, tracked per element.
 *
 * Nothing edits the code: a change is an inline style (important, so it beats
 * the utility class that set the original) until the page reloads. What each
 * property was before the first touch is kept, so Reset can put back exactly
 * what the page had, and what it is now, so a note can say what changed.
 */
export function createEdits() {
	const edits = new Map();
	/* The element's own transitions, off while it is being edited so the page
	   tracks a drag rather than easing after it. */
	let stilled = null;

	function entryOf(el) {
		let entry = edits.get(el);
		if (!entry) {
			entry = new Map();
			edits.set(el, entry);
		}
		return entry;
	}

	/** Paint one property, remembering what it was the first time. `shown` is how the note should say it. */
	function set(el, prop, value, shown) {
		const entry = entryOf(el);
		if (!entry.has(prop)) {
			entry.set(prop, {
				inline: el.style.getPropertyValue(prop),
				priority: el.style.getPropertyPriority(prop),
				from: getComputedStyle(el).getPropertyValue(prop).trim(),
				to: null,
			});
		}
		el.style.setProperty(prop, value, "important");
		entry.get(prop).to = shown ?? value;
	}

	/** Put back what the page had, for the given properties or all of them. */
	function reset(el, props) {
		const entry = edits.get(el);
		if (!entry) return;
		for (const prop of props ?? [...entry.keys()]) {
			const saved = entry.get(prop);
			if (!saved) continue;
			if (saved.inline) el.style.setProperty(prop, saved.inline, saved.priority);
			else el.style.removeProperty(prop);
			entry.delete(prop);
		}
	}

	/** "prop: before → after", one per line, for everything changed since the last note. */
	function describe(el) {
		const entry = edits.get(el);
		if (!entry) return "";
		return [...entry.entries()]
			.filter(([, change]) => change.to !== null)
			.map(([prop, change]) => `${prop}: ${change.from || "none"} → ${change.to}`)
			.join("\n");
	}

	/** A note now owns these changes; the next note on this element starts from here. */
	function settle(el) {
		edits.get(el)?.forEach((change) => {
			change.from = change.to;
			change.to = null;
		});
	}

	function still(el) {
		release();
		stilled = {
			el,
			value: el.style.getPropertyValue("transition"),
			priority: el.style.getPropertyPriority("transition"),
		};
		el.style.setProperty("transition", "none", "important");
	}

	function release() {
		if (!stilled) return;
		if (stilled.value) stilled.el.style.setProperty("transition", stilled.value, stilled.priority);
		else stilled.el.style.removeProperty("transition");
		stilled = null;
	}

	return { set, reset, describe, settle, still, release };
}
