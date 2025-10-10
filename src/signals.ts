import { computed, Signal } from "@preact/signals";
import { createStorageKeysSignal, createStorageSignal } from "./util/signalutil/storage";
import { createHashParamSignal } from "./util/signalutil/hashparamsignal";
import { withWriteFunction } from "./util/signalutil/writablesignal";
import { createPostMessagePromptSignal, ShouldUsePostMessage } from "./postmessage";

// --- Interfaces ---
export interface Prompt {
	id: string;
	text: string;
	archived?: boolean;
}

// --- Constants ---
const PROMPT_PREFIX = "prompt/";

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
export const selectedPrompt: Signal<Prompt | undefined> = ShouldUsePostMessage ?
  createPostMessagePromptSignal()
: withWriteFunction(
  computed<Prompt | undefined>(() => {
    const id = selectedPromptId.value;
    return id ? getPrompt(id).value : undefined;
  }),
  (newPrompt: Prompt | undefined) => {
    if (newPrompt) {
      const promptSignal = getPrompt(newPrompt.id);
      selectedPromptId.value = newPrompt.id;
      promptSignal.value = newPrompt;
    } else {
      selectedPromptId.value = undefined;
    }
  },
);

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
    const prompt = createStorageSignal<Prompt>(PROMPT_PREFIX + id, { id, text: '' }, {
      parse: parsePrompt,
      serialize: serializePrompt
    });
    promptSignals.set(id, prompt);
    promptSignal = prompt;
	}
	return promptSignal;
}

/**
 * Creates a new, empty prompt and selects it.
 */
export function addNewPrompt() {
	const newId = crypto.randomUUID();
	try {
		// Create a signal for the new prompt
		const prompt = getPrompt(newId);
		// Set it as the selected prompt, which will update the URL hash
		selectedPromptId.value = newId;
    // Set the value of the prompt signal
		prompt.value = { ...prompt.value, text: '' };

	} catch (error) {
		console.error("Failed to create new prompt:", error);
	}
}
