import type { Language } from '@/types';

/** A single line of program output, tagged with its stream. */
export interface OutputStream {
  type: 'stdout' | 'stderr';
  content: string;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  /** Ordered, level-tagged output lines from the in-browser runner. */
  streams?: OutputStream[];
  error?: string;
  executionTime: number;
}

export interface ExecutionOptions {
  timeout?: number; // in milliseconds
}

/**
 * Code Execution Service
 *
 * Runs code entirely in the browser via Web Workers (JavaScript) and Pyodide
 * (Python) — no external execution API.
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

    // All supported languages execute fully in the browser (Web Worker) — no
    // external service. Execution is therefore unavailable during SSR.
    if (typeof window === 'undefined') {
      return {
        success: false,
        output: '',
        error: 'Code execution is only available in the browser',
        executionTime: Date.now() - startTime,
      };
    }

    if (language === 'JAVASCRIPT') {
      const { runJavaScriptInBrowser } = await import('./execution/js-runner');
      return runJavaScriptInBrowser(trimmed, options.timeout ?? 10000);
    }

    if (language === 'PYTHON') {
      const { runPythonInBrowser } = await import('./execution/py-runner');
      return runPythonInBrowser(trimmed, options.timeout);
    }

    return {
      success: false,
      output: '',
      error: `Unsupported language: ${language}`,
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Format code — basic indentation formatter.
   * In production this would call Prettier / Black.
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

      // For brace languages (JavaScript), ensure space before opening brace
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
