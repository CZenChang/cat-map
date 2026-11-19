import { onMounted, onUnmounted } from 'vue';

/**
 * Attaches light-dismiss fallback for browsers without native <dialog closedby="any"> (e.g. Safari).
 */
export function useDialogLightDismiss(dialogRef, onClose) {
  let pressedOutside = false;

  const isOutside = (event, dialog) => {
    const rect = dialog.getBoundingClientRect();
    return (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    );
  };

  const handlePointerDown = (event) => {
    const dialog = dialogRef.value;
    if (!dialog || !dialog.open) return;
    pressedOutside = isOutside(event, dialog);
  };

  const handlePointerUp = (event) => {
    const dialog = dialogRef.value;
    if (!dialog || !dialog.open) return;
    if (pressedOutside && isOutside(event, dialog)) {
      dialog.close();
      onClose?.();
    }
    pressedOutside = false;
  };

  onMounted(() => {
    const dialog = dialogRef.value;
    if (!dialog) return;
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dialog.addEventListener('pointerdown', handlePointerDown);
      dialog.addEventListener('pointerup', handlePointerUp);
    }
  });

  onUnmounted(() => {
    const dialog = dialogRef.value;
    if (!dialog) return;
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dialog.removeEventListener('pointerdown', handlePointerDown);
      dialog.removeEventListener('pointerup', handlePointerUp);
    }
  });
}
