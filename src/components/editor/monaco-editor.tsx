'use client';

import { useEffect, useRef, useState } from 'react';
import Editor, { loader, type Monaco, OnMount, OnChange } from '@monaco-editor/react';
import type { editor as MonacoEditorNS } from 'monaco-editor';
import { useUserStore } from '@/stores/user-store';
import type { Language } from '@/types';

// CRITICAL: Tell @monaco-editor/react to use the local monaco-editor npm
// package instead of loading from CDN. This ensures y-monaco's MonacoBinding
// and the Editor share the same Monaco instance, enabling real-time CRDT sync.
// The promise lets us delay rendering the Editor until the loader is ready.
let monacoLoaderReady: Promise<void> | null = null;
if (typeof window !== 'undefined') {
  monacoLoaderReady = import('monaco-editor').then((monaco) => {
    loader.config({ monaco });
  });
}

interface MonacoEditorProps {
  /** Editor value — ignored when `collaborative` is true (Yjs manages content) */
  value: string;
  /** Change callback — ignored when `collaborative` is true */
  onChange: (value: string) => void;
  language: Language;
  readOnly?: boolean;
  height?: string | number;
  theme?: 'light' | 'dark';
  onMount?: (editor: MonacoEditorNS.IStandaloneCodeEditor) => void;
  /** When true, Yjs CRDT manages content; value/onChange are ignored */
  collaborative?: boolean;
}

const LANGUAGE_MAP: Record<Language, string> = {
  JAVASCRIPT: 'javascript',
  PYTHON: 'python',
  CSHARP: 'csharp',
};

const STARTER_TEMPLATES: Record<Language, string> = {
  JAVASCRIPT: `// JavaScript coding session
// Start writing your code here

`,

  PYTHON: `# Python coding session
# Start writing your code here

`,

  CSHARP: `// C# coding session
// Start writing your code here

using System;

class Program
{
    static void Main()
    {
        // Your code here
    }
}`,
};

export function MonacoEditor({
  value,
  onChange,
  language,
  readOnly = false,
  height = '400px',
  theme,
  onMount,
  collaborative = false,
}: MonacoEditorProps) {
  const { user } = useUserStore();
  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [isLoaderReady, setIsLoaderReady] = useState(!monacoLoaderReady);

  // Wait for the local monaco-editor package to be configured before rendering
  useEffect(() => {
    if (monacoLoaderReady) {
      monacoLoaderReady.then(() => setIsLoaderReady(true));
    }
  }, []);

  // Determine theme based on user preferences or prop
  const editorTheme = theme || user?.preferences?.theme === 'dark' ? 'vs-dark' : 'vs-light';

  // Get Monaco language identifier
  const monacoLanguage = LANGUAGE_MAP[language] || 'javascript';

  // Use provided value or minimal starter template if completely empty
  const editorValue = value || (value === '' ? STARTER_TEMPLATES[language] || '' : '');

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
    setIsEditorReady(true);

    // Alias for readability below
    const monaco = monacoInstance;

    // Configure editor options
    editor.updateOptions({
      fontSize: user?.preferences?.fontSize || 14,
      fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
      lineNumbers: 'on',
      roundedSelection: false,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      minimap: { enabled: true },
      wordWrap: 'on',
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: false,
      folding: true,
      foldingStrategy: 'indentation',
      showFoldingControls: 'always',
      unfoldOnClickAfterEndOfLine: false,
      contextmenu: true,
      mouseWheelZoom: true,
      multiCursorModifier: 'ctrlCmd',
      accessibilitySupport: 'auto',
    });

    // Configure language-specific settings
    if (monacoLanguage === 'javascript') {
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });

      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        reactNamespace: 'React',
        allowJs: true,
        typeRoots: ['node_modules/@types'],
      });
    }

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      // Save functionality (to be implemented)
      console.log('Save shortcut pressed');
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => {
      editor.trigger('keyboard', 'undo', {});
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, () => {
      editor.trigger('keyboard', 'redo', {});
    });

    // Call external onMount callback if provided
    if (onMount) {
      onMount(editor);
    }
  };

  const handleEditorChange: OnChange = (value) => {
    // In collaborative mode, Yjs manages content — skip React state updates
    if (collaborative) return;
    if (value !== undefined) {
      onChange(value);
    }
  };

  // Update editor options when user preferences change
  useEffect(() => {
    if (isEditorReady && editorRef.current && user?.preferences) {
      editorRef.current.updateOptions({
        fontSize: user.preferences.fontSize,
      });
    }
  }, [user?.preferences, isEditorReady]);

  // Update editor language when language prop changes
  useEffect(() => {
    if (isEditorReady && editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      const m = monacoRef.current;
      if (model) {
        if (collaborative) {
          // In collaborative mode, keep the same model (Yjs binding owns it)
          // Just change the language setting on the existing model
          m.editor.setModelLanguage(model, LANGUAGE_MAP[language]);
        } else {
          const monacoLanguage = LANGUAGE_MAP[language];
          // Create a new model with the new language
          const newModel = m.editor.createModel(
            model.getValue(),
            monacoLanguage
          );
          editorRef.current.setModel(newModel);

          // Dispose of the old model to prevent memory leaks
          model.dispose();
        }
      }
    }
  }, [language, isEditorReady, collaborative]);

  if (!isLoaderReady) {
    return (
      <div className="flex items-center justify-center w-full h-full border-2 border-border rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full border-2 border-border rounded-lg overflow-hidden">
      <Editor
        height={height}
        language={monacoLanguage}
        // In collaborative mode, Yjs manages content via MonacoBinding
        {...(collaborative ? {} : { value: editorValue })}
        theme={editorTheme}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          readOnly,
          selectOnLineNumbers: true,
          matchBrackets: 'always',
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          autoSurround: 'languageDefined',
          autoIndent: 'full',
          formatOnPaste: true,
          formatOnType: true,
          renderLineHighlight: 'all',
          occurrencesHighlight: 'singleFile',
          selectionHighlight: true,
          hover: {
            enabled: true,
          },
          parameterHints: {
            enabled: true,
          },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'on',
          acceptSuggestionOnCommitCharacter: true,
          snippetSuggestions: 'top',
          wordBasedSuggestions: 'currentDocument',
        }}
        loading={
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading editor...</p>
            </div>
          </div>
        }
      />
    </div>
  );
}

export default MonacoEditor;
