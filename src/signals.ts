import { signal, computed, Signal, effect } from "@preact/signals";

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
 * Creates a signal that is synced with a localStorage item.
 * @param key The localStorage key.
 * @param defaultValue The default value to use if the key is not in localStorage.
 * @returns A signal representing the localStorage item's value.
 */
export function createLocalStorageSignal(key: string, defaultValue = ""): Signal<string> {
	const storedValue = typeof window !== "undefined" ? localStorage.getItem(key) : null;
	const sig = signal(storedValue ?? defaultValue);

	effect(() => {
		if (typeof window !== "undefined") {
			const currentValue = localStorage.getItem(key);
			if (sig.value !== currentValue) {
				localStorage.setItem(key, sig.value);
			}
		}
	});

	// Listen for changes from other tabs
	if (typeof window !== "undefined") {
		window.addEventListener('storage', (e) => {
			if (e.key === key && e.newValue !== sig.peek()) {
				sig.value = e.newValue ?? defaultValue;
			}
		});
	}

	return sig;
}

/**
 * Creates a signal that tracks localStorage keys matching a regex.
 * Uses the first capturing group from the regex as the signal's value.
 * @param regex The regular expression to match keys against. Must have one capturing group.
 * @returns A signal containing an array of the captured group values.
 */
export function createLocalStorageKeysSignal(regex: RegExp): Signal<string[]> {
	const getKeys = () => {
		if (typeof window === "undefined") return [];
		const keys: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
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
		const originalSetItem = localStorage.setItem;
		localStorage.setItem = function(key, value) {
			originalSetItem.apply(this, [key, value]);
			window.dispatchEvent(new Event('local-storage-changed'));
		};
		const originalRemoveItem = localStorage.removeItem;
		localStorage.removeItem = function(key) {
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
const LEGACY_STORAGE_KEY = "text-editor-content";
const WELCOME_KEY = 'prompt-pad-welcomed';


// --- Private Helper Functions ---

function getPromptTextFromStorage(id: string): string {
	if (typeof window === "undefined") return "";
	try {
		return localStorage.getItem(PROMPT_PREFIX + id) || "";
	} catch (error) {
		console.warn(`Failed to get prompt text for ${id} from localStorage:`, error);
		return "";
	}
}

function migrateLegacyContent() {
	if (typeof window === "undefined") return;
	try {
		const legacyContent = localStorage.getItem(LEGACY_STORAGE_KEY);
		if (legacyContent) {
			// Temporarily get keys to check if migration is needed
			const keys = [];
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key?.startsWith(PROMPT_PREFIX)) {
					keys.push(key);
				}
			}
			if (keys.length === 0) {
				const newId = crypto.randomUUID();
				localStorage.setItem(PROMPT_PREFIX + newId, legacyContent);
				console.log("Migrated legacy content to new prompt format.");
			}
			localStorage.removeItem(LEGACY_STORAGE_KEY);
		}
	} catch (error) {
		console.warn("Failed to migrate legacy content:", error);
	}
}

// Perform migration before initializing signals
migrateLegacyContent();


// --- Signals and State Management ---

/** A map to hold individual prompt signals, keyed by ID. */
const promptSignals = new Map<string, Signal<Prompt>>();

/** Signal: The list of all prompt IDs, derived from localStorage. */
export const promptIds = createLocalStorageKeysSignal(/^prompt\/(.*)/);

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
		const text = getPromptTextFromStorage(id);
		promptSignal = signal({ id, text });
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
	// Update the signal's value
	promptSignal.value = { ...promptSignal.value, text };

	// Persist to localStorage
	try {
		if (typeof window !== "undefined") {
			localStorage.setItem(PROMPT_PREFIX + id, text);
		}
	} catch (error) {
		console.error(`Failed to save prompt ${id} to localStorage:`, error);
	}
}

/**
 * Creates a new, empty prompt and selects it.
 */
export function addNewPrompt() {
	const newId = crypto.randomUUID();
	try {
		if (typeof window !== "undefined") {
			// This setItem will trigger the createLocalStorageKeysSignal to update promptIds
			localStorage.setItem(PROMPT_PREFIX + newId, "");
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
const welcomedSignal = createLocalStorageSignal(WELCOME_KEY, "false");
export const hasBeenWelcomed: ReadOnlySignal<boolean> = computed(() => welcomedSignal.value === 'true');

export function markAsWelcomed() {
	welcomedSignal.value = 'true';
}


// --- App Initialization ---
function initializeApp() {
	if (typeof window === "undefined") return;

	// Effect to ensure a prompt is always selected
	effect(() => {
		const currentIds = promptIds.value;
		const selectedId = selectedPromptId.value;

		// If there's no selected ID or the selected ID is invalid, select the first available prompt.
		if (!selectedId || !currentIds.includes(selectedId)) {
			if (currentIds.length > 0) {
				// Use history.replaceState to not create a new history entry
				selectedPromptId.value = currentIds[0];
			} else {
				// If no prompts exist at all, create a new one.
				// This will also trigger the selectedPromptId to be set.
				addNewPrompt();
			}
		}
	});
}

initializeApp();
