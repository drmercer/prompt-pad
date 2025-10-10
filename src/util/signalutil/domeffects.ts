import { effect, type ReadonlySignal } from "@preact/signals";

/**
 * Shows or hides a modal dialog based on the value of a boolean signal.
 * @param sig A ReadOnlySignal<boolean> that determines modal visibility.
 * @param modal The HTMLDialogElement to control.
 */
export function showModalFromSignal(sig: ReadonlySignal<boolean>, modal: HTMLDialogElement | null): void {
	if (!modal) return;
	effect(() => {
		if (sig.value) {
			if (!modal.open) modal.showModal();
		} else {
			if (modal.open) modal.close();
		}
	});
}
