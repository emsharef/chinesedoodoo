import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from .env.local manually to ensure it works
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
    console.error('Missing SUPABASE_DB_URL in .env.local');
    process.exit(1);
}

const client = new Client({
    connectionString,
});

const schemaSql = `
CREATE SCHEMA IF NOT EXISTS chinese;

CREATE TABLE IF NOT EXISTS chinese.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  hsk_level INTEGER DEFAULT 1,
  pinyin_preference TEXT DEFAULT 'hidden',
  script_preference TEXT DEFAULT 'simplified',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chinese.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  difficulty_level INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chinese.vocab_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  word TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  difficulty REAL DEFAULT 0,
  stability REAL DEFAULT 0,
  retrievability REAL DEFAULT 0,
  last_review TIMESTAMPTZ,
  next_review TIMESTAMPTZ,
  repetition_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, word)
);

CREATE TABLE IF NOT EXISTS chinese.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  vocab_item_id UUID REFERENCES chinese.vocab_items(id),
  rating INTEGER NOT NULL,
  review_time TIMESTAMPTZ DEFAULT NOW()
);
`;

async function setup() {
    try {
        await client.connect();
        console.log('Connected to database');

        await client.query(schemaSql);
        console.log('Schema and tables created successfully');

    } catch (err) {
        console.error('Error setting up database:', err);
    } finally {
        await client.end();
    }
}

setup();
