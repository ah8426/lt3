import { z } from 'zod';

/**
 * Environment variable validation schema
 * Validates all required environment variables on application startup
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Encryption
  ENCRYPTION_MASTER_KEY: z.string().min(32, 'ENCRYPTION_MASTER_KEY must be at least 32 characters'),

  // Redis (Upstash)
  UPSTASH_REDIS_REST_URL: z.string().url('UPSTASH_REDIS_REST_URL must be a valid URL').optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // AI Providers (all optional, but at least one should be configured)
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),

  // ASR Providers (all optional, but at least one should be configured)
  DEEPGRAM_API_KEY: z.string().optional(),
  ASSEMBLYAI_API_KEY: z.string().optional(),
  GOOGLE_CLOUD_API_KEY: z.string().optional(),

  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables
 * Throws detailed error if validation fails
 */
export function validateEnv(): Env {
  try {
    const validated = envSchema.parse(process.env);

    // Additional validation: ensure at least one AI provider is configured
    const hasAIProvider = !!(
      validated.ANTHROPIC_API_KEY ||
      validated.OPENAI_API_KEY ||
      validated.GOOGLE_GENERATIVE_AI_API_KEY
    );

    if (!hasAIProvider) {
      console.warn(
        '⚠️  WARNING: No AI provider API keys configured. ' +
        'Please set at least one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY'
      );
    }

    // Additional validation: ensure at least one ASR provider is configured
    const hasASRProvider = !!(
      validated.DEEPGRAM_API_KEY ||
      validated.ASSEMBLYAI_API_KEY ||
      validated.GOOGLE_CLOUD_API_KEY
    );

    if (!hasASRProvider) {
      console.warn(
        '⚠️  WARNING: No ASR provider API keys configured. ' +
        'Please set at least one of: DEEPGRAM_API_KEY, ASSEMBLYAI_API_KEY, or GOOGLE_CLOUD_API_KEY'
      );
    }

    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((err) => {
        return `  - ${err.path.join('.')}: ${err.message}`;
      });

      throw new Error(
        '\n❌ Environment variable validation failed:\n\n' +
        missingVars.join('\n') +
        '\n\nPlease check your .env file and ensure all required variables are set.\n'
      );
    }
    throw error;
  }
}

/**
 * Get validated environment variables
 * Returns cached result after first validation
 */
let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}

/**
 * Check if a specific environment variable is set
 */
export function hasEnvVar(key: keyof Env): boolean {
  const env = getEnv();
  return !!env[key];
}

/**
 * Safely get an environment variable (returns undefined if not set)
 */
export function getEnvVar<K extends keyof Env>(key: K): Env[K] | undefined {
  try {
    const env = getEnv();
    return env[key];
  } catch {
    return undefined;
  }
}

/**
 * Print environment validation status (for debugging)
 */
export function printEnvStatus(): void {
  try {
    const env = getEnv();
    console.log('✅ Environment validation passed');
    console.log('📦 Configuration:');
    console.log(`  - Node Environment: ${env.NODE_ENV}`);
    console.log(`  - Database: ${env.DATABASE_URL ? '✓' : '✗'}`);
    console.log(`  - Supabase: ${env.NEXT_PUBLIC_SUPABASE_URL ? '✓' : '✗'}`);
    console.log(`  - Encryption Key: ${env.ENCRYPTION_MASTER_KEY ? '✓' : '✗'}`);
    console.log(`  - Redis: ${env.UPSTASH_REDIS_REST_URL ? '✓' : '✗'}`);
    console.log('  AI Providers:');
    console.log(`    - Anthropic: ${env.ANTHROPIC_API_KEY ? '✓' : '✗'}`);
    console.log(`    - OpenAI: ${env.OPENAI_API_KEY ? '✓' : '✗'}`);
    console.log(`    - Google: ${env.GOOGLE_GENERATIVE_AI_API_KEY ? '✓' : '✗'}`);
    console.log('  ASR Providers:');
    console.log(`    - Deepgram: ${env.DEEPGRAM_API_KEY ? '✓' : '✗'}`);
    console.log(`    - AssemblyAI: ${env.ASSEMBLYAI_API_KEY ? '✓' : '✗'}`);
    console.log(`    - Google Cloud: ${env.GOOGLE_CLOUD_API_KEY ? '✓' : '✗'}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
      process.exit(1);
    }
  }
}
