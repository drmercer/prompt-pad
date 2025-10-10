import { effect, Signal, signal } from "@preact/signals";

export function getHashParam(paramName: string): string | undefined {
	return new URLSearchParams(window.location.hash.substring(1)).get(paramName) ?? undefined;
}

/**
 * Creates a signal that is synced with a URL hash parameter.
 * @param paramName The name of the hash parameter to track.
 * @param replaceHistory If true, uses history.replaceState to avoid creating new history entries.
 * @returns A signal representing the value of the hash parameter.
 */
export function createHashParamSignal(paramName: string, replaceHistory = false): Signal<string | undefined> {

	const hashSignal = signal<string | undefined>(getHashParam(paramName));

	const onHashChange = () => {
		const newValue = getHashParam(paramName);
		if (hashSignal.peek() !== newValue) {
			hashSignal.value = newValue;
		}
	};

	window.addEventListener('hashchange', onHashChange);

	effect(() => {
		const value = hashSignal.value;
		const params = new URLSearchParams(window.location.hash.substring(1));
		const currentValue = params.get(paramName);

		if (value === undefined) {
			params.delete(paramName);
		} else if (currentValue !== value) {
			params.set(paramName, value);
		} else {
			return; // No change needed
		}

		const newHash = params.toString() ? `#${params}` : window.location.pathname;

		if (replaceHistory) {
			history.replaceState(null, '', newHash);
		} else {
			window.location.hash = newHash;
		}
	});

	return hashSignal;
}
