import { CodeExecutionService, codeExecutionService } from '../code-execution';

describe('CodeExecutionService', () => {
  let service: CodeExecutionService;

  beforeEach(() => {
    service = CodeExecutionService.getInstance();
  });

  describe('JavaScript execution', () => {
    it('should execute console.log statements', async () => {
      const code = 'console.log("Hello, World!");';
      const result = await service.executeCode(code, 'JAVASCRIPT');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello, World!');
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle function definitions', async () => {
      const code = `
        function greet(name) {
          return "Hello, " + name;
        }
      `;
      const result = await service.executeCode(code, 'JAVASCRIPT');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Function defined successfully');
    });

    it('should detect reference errors', async () => {
      const code = 'console.log(undefinedVariable);';
      const result = await service.executeCode(code, 'JAVASCRIPT');

      expect(result.success).toBe(false);
      expect(result.error).toContain('ReferenceError');
    });

    it('should handle multiple console.log statements', async () => {
      const code = `
        console.log("First line");
        console.log("Second line");
      `;
      const result = await service.executeCode(code, 'JAVASCRIPT');

      expect(result.success).toBe(true);
      expect(result.output).toContain('First line');
      expect(result.output).toContain('Second line');
    });
  });

  describe('Python execution', () => {
    it('should execute print statements', async () => {
      const code = 'print("Hello, Python!")';
      const result = await service.executeCode(code, 'PYTHON');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello, Python!');
    });

    it('should handle function definitions', async () => {
      const code = `
def greet(name):
    return f"Hello, {name}"
      `;
      const result = await service.executeCode(code, 'PYTHON');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Function defined successfully');
    });

    it('should detect syntax errors', async () => {
      const code = 'if True\n    print("Missing colon")';
      const result = await service.executeCode(code, 'PYTHON');

      expect(result.success).toBe(false);
      expect(result.error).toContain('SyntaxError');
    });

    it('should handle multiple print statements', async () => {
      const code = `
print("First line")
print("Second line")
      `;
      const result = await service.executeCode(code, 'PYTHON');

      expect(result.success).toBe(true);
      expect(result.output).toContain('First line');
      expect(result.output).toContain('Second line');
    });
  });

  describe('C# execution', () => {
    it('should execute Console.WriteLine statements', async () => {
      const code = 'Console.WriteLine("Hello, C#!");';
      const result = await service.executeCode(code, 'CSHARP');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello, C#!');
    });

    it('should handle class and method definitions', async () => {
      const code = `
class Program {
    static void Main() {
        Console.WriteLine("Hello World");
    }
}
      `;
      const result = await service.executeCode(code, 'CSHARP');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Code compiled and executed successfully');
    });

    it('should detect missing semicolons', async () => {
      const code = 'string message = "Hello"';
      const result = await service.executeCode(code, 'CSHARP');

      expect(result.success).toBe(false);
      expect(result.error).toContain('CS1002');
    });
  });

  describe('Error handling', () => {
    it('should handle empty code', async () => {
      const result = await service.executeCode('', 'JAVASCRIPT');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No code to execute');
    });

    it('should handle whitespace-only code', async () => {
      const result = await service.executeCode('   \n  \t  ', 'JAVASCRIPT');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No code to execute');
    });

    it('should handle unsupported language', async () => {
      // @ts-expect-error Testing unsupported language
      const result = await service.executeCode('print("test")', 'UNSUPPORTED');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported language');
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
    it('should respect timeout option', async () => {
      const code = 'console.log("test");';
      const result = await service.executeCode(code, 'JAVASCRIPT', { timeout: 5000 });

      expect(result.success).toBe(true);
      expect(result.executionTime).toBeLessThan(5000);
    });

    it('should handle memory limit option', async () => {
      const code = 'console.log("test");';
      const result = await service.executeCode(code, 'JAVASCRIPT', { memoryLimit: 128 });

      expect(result.success).toBe(true);
    });
  });
});
