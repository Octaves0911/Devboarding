import { useEffect } from 'react';
import { X } from 'lucide-react';
import Button from './Button';

/**
 * ConfirmModal — generic confirmation dialog.
 *
 * Props:
 *   open        boolean
 *   title       string
 *   message     string | ReactNode
 *   confirmLabel string  (default "Confirm")
 *   variant      "danger" | "primary"  (default "danger")
 *   loading      boolean
 *   onConfirm   () => void
 *   onCancel    () => void
 */
export default function ConfirmModal({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative z-10 bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 ml-4 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {message && (
          <p className="text-sm text-gray-600 mb-5">{message}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant={variant} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
