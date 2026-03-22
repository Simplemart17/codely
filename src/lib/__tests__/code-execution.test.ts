import { CodeExecutionService, codeExecutionService } from '../code-execution';
import type { Language } from '@/types';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('CodeExecutionService', () => {
  let service: CodeExecutionService;

  beforeEach(() => {
    service = CodeExecutionService.getInstance();
    mockFetch.mockReset();
  });

  // Helper: simulate a successful API response
  function mockApiSuccess(stdout: string, stderr = '') {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: !stderr,
        output: stdout,
        error: stderr || undefined,
        executionTime: 42,
        memoryUsage: 1024,
      }),
    });
  }

  // Helper: simulate an API error
  function mockApiError(status: number, error: string) {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status,
      json: async () => ({ error }),
    });
  }

  describe('API-based execution', () => {
    it('should send correct request to /api/execute', async () => {
      mockApiSuccess('Hello, World!');

      const result = await service.executeCode(
        'console.log("Hello, World!");',
        'JAVASCRIPT'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/execute',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const body = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body.language).toBe('javascript');
      expect(body.code).toBe('console.log("Hello, World!");');

      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello, World!');
      expect(result.executionTime).toBe(42);
    });

    it('should handle API error responses', async () => {
      mockApiError(502, 'Execution engine error');

      const result = await service.executeCode(
        'console.log("test");',
        'JAVASCRIPT'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution engine error');
    });

    it('should handle stderr in API response', async () => {
      mockApiSuccess('', 'ReferenceError: x is not defined');

      const result = await service.executeCode(
        'console.log(x);',
        'JAVASCRIPT'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('ReferenceError: x is not defined');
    });

    it('should pass stdin and timeout options', async () => {
      mockApiSuccess('42');

      await service.executeCode('process.stdin', 'JAVASCRIPT', {
        stdin: '42',
        timeout: 5000,
      });

      const body = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body.stdin).toBe('42');
      expect(body.timeout).toBe(5000);
    });

    it('should map PYTHON language correctly', async () => {
      mockApiSuccess('Hello');

      await service.executeCode('print("Hello")', 'PYTHON');

      const body = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body.language).toBe('python');
    });

    it('should map CSHARP language correctly', async () => {
      mockApiSuccess('Hello');

      await service.executeCode('Console.WriteLine("Hello");', 'CSHARP');

      const body = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body.language).toBe('csharp');
    });

    it('should propagate network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        service.executeCode(
          'console.log("Hello, World!");',
          'JAVASCRIPT'
        )
      ).rejects.toThrow('Network error');
    });
  });

  describe('Input validation', () => {
    it('should handle empty code', async () => {
      const result = await service.executeCode('', 'JAVASCRIPT');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No code to execute');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only code', async () => {
      const result = await service.executeCode('   \n  \t  ', 'JAVASCRIPT');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No code to execute');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle unsupported language', async () => {
      const result = await service.executeCode(
        'print("test")',
        'UNSUPPORTED' as Language
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported language');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Code formatting', () => {
    it('should format JavaScript code', async () => {
      const code = `
function test(){
console.log("unformatted");
}
      `;
      const formatted = await service.formatCode(code, 'JAVASCRIPT');

      expect(formatted).toContain('function test() {');
      expect(formatted).toContain('  console.log("unformatted");');
      expect(formatted).toContain('}');
    });

    it('should format Python code with proper indentation', async () => {
      const code = `
def test():
print("unformatted")
      `;
      const formatted = await service.formatCode(code, 'PYTHON');

      expect(formatted).toContain('def test():');
      expect(formatted).toContain('  print("unformatted")');
    });

    it('should format C# code', async () => {
      const code = `
class Test{
public void Method(){
Console.WriteLine("test");
}
}
      `;
      const formatted = await service.formatCode(code, 'CSHARP');

      expect(formatted).toContain('class Test {');
      expect(formatted).toContain('  public void Method() {');
      expect(formatted).toContain('    Console.WriteLine("test");');
    });

    it('should handle empty lines in formatting', async () => {
      const code = `
function test() {

  console.log("test");

}
      `;
      const formatted = await service.formatCode(code, 'JAVASCRIPT');

      expect(formatted).toContain('function test() {');
      expect(formatted).toContain('');
      expect(formatted).toContain('  console.log("test");');
    });
  });

  describe('Singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = CodeExecutionService.getInstance();
      const instance2 = CodeExecutionService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should use the exported singleton', () => {
      const instance = CodeExecutionService.getInstance();
      expect(codeExecutionService).toBe(instance);
    });
  });

  describe('Execution options', () => {
    it('should pass timeout option to API', async () => {
      mockApiSuccess('test');

      await service.executeCode('console.log("test");', 'JAVASCRIPT', {
        timeout: 5000,
      });

      const body = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body.timeout).toBe(5000);
    });

    it('should pass memory limit option to API', async () => {
      mockApiSuccess('test');

      await service.executeCode('console.log("test");', 'JAVASCRIPT', {
        memoryLimit: 128,
      });

      const body = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body.memoryLimit).toBe(128);
    });
  });
});
