import { effect, signal, type Signal } from "@preact/signals";

const getStorage = (): Storage => {
	if (typeof window !== 'undefined' && window.location.hostname.endsWith('.netlify.app')) {
		return sessionStorage;
	}
	// Fallback to a dummy storage object during SSR
	if (typeof window === 'undefined') {
		return {
			getItem: () => null,
			setItem: () => {},
			removeItem: () => {},
			clear: () => {},
			key: () => null,
			length: 0,
		};
	}
	return localStorage;
};

/**
 * Creates a signal that is synced with a storage item (localStorage or sessionStorage), with support for custom types.
 * @param key The storage key.
 * @param defaultValue The default value to use if the key is not in storage.
 * @param options Optional functions to parse and serialize the value. Defaults to JSON.
 * @returns A signal representing the storage item's value.
 */
export function createStorageSignal<T>(
	key: string,
	defaultValue: T,
	options?: {
		parse: (stored: string, key: string) => T;
		serialize: (value: T, key: string) => string;
	}
): Signal<T> {
	const serialize = options?.serialize ?? ((v) => JSON.stringify(v));
	const parse = options?.parse ?? ((v) => JSON.parse(v));

	const getStoredValue = (): T => {
		if (typeof window === 'undefined') return defaultValue;
		const storage = getStorage();
		const stored = storage.getItem(key);
		if (stored === null) return defaultValue;
		try {
			return parse(stored, key);
		} catch (e) {
			console.error(`Failed to parse storage key "${key}". Returning default value.`, e);
			return defaultValue;
		}
	};

	const sig = signal(getStoredValue());

	effect(() => {
		if (typeof window !== "undefined") {
			const storage = getStorage();
			const serializedValue = serialize(sig.value, key);
			if (storage.getItem(key) !== serializedValue) {
				storage.setItem(key, serializedValue);
			}
		}
	});

	// Listen for changes from other tabs
	if (typeof window !== "undefined") {
		window.addEventListener('storage', (e) => {
			if (e.key === key) {
				const newValue = e.newValue === null ? defaultValue : parse(e.newValue, key);
				if (sig.peek() !== newValue) {
					sig.value = newValue;
				}
			}
		});
	}

	return sig;
}

/**
 * Creates a signal that tracks storage keys matching a regex.
 * Uses the first capturing group from the regex as the signal's value.
 * @param regex The regular expression to match keys against. Must have one capturing group.
 * @returns A signal containing an array of the captured group values.
 */
export function createStorageKeysSignal(regex: RegExp): Signal<string[]> {
	const getKeys = () => {
		if (typeof window === "undefined") return [];
		const storage = getStorage();
		const keys: string[] = [];
		for (let i = 0; i < storage.length; i++) {
			const key = storage.key(i);
			const match = key?.match(regex);
			if (match && match[1]) {
				keys.push(match[1]);
			}
		}
		return keys;
	};

	const keysSignal = signal(getKeys());

	// Update when storage changes in other tabs or when our own signals notify us
	const updateKeys = () => {
		keysSignal.value = getKeys();
	};

	if (typeof window !== "undefined") {
		window.addEventListener('storage', updateKeys);
		// A custom event to trigger updates from the current tab
		window.addEventListener('local-storage-changed', updateKeys);
	}

	// Override localStorage methods to dispatch event
	if (typeof window !== "undefined") {
		const storage = getStorage();
		const originalSetItem = storage.setItem;
		storage.setItem = function(key, value) {
			originalSetItem.apply(this, [key, value]);
			window.dispatchEvent(new Event('local-storage-changed'));
		};
		const originalRemoveItem = storage.removeItem;
		storage.removeItem = function(key) {
			originalRemoveItem.apply(this, [key]);
			window.dispatchEvent(new Event('local-storage-changed'));
		};
	}

	return keysSignal;
}
