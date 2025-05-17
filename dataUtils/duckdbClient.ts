// lib/data/duckdbClient.ts

import duckdb from 'duckdb';

let dbInstance: duckdb.Database | null = null;

export function getDuckDB(): duckdb.Database {
  if (dbInstance) return dbInstance;

  dbInstance = new duckdb.Database(':memory:'); // Banco em memória
  return dbInstance;
}
