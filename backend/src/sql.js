import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../dbms/04_queries.sql');

export function loadQueries(filePath = file) {
  const queries = {};
  const meta = {};
  let id = null;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const header = line.match(/^-- ([RW]\d+) \| (READ|WRITE) \| (.*)$/);
    if (header) {
      id = header[1];
      queries[id] = '';
      meta[id] = { type: header[2], title: header[3] };
    } else if (id && !line.startsWith('--')) {
      queries[id] += line + '\n';
    }
  }
  for (const key of Object.keys(queries)) {
    queries[key] = queries[key].trim().replace(/;$/, '');
  }
  return { queries, meta };
}

export const sql = loadQueries().queries;
