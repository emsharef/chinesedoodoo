import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function migrate() {
    try {
        await client.connect();
        console.log('Connected to database');

        // 1. Add target_language to profiles
        await client.query(`
      ALTER TABLE public.chinese_profiles 
      ADD COLUMN IF NOT EXISTS target_language TEXT DEFAULT 'zh-CN';
    `);
        console.log('Added target_language to profiles');

        // 2. Add language to stories
        await client.query(`
      ALTER TABLE public.chinese_stories 
      ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'zh-CN';
    `);
        console.log('Added language to stories');

        // 3. Add language to vocab items
        await client.query(`
      ALTER TABLE public.chinese_vocab_items 
      ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'zh-CN';
    `);
        console.log('Added language to vocab items');

        // 4. Backfill existing data (optional, but good for safety if defaults didn't catch everything)
        await client.query(`
      UPDATE public.chinese_profiles SET target_language = 'zh-CN' WHERE target_language IS NULL;
      UPDATE public.chinese_stories SET language = 'zh-CN' WHERE language IS NULL;
      UPDATE public.chinese_vocab_items SET language = 'zh-CN' WHERE language IS NULL;
    `);
        console.log('Backfilled existing data');

    } catch (err) {
        console.error('Error running migration:', err);
    } finally {
        await client.end();
    }
}

migrate();
