import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

// E2Eテストでも、アプリ本体と同じルート .env を読み込む。
config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
