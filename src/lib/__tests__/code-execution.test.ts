import { CodeExecutionService, codeExecutionService } from '../code-execution';
import type { Language } from '@/types';
import { runJavaScriptInBrowser } from '../execution/js-runner';
import { runPythonInBrowser } from '../execution/py-runner';

// All supported languages run in-browser via Web Workers; mock the runners so
// we can assert dispatch without a real Worker (jsdom has none).
jest.mock('../execution/js-runner', () => ({
  runJavaScriptInBrowser: jest.fn(),
}));
jest.mock('../execution/py-runner', () => ({
  runPythonInBrowser: jest.fn(),
}));

const mockRunJs = runJavaScriptInBrowser as jest.MockedFunction<
  typeof runJavaScriptInBrowser
>;
const mockRunPy = runPythonInBrowser as jest.MockedFunction<
  typeof runPythonInBrowser
>;

describe('CodeExecutionService', () => {
  let service: CodeExecutionService;

  beforeEach(() => {
    service = CodeExecutionService.getInstance();
    mockRunJs.mockReset();
    mockRunPy.mockReset();
  });

  describe('In-browser execution', () => {
    it('runs JavaScript in the browser', async () => {
      mockRunJs.mockResolvedValueOnce({
        success: true,
        output: 'Hello, World!',
        streams: [{ type: 'stdout', content: 'Hello, World!' }],
        executionTime: 5,
      });

      const result = await service.executeCode(
        'console.log("Hello, World!");',
        'JAVASCRIPT'
      );

      expect(mockRunJs).toHaveBeenCalledWith(
        'console.log("Hello, World!");',
        expect.any(Number)
      );
      expect(mockRunPy).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello, World!');
      expect(result.streams).toEqual([
        { type: 'stdout', content: 'Hello, World!' },
      ]);
    });

    it('runs Python in the browser', async () => {
      mockRunPy.mockResolvedValueOnce({
        success: true,
        output: 'Hello',
        streams: [{ type: 'stdout', content: 'Hello' }],
        executionTime: 9,
      });

      const result = await service.executeCode('print("Hello")', 'PYTHON');

      expect(mockRunPy).toHaveBeenCalledWith('print("Hello")', undefined);
      expect(mockRunJs).not.toHaveBeenCalled();
      expect(result.output).toBe('Hello');
    });

    it('passes a custom timeout through to the JS runner', async () => {
      mockRunJs.mockResolvedValueOnce({
        success: true,
        output: '',
        streams: [],
        executionTime: 1,
      });

      await service.executeCode('1 + 1', 'JAVASCRIPT', { timeout: 5000 });

      expect(mockRunJs).toHaveBeenCalledWith('1 + 1', 5000);
    });

    it('surfaces a failed run with its captured streams', async () => {
      mockRunPy.mockResolvedValueOnce({
        success: false,
        output: 'before crash',
        streams: [{ type: 'stdout', content: 'before crash' }],
        error: 'Traceback ... ZeroDivisionError',
        executionTime: 7,
      });

      const result = await service.executeCode('1/0', 'PYTHON');

      expect(result.success).toBe(false);
      expect(result.error).toContain('ZeroDivisionError');
      expect(result.streams).toEqual([
        { type: 'stdout', content: 'before crash' },
      ]);
    });
  });

  describe('Input validation', () => {
    it('should handle empty code', async () => {
      const result = await service.executeCode('', 'JAVASCRIPT');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No code to execute');
      expect(mockRunJs).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only code', async () => {
      const result = await service.executeCode('   \n  \t  ', 'JAVASCRIPT');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No code to execute');
      expect(mockRunJs).not.toHaveBeenCalled();
    });

    it('should handle unsupported language', async () => {
      const result = await service.executeCode(
        'print("test")',
        'UNSUPPORTED' as Language
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported language');
      expect(mockRunJs).not.toHaveBeenCalled();
      expect(mockRunPy).not.toHaveBeenCalled();
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
});
