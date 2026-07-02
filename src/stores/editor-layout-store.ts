import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Where the output console is docked relative to the editor. */
export type ConsolePosition = 'right' | 'bottom';

interface EditorLayoutState {
  /** Dock side of the output console. Panel sizes are persisted separately by
   *  react-resizable-panels via each PanelGroup's `autoSaveId`. */
  consolePosition: ConsolePosition;
  setConsolePosition: (position: ConsolePosition) => void;
  toggleConsolePosition: () => void;
}

export const useEditorLayoutStore = create<EditorLayoutState>()(
  persist(
    (set) => ({
      consolePosition: 'right',
      setConsolePosition: (consolePosition) => set({ consolePosition }),
      toggleConsolePosition: () =>
        set((state) => ({
          consolePosition:
            state.consolePosition === 'right' ? 'bottom' : 'right',
        })),
    }),
    { name: 'codely-editor-layout' }
  )
);
