'use client';

import { useEffect, useRef } from 'react';
import type { CRDTDocument } from '@/lib/crdt/document';

/**
 * Injects dynamic CSS for remote users' cursor labels and colors
 * based on Yjs awareness state. y-monaco's MonacoBinding already
 * creates decorations with classes like:
 *   yRemoteSelection-{clientID}    — selection highlight
 *   yRemoteSelectionHead-{clientID} — cursor position
 *
 * This hook maps each clientID to its user info (name & color) and
 * generates matching CSS rules so the cursors become visible and
 * labelled with the user's name.
 */
export function useRemoteCursors(
  getDocument: () => CRDTDocument | null,
  enabled: boolean
) {
  const styleRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Create a <style> element we'll keep updated
    const style = document.createElement('style');
    style.setAttribute('data-remote-cursors', 'true');
    document.head.appendChild(style);
    styleRef.current = style;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let awareness: any = null;

    const buildStyles = () => {
      const doc = getDocument();
      if (!doc) return;

      const aw = doc.getAwareness();
      if (!aw) return;

      // Track awareness so we can unsubscribe on cleanup
      if (awareness !== aw) {
        awareness?.off('change', buildStyles);
        awareness = aw;
        awareness.on('change', buildStyles);
      }

      let css = '';
      const localClientId = aw.doc.clientID;

      aw.getStates().forEach(
        (state: Record<string, unknown>, clientId: number) => {
          if (clientId === localClientId) return;

          const user = state.user as
            | { name: string; color: string }
            | undefined;
          if (!user) return;

          const color = user.color || '#888';
          const name = user.name || 'User';
          // Escape for CSS content property
          const safeName = name
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'");

          css += `
.yRemoteSelection-${clientId} {
  background-color: ${color}33;
}
.yRemoteSelectionHead-${clientId} {
  position: relative;
  border-left: 2px solid ${color};
  border-color: ${color};
}
.yRemoteSelectionHead-${clientId}::after {
  content: '${safeName}';
  position: absolute;
  top: -1.4em;
  left: -1px;
  font-size: 0.7em;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  padding: 2px 4px;
  border-radius: 3px 3px 3px 0;
  background-color: ${color};
  color: #fff;
  pointer-events: none;
  z-index: 10;
}
`;
        }
      );

      style.textContent = css;
    };

    // Poll briefly for the document to become available after connection
    const interval = setInterval(() => {
      const doc = getDocument();
      if (doc?.getAwareness()) {
        clearInterval(interval);
        buildStyles();
      }
    }, 500);

    return () => {
      clearInterval(interval);
      awareness?.off('change', buildStyles);
      style.remove();
      styleRef.current = null;
    };
  }, [getDocument, enabled]);
}
