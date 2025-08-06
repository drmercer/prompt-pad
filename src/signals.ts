import { signal, computed, Signal, effect } from "@preact/signals";

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

function getPromptIdsFromStorage(): string[] {
	if (typeof window === "undefined") return [];
	try {
		const ids = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith(PROMPT_PREFIX)) {
				ids.push(key.substring(PROMPT_PREFIX.length));
			}
		}
		return ids;
	} catch (error) {
		console.warn("Failed to get prompt IDs from localStorage:", error);
		return [];
	}
}

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
            const currentIds = getPromptIdsFromStorage();
            if (currentIds.length === 0) {
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

/** Signal: The list of all prompt IDs. */
export const promptIds = signal<string[]>(getPromptIdsFromStorage());

/** Signal: The ID of the currently selected prompt. */
export const selectedPromptId = signal<string | undefined>(undefined);


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
			localStorage.setItem(PROMPT_PREFIX + newId, "");
		}
		// Add the new ID to the list of prompt IDs
		promptIds.value = [...promptIds.value, newId];
		// Create a signal for the new prompt
		getPrompt(newId);
        // Set it as the selected prompt
        selectedPromptId.value = newId;

	} catch (error) {
		console.error("Failed to create new prompt:", error);
	}
}

/**
 * Handles initial routing and sets the selected prompt based on the URL hash.
 */
export function initializeRouting() {
    if (typeof window === "undefined") return;

    const handleHashChange = () => {
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.substring(1));
        let id = params.get("id");

        const currentPromptIds = promptIds.value;

        if (id && currentPromptIds.includes(id)) {
            if (selectedPromptId.peek() !== id) {
                selectedPromptId.value = id;
            }
        } else {
            const firstId = currentPromptIds[0];
            if (firstId) {
                // If there's no valid ID, fall back to the first one.
                updateURLHash(firstId, true);
            } else {
                // If no prompts exist at all, create one.
                addNewPrompt(); // This will also set the hash.
            }
        }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Initial call to handle routing on page load.
}

/**
 * Updates the URL hash to reflect the current prompt ID.
 * @param promptId The ID of the prompt to set in the URL.
 * @param replace If true, uses history.replaceState to avoid creating new history entries.
 */
export function updateURLHash(promptId: string | undefined, replace = false) {
    if (typeof window === "undefined" || !promptId) return;

    const newHash = `#id=${promptId}`;
    if (window.location.hash !== newHash) {
        if (replace) {
            history.replaceState(null, '', newHash);
        } else {
            window.location.hash = newHash;
        }
    }
}

// Effect to automatically update URL when selectedPromptId changes
effect(() => {
    updateURLHash(selectedPromptId.value);
});

// --- Welcome Modal Logic ---
export const hasBeenWelcomed = signal(false);

export function checkFirstVisit() {
    if (typeof window === "undefined") return;
    try {
        hasBeenWelcomed.value = !!localStorage.getItem(WELCOME_KEY);
    } catch (error) {
        console.warn("Failed to check first visit status:", error);
        hasBeenWelcomed.value = true; // Assume welcomed to avoid blocking UI
    }
}

export function markAsWelcomed() {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(WELCOME_KEY, 'true');
        hasBeenWelcomed.value = true;
    } catch (error) {
        console.warn("Failed to mark as welcomed:", error);
    }
}

// Initial checks on load
if (typeof window !== "undefined") {
    checkFirstVisit();
    initializeRouting();
}
