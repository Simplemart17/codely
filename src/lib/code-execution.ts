import type { Language } from '@/types';

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  memoryUsage?: number;
}

export interface ExecutionOptions {
  timeout?: number; // in milliseconds
  memoryLimit?: number; // in MB
}

// Mock code execution service
// In production, this would connect to a secure sandboxed execution environment
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
    _options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    // const timeout = options.timeout || 30000; // 30 seconds default (for future use)

    try {
      // Simulate execution delay
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      // Mock execution based on language
      const result = await this.mockExecution(code, language);
      const executionTime = Date.now() - startTime;

      return {
        ...result,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown execution error',
        executionTime,
      };
    }
  }

  private async mockExecution(code: string, language: Language): Promise<Omit<ExecutionResult, 'executionTime'>> {
    // Basic code analysis for mock results
    const codeLines = code.trim().split('\n').filter(line => line.trim());
    
    if (codeLines.length === 0) {
      return {
        success: false,
        output: '',
        error: 'No code to execute',
      };
    }

    // Check for common patterns and generate appropriate output
    switch (language) {
      case 'JAVASCRIPT':
        return this.mockJavaScriptExecution(code);
      case 'PYTHON':
        return this.mockPythonExecution(code);
      case 'CSHARP':
        return this.mockCSharpExecution(code);
      default:
        return {
          success: false,
          output: '',
          error: `Unsupported language: ${language}`,
        };
    }
  }

  private mockJavaScriptExecution(code: string): Omit<ExecutionResult, 'executionTime'> {
    try {
      // Check for syntax errors
      if (code.includes('console.log')) {
        const matches = code.match(/console\.log\((.*?)\)/g);
        if (matches) {
          const outputs = matches.map(match => {
            const content = match.replace(/console\.log\((.*?)\)/, '$1');
            // Simple evaluation for demo purposes
            if (content.includes('"') || content.includes("'")) {
              return content.replace(/['"]/g, '');
            }
            if (content.includes('greet')) {
              return 'Hello, World!';
            }
            return content;
          });
          
          return {
            success: true,
            output: outputs.join('\n'),
          };
        }
      }

      if (code.includes('function')) {
        return {
          success: true,
          output: 'Function defined successfully',
        };
      }

      // Check for common errors
      if (code.includes('undefinedVariable')) {
        return {
          success: false,
          output: '',
          error: 'ReferenceError: undefinedVariable is not defined',
        };
      }

      return {
        success: true,
        output: 'Code executed successfully',
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `SyntaxError: ${error instanceof Error ? error.message : 'Invalid syntax'}`,
      };
    }
  }

  private mockPythonExecution(code: string): Omit<ExecutionResult, 'executionTime'> {
    try {
      // Check for print statements
      if (code.includes('print(')) {
        const matches = code.match(/print\((.*?)\)/g);
        if (matches) {
          const outputs = matches.map(match => {
            const content = match.replace(/print\((.*?)\)/, '$1');
            // Simple evaluation for demo purposes
            if (content.includes('"') || content.includes("'")) {
              return content.replace(/['"]/g, '');
            }
            if (content.includes('greet')) {
              return 'Hello, World!';
            }
            return content;
          });
          
          return {
            success: true,
            output: outputs.join('\n'),
          };
        }
      }

      if (code.includes('def ')) {
        return {
          success: true,
          output: 'Function defined successfully',
        };
      }

      // Check for indentation errors
      const lines = code.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('def ') || line.includes('if ') || line.includes('for ') || line.includes('while ')) {
          if (!line.endsWith(':')) {
            return {
              success: false,
              output: '',
              error: `SyntaxError: invalid syntax (line ${i + 1})`,
            };
          }
        }
      }

      return {
        success: true,
        output: 'Code executed successfully',
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `SyntaxError: ${error instanceof Error ? error.message : 'Invalid syntax'}`,
      };
    }
  }

  private mockCSharpExecution(code: string): Omit<ExecutionResult, 'executionTime'> {
    try {
      // Check for Console.WriteLine
      if (code.includes('Console.WriteLine')) {
        const matches = code.match(/Console\.WriteLine\((.*?)\)/g);
        if (matches) {
          const outputs = matches.map(match => {
            const content = match.replace(/Console\.WriteLine\((.*?)\)/, '$1');
            // Simple evaluation for demo purposes
            if (content.includes('"')) {
              return content.replace(/"/g, '');
            }
            if (content.includes('Greet')) {
              return 'Hello, World!';
            }
            return content;
          });
          
          return {
            success: true,
            output: outputs.join('\n'),
          };
        }
      }

      if (code.includes('class ') || code.includes('static ')) {
        return {
          success: true,
          output: 'Code compiled and executed successfully',
        };
      }

      // Check for missing semicolons
      const lines = code.split('\n').filter(line => line.trim());
      for (const line of lines) {
        if (line.includes('=') && !line.includes('==') && !line.trim().endsWith(';') && !line.includes('{') && !line.includes('}')) {
          return {
            success: false,
            output: '',
            error: 'CS1002: ; expected',
          };
        }
      }

      return {
        success: true,
        output: 'Code executed successfully',
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Compilation error: ${error instanceof Error ? error.message : 'Invalid syntax'}`,
      };
    }
  }

  // Format code using language-specific formatters
  async formatCode(code: string, language: Language): Promise<string> {
    // In production, this would use actual formatters like Prettier, Black, etc.
    // For now, we'll do basic formatting
    
    const lines = code.split('\n');
    const formattedLines: string[] = [];
    let indentLevel = 0;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        formattedLines.push('');
        continue;
      }
      
      // Decrease indent for closing braces/brackets
      if (trimmedLine.startsWith('}') || trimmedLine.startsWith(']') || trimmedLine.startsWith(')')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      
      // Add proper indentation
      const indent = '  '.repeat(indentLevel);
      formattedLines.push(indent + trimmedLine);
      
      // Increase indent for opening braces/brackets
      if (trimmedLine.endsWith('{') || trimmedLine.endsWith('[') || trimmedLine.endsWith('(')) {
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
