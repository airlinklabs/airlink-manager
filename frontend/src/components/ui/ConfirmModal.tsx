import { Button } from "./Button.tsx";
import { Modal } from "./Modal.tsx";

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  message,
  onConfirm
}: {
  open: boolean;
  onOpenChange(value: boolean): void;
  title: string;
  message: string;
  onConfirm(): void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title}>
      <p className="text-sm text-[var(--theme-text-body)]">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          Confirm
        </Button>
      </div>
    </Modal>
  );
}
