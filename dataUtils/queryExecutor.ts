import { getDuckDB } from './duckdbClient';
import * as path from 'path';

export async function runQueryOnCSV({
  csvPath,
  tableName,
  query
}: {
  csvPath: string;
  tableName: string;
  query: string;
}): Promise<any[]> {
  const db = getDuckDB();
  const fullPath = path.resolve(csvPath);

  const conn = db.connect();

  // Registra o CSV como tabela temporária
  await new Promise<void>((resolve, reject) => {
    conn.run(
      `CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_csv_auto('${fullPath}', HEADER=true);`,
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });

  const result: any[] = await new Promise((resolve, reject) => {
    conn.all(query, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  conn.close();
  return result;
}
