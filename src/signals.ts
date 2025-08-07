import { signal, computed, Signal, effect } from "@preact/signals";

// --- Storage Utility ---

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


// --- New Signal Utilities ---

/** A Signal that can only be read from. */
export type ReadOnlySignal<T> = Omit<Signal<T>, "value"> & { readonly value: T };

/**
 * Creates a signal that is synced with a URL hash parameter.
 * @param paramName The name of the hash parameter to track.
 * @param replaceHistory If true, uses history.replaceState to avoid creating new history entries.
 * @returns A signal representing the value of the hash parameter.
 */
export function createHashParamSignal(paramName: string, replaceHistory = false): Signal<string | undefined> {
	const getHashParam = () => new URLSearchParams(window.location.hash.substring(1)).get(paramName) ?? undefined;

	const hashSignal = signal<string | undefined>(getHashParam());

	const onHashChange = () => {
		const newValue = getHashParam();
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

/**
 * Shows or hides a modal dialog based on the value of a boolean signal.
 * @param sig A ReadOnlySignal<boolean> that determines modal visibility.
 * @param modal The HTMLDialogElement to control.
 */
export function showModalFromSignal(sig: ReadOnlySignal<boolean>, modal: HTMLDialogElement | null): void {
	if (!modal) return;
	effect(() => {
		if (sig.value) {
			if (!modal.open) modal.showModal();
		} else {
			if (modal.open) modal.close();
		}
	});
}

// --- Interfaces ---
export interface Prompt {
	id: string;
	text: string;
}

// --- Constants ---
const PROMPT_PREFIX = "prompt/";
const WELCOME_KEY = 'prompt-pad-welcomed';


// --- Private Helper Functions ---

/**
 * Parses a stored string into a Prompt object.
 * Handles both legacy plain text and new JSON formats.
 * @param stored The string from localStorage.
 * @param key The localStorage key, used to derive the ID.
 * @returns A Prompt object.
 */
function parsePrompt(stored: string, key: string): Prompt {
	const id = key.substring(PROMPT_PREFIX.length);
	if (!stored) {
		return { id, text: '' };
	}
	try {
		// New format: stored as JSON object (without id)
		const parsed = JSON.parse(stored);
		return { ...parsed, id };
	} catch (e) {
		// Legacy format: stored as raw text
		return { id, text: stored };
	}
}

/**
 * Serializes a Prompt object for storage.
 * The `id` is not stored in the value; it's derived from the key.
 * @param prompt The prompt to serialize.
 * @returns A JSON string representation of the prompt.
 */
function serializePrompt(prompt: Prompt): string {
	const { id, ...rest } = prompt;
	return JSON.stringify(rest);
}

function getPromptFromStorage(id: string): Prompt {
	if (typeof window === "undefined") return { id, text: "" };
	try {
		const storage = getStorage();
		const key = PROMPT_PREFIX + id;
		const storedValue = storage.getItem(key) || "";
		return parsePrompt(storedValue, key);
	} catch (error) {
		console.warn(`Failed to get prompt for ${id} from storage:`, error);
		return { id, text: "" };
	}
}


// --- Signals and State Management ---

/** A map to hold individual prompt signals, keyed by ID. */
const promptSignals = new Map<string, Signal<Prompt>>();

/** Signal: The list of all prompt IDs, derived from storage. */
export const promptIds = createStorageKeysSignal(/^prompt\/(.*)/);

/** Signal: The ID of the currently selected prompt, derived from the URL hash. */
export const selectedPromptId = createHashParamSignal('id', true);


// --- Computed Signals ---

/** Computed: The full list of all Prompt objects. */
export const allPrompts = computed<Prompt[]>(() => {
	return promptIds.value.map(id => getPrompt(id).value);
});

/** Computed: The currently selected Prompt object. */
export const selectedPrompt = computed<Prompt | undefined>(() => {
	const id = selectedPromptId.value;
	return id ? getPrompt(id).value : undefined;
});


// --- Functions ---

/**
 * Retrieves the signal for a specific prompt.
 * If the signal doesn't exist, it initializes one from localStorage.
 * @param id The ID of the prompt.
 * @returns A Signal containing the Prompt data.
 */
export function getPrompt(id: string): Signal<Prompt> {
	let promptSignal = promptSignals.get(id);
	if (!promptSignal) {
		const prompt = getPromptFromStorage(id);
		promptSignal = signal(prompt);
		promptSignals.set(id, promptSignal);
	}
	return promptSignal;
}

/**
 * Updates the text of a specific prompt and saves it to localStorage.
 * @param id The ID of the prompt to update.
 * @param text The new text for the prompt.
 */
export function updatePromptText(id: string, text: string) {
	const promptSignal = getPrompt(id);
	const newPromptData = { ...promptSignal.value, text };
	promptSignal.value = newPromptData;

	// Persist to storage
	try {
		if (typeof window !== "undefined") {
			const storage = getStorage();
			storage.setItem(PROMPT_PREFIX + id, serializePrompt(newPromptData));
		}
	} catch (error) {
		console.error(`Failed to save prompt ${id} to storage:`, error);
	}
}

/**
 * Creates a new, empty prompt and selects it.
 */
export function addNewPrompt() {
	const newId = crypto.randomUUID();
	try {
		if (typeof window !== "undefined") {
			const storage = getStorage();
			// This setItem will trigger the createStorageKeysSignal to update promptIds
			storage.setItem(PROMPT_PREFIX + newId, "");
		}
		// Create a signal for the new prompt
		getPrompt(newId);
		// Set it as the selected prompt, which will update the URL hash
		selectedPromptId.value = newId;

	} catch (error) {
		console.error("Failed to create new prompt:", error);
	}
}

// --- Welcome Modal Logic ---
const welcomedSignal = createStorageSignal(WELCOME_KEY, false);
export const hasBeenWelcomed: ReadOnlySignal<boolean> = computed(() => welcomedSignal.value);

export function markAsWelcomed() {
	welcomedSignal.value = true;
}


// --- App Initialization ---
// No-op; app is initialized from the Astro component.
