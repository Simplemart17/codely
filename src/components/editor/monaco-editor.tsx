'use client';

import { useEffect, useRef, useState } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useUserStore } from '@/stores/user-store';
import type { Language } from '@/types';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: Language;
  readOnly?: boolean;
  height?: string | number;
  theme?: 'light' | 'dark';
  onMount?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
}

const LANGUAGE_MAP: Record<Language, string> = {
  JAVASCRIPT: 'javascript',
  PYTHON: 'python',
  CSHARP: 'csharp',
};

const DEFAULT_CODE: Record<Language, string> = {
  JAVASCRIPT: `// Welcome to JavaScript!
// Try writing some code below

function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));`,
  
  PYTHON: `# Welcome to Python!
# Try writing some code below

def greet(name):
    return f"Hello, {name}!"

print(greet("World"))`,
  
  CSHARP: `// Welcome to C#!
// Try writing some code below

using System;

class Program
{
    static void Main()
    {
        string message = Greet("World");
        Console.WriteLine(message);
    }
    
    static string Greet(string name)
    {
        return $"Hello, {name}!";
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
}: MonacoEditorProps) {
  const { user } = useUserStore();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Determine theme based on user preferences or prop
  const editorTheme = theme || user?.preferences?.theme === 'dark' ? 'vs-dark' : 'vs-light';

  // Get Monaco language identifier
  const monacoLanguage = LANGUAGE_MAP[language] || 'javascript';

  // Get default code if value is empty
  const editorValue = value || DEFAULT_CODE[language] || '';

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    setIsEditorReady(true);

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

  return (
    <div className="w-full h-full border border-gray-300 rounded-lg overflow-hidden">
      <Editor
        height={height}
        language={monacoLanguage}
        value={editorValue}
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
          occurrencesHighlight: true,
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
          wordBasedSuggestions: true,
          semanticHighlighting: {
            enabled: true,
          },
        }}
        loading={
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading editor...</p>
            </div>
          </div>
        }
      />
    </div>
  );
}

export default MonacoEditor;
