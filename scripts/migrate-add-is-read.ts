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

        await client.query(`
      ALTER TABLE public.chinese_stories 
      ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
    `);

        console.log('Column is_read added successfully');

    } catch (err) {
        console.error('Error running migration:', err);
    } finally {
        await client.end();
    }
}

migrate();
