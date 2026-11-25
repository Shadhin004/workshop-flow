import type { SqliteDb } from '../db/database.js';
import type { ActivityLog } from '../domain/types.js';

interface ActivityRow {
  id: number;
  action: string;
  entity_type: 'material' | 'product' | 'order';
  entity_id: number | null;
  summary: string;
  created_at: string;
}

export class ActivityRepository {
  constructor(private readonly db: SqliteDb) {}

  log(
    action: string,
    entityType: 'material' | 'product' | 'order',
    entityId: number | null,
    summary: string
  ): ActivityLog {
    const res = this.db
      .prepare(
        `INSERT INTO activity_logs (action, entity_type, entity_id, summary)
         VALUES (?, ?, ?, ?)`
      )
      .run(action, entityType, entityId, summary);

    const row = this.db
      .prepare('SELECT * FROM activity_logs WHERE id = ?')
      .get(Number(res.lastInsertRowid)) as ActivityRow;

    return {
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      summary: row.summary,
      createdAt: row.created_at,
    };
  }

  findRecent(limit = 12): ActivityLog[] {
    const rows = this.db
      .prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT ?')
      .all(limit) as ActivityRow[];

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      summary: row.summary,
      createdAt: row.created_at,
    }));
  }
}
