'use client';

import { useActionState, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteMedication, type ActionState } from '@/app/actions/medications';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/field';

export function DeleteMedication({ id, name }: { id: string; name: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(deleteMedication, {});
  const [confirming, setConfirming] = useState(false);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={id} />

      {confirming ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            Delete <span className="text-ink">{name}</span> and its dose history? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? 'Deleting…' : 'Delete permanently'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
          <Trash2 className="size-4" />
          Delete medication
        </Button>
      )}

      <FormError>{state.error}</FormError>
    </form>
  );
}
