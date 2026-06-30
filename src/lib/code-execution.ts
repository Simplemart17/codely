import type { Language } from '@/types';

/** A single line of program output, tagged with its stream. */
export interface OutputStream {
  type: 'stdout' | 'stderr';
  content: string;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  /**
   * Ordered, level-tagged output lines, when the backend can distinguish
   * stdout from stderr (the in-browser runner). Absent for backends that only
   * return a single blob — render `output` as stdout in that case.
   */
  streams?: OutputStream[];
  error?: string;
  executionTime: number;
  memoryUsage?: number;
}

export interface ExecutionOptions {
  timeout?: number; // in milliseconds
  memoryLimit?: number; // in MB
  stdin?: string;
}

const LANGUAGE_MAP: Record<Language, string> = {
  JAVASCRIPT: 'javascript',
  PYTHON: 'python',
  CSHARP: 'csharp',
};

/**
 * Code Execution Service
 *
 * Sends code to the server-side `/api/execute` route which proxies
 * to the JDoodle code execution API.
 */
export class CodeExecutionService {
  private static instance: CodeExecutionService;

  public static getInstance(): CodeExecutionService {
    if (!CodeExecutionService.instance) {
      CodeExecutionService.instance = new CodeExecutionService();
    }
    return CodeExecutionService.instance;
  }

  async executeCode(
    code: string,
    language: Language,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Quick validation
    const trimmed = code.trim();
    if (!trimmed) {
      return {
        success: false,
        output: '',
        error: 'No code to execute',
        executionTime: Date.now() - startTime,
      };
    }

    const langId = LANGUAGE_MAP[language];
    if (!langId) {
      return {
        success: false,
        output: '',
        error: `Unsupported language: ${language}`,
        executionTime: Date.now() - startTime,
      };
    }

    // JavaScript executes fully in the browser (Web Worker) — no external
    // service. Other languages still proxy to the `/api/execute` route.
    if (language === 'JAVASCRIPT' && typeof window !== 'undefined') {
      const { runJavaScriptInBrowser } = await import('./execution/js-runner');
      return runJavaScriptInBrowser(trimmed, options.timeout ?? 10000);
    }

    const response = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: langId,
        code: trimmed,
        stdin: options.stdin || '',
        timeout: options.timeout || 10000,
        memoryLimit: options.memoryLimit,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        output: '',
        error: data.error || `Execution failed (HTTP ${response.status})`,
        executionTime: Date.now() - startTime,
      };
    }

    return {
      success: data.success,
      output: data.output || '',
      error: data.error || undefined,
      executionTime: data.executionTime || Date.now() - startTime,
      memoryUsage: data.memoryUsage,
    };
  }

  /**
   * Format code — basic indentation formatter.
   * In production this would call Prettier / Black / dotnet-format.
   */
  async formatCode(code: string, language: Language): Promise<string> {
    const lines = code.split('\n');
    const formattedLines: string[] = [];
    let indentLevel = 0;

    for (const line of lines) {
      let trimmedLine = line.trim();

      if (!trimmedLine) {
        formattedLines.push('');
        continue;
      }

      // For C-style languages, ensure space before opening brace
      if (language !== 'PYTHON') {
        trimmedLine = trimmedLine.replace(/(\S)\{/g, '$1 {');
      }

      // Decrease indent for closing braces/brackets
      if (
        trimmedLine.startsWith('}') ||
        trimmedLine.startsWith(']') ||
        trimmedLine.startsWith(')')
      ) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // Add proper indentation
      const indent = '  '.repeat(indentLevel);
      formattedLines.push(indent + trimmedLine);

      // Increase indent for opening braces/brackets
      if (
        trimmedLine.endsWith('{') ||
        trimmedLine.endsWith('[') ||
        trimmedLine.endsWith('(')
      ) {
        indentLevel++;
      }

      // Language-specific indentation rules
      if (language === 'PYTHON') {
        if (trimmedLine.endsWith(':')) {
          indentLevel++;
        }
      }
    }

    return formattedLines.join('\n');
  }
}

export const codeExecutionService = CodeExecutionService.getInstance();
