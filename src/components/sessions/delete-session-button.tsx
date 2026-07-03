'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useSessionStore } from '@/stores/session-store';

interface DeleteSessionButtonProps {
  sessionId: string;
  sessionTitle: string;
  /** Called after a successful delete (e.g. to navigate away from a detail page). */
  onDeleted?: () => void;
}

/**
 * Instructor-only. Renders a trash button that opens a confirmation dialog and,
 * on confirm, deletes the session via the store (which also removes it from the
 * list). The server action + RLS both enforce that only the owning instructor
 * can delete — this is the UI affordance.
 */
export function DeleteSessionButton({
  sessionId,
  sessionTitle,
  onDeleted,
}: DeleteSessionButtonProps) {
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteSession(sessionId);
      toast.success('Session deleted');
      setOpen(false);
      onDeleted?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete session'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={`Delete ${sessionTitle}`}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete session?</DialogTitle>
          <DialogDescription>
            &ldquo;{sessionTitle}&rdquo; and its participants, snapshots, and
            history will be permanently removed. This can&rsquo;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isDeleting}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting…' : 'Delete session'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
