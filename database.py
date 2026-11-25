"""SQLite adapter for the parameterized queries shared with PostgreSQL."""
import json
import sqlite3
from datetime import date
from pathlib import Path


class SQLiteCursor:
    def __init__(self, cursor):
        self.cursor = cursor

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.cursor.close()

    def execute(self, sql, params=()):
        values = tuple(json.dumps(v) if isinstance(v, list) else
                       v.isoformat() if isinstance(v, date) else v for v in params)
        self.cursor.execute(sql.replace('%s', '?'), values)
        return self

    @staticmethod
    def convert(row):
        if row is None:
            return None
        result = dict(row)
        if 'hours' in result:
            result['hours'] = json.loads(result['hours'])
        if 'day' in result:
            result['day'] = date.fromisoformat(result['day'])
        return result

    def fetchone(self):
        return self.convert(self.cursor.fetchone())

    def fetchall(self):
        return [self.convert(row) for row in self.cursor.fetchall()]


class SQLiteConnection(sqlite3.Connection):
    def cursor(self):
        return SQLiteCursor(super().cursor())


def connect_sqlite(path):
    if sqlite3.sqlite_version_info < (3, 35, 0):
        raise RuntimeError('SQLite 3.35 ou superior é necessário.')
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=15, factory=SQLiteConnection)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    return conn
