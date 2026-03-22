import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const JDOODLE_API_URL = 'https://api.jdoodle.com/v1/execute';
const JDOODLE_CLIENT_ID = process.env.JDOODLE_CLIENT_ID || '';
const JDOODLE_CLIENT_SECRET = process.env.JDOODLE_CLIENT_SECRET || '';

/** Maximum allowed execution timeout (ms). */
const MAX_TIMEOUT = 15000;

/** Maximum allowed code size (bytes). */
const MAX_CODE_SIZE = 64 * 1024; // 64 KB

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExecuteRequestBody {
  language: string;
  code: string;
  stdin?: string;
  timeout?: number;
}

interface ExecuteResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  memoryUsage?: number;
}

interface JDoodleResponse {
  output: string;
  error: string | null;
  statusCode: number;
  memory: string | null;
  cpuTime: string | null;
  compilationStatus: string | null;
  isExecutionSuccess: boolean;
  isCompiled: boolean;
}

// ---------------------------------------------------------------------------
// JDoodle language mapping
// ---------------------------------------------------------------------------

const JDOODLE_LANGUAGES: Record<
  string,
  { language: string; versionIndex: string }
> = {
  javascript: { language: 'nodejs', versionIndex: '4' },
  python: { language: 'python3', versionIndex: '4' },
  csharp: { language: 'csharp', versionIndex: '4' },
};

// ---------------------------------------------------------------------------
// POST /api/execute
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check JDoodle credentials
    if (!JDOODLE_CLIENT_ID || !JDOODLE_CLIENT_SECRET) {
      return NextResponse.json(
        {
          success: false,
          output: '',
          error: 'Code execution is not configured. Set JDOODLE_CLIENT_ID and JDOODLE_CLIENT_SECRET.',
          executionTime: 0,
        },
        { status: 503 }
      );
    }

    // Parse and validate
    const body: ExecuteRequestBody = await request.json();

    if (!body.language || !body.code) {
      return NextResponse.json(
        { error: 'Missing required fields: language, code' },
        { status: 400 }
      );
    }

    if (body.code.length > MAX_CODE_SIZE) {
      return NextResponse.json(
        { error: `Code exceeds maximum size of ${MAX_CODE_SIZE} bytes` },
        { status: 400 }
      );
    }

    const langConfig = JDOODLE_LANGUAGES[body.language];
    if (!langConfig) {
      return NextResponse.json(
        { error: `Unsupported language: ${body.language}` },
        { status: 400 }
      );
    }

    const timeout = Math.min(body.timeout || 10000, MAX_TIMEOUT);

    const result = await executeWithJDoodle(body, langConfig, timeout);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('timeout') || message.includes('abort')) {
      return NextResponse.json(
        {
          success: false,
          output: '',
          error: 'Execution timed out',
          executionTime: 0,
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        output: '',
        error: 'Execution service unavailable',
        executionTime: 0,
      },
      { status: 503 }
    );
  }
}

// ---------------------------------------------------------------------------
// JDoodle backend
// ---------------------------------------------------------------------------

async function executeWithJDoodle(
  body: ExecuteRequestBody,
  langConfig: { language: string; versionIndex: string },
  timeout: number
): Promise<ExecuteResult> {
  const jdoodleBody = {
    clientId: JDOODLE_CLIENT_ID,
    clientSecret: JDOODLE_CLIENT_SECRET,
    script: body.code,
    stdin: body.stdin || '',
    language: langConfig.language,
    versionIndex: langConfig.versionIndex,
  };

  const response = await fetch(JDOODLE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jdoodleBody),
    signal: AbortSignal.timeout(timeout + 5000),
  });

  if (!response.ok) {
    throw new Error(`JDoodle error (HTTP ${response.status})`);
  }

  const result: JDoodleResponse = await response.json();
  return parseJDoodleResult(result);
}

function parseJDoodleResult(result: JDoodleResponse): ExecuteResult {
  const output = (result.output || '').trim();
  const cpuTime = result.cpuTime ? parseFloat(result.cpuTime) : 0;
  const memory = result.memory ? parseInt(result.memory, 10) : undefined;

  // Compilation error
  if (result.compilationStatus && result.compilationStatus !== 'OK') {
    return {
      success: false,
      output: '',
      error: output || 'Compilation failed',
      executionTime: cpuTime,
      memoryUsage: memory,
    };
  }

  // Runtime error
  if (result.statusCode !== 200 || !result.isExecutionSuccess) {
    const isError = result.error || !result.isExecutionSuccess;
    return {
      success: !isError,
      output: isError ? '' : output,
      error: isError
        ? output || result.error || 'Runtime error'
        : undefined,
      executionTime: cpuTime,
      memoryUsage: memory,
    };
  }

  return {
    success: true,
    output,
    executionTime: cpuTime,
    memoryUsage: memory,
  };
}
