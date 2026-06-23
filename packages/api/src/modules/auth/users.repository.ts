import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../infra/db/db.module';

export interface UserRow {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  passwordHash: string | null;
  panLast4: string | null;
  panValid: boolean;
  status: string;
  isPlatformAdmin: boolean;
}

interface UserDbRow {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  password_hash: string | null;
  pan_last4: string | null;
  pan_valid: boolean;
  status: string;
  is_platform_admin: boolean;
}

const SELECT = `id, email, phone, name, password_hash, pan_last4, pan_valid, status, is_platform_admin`;

function map(r: UserDbRow): UserRow {
  return {
    id: r.id,
    email: r.email,
    phone: r.phone,
    name: r.name,
    passwordHash: r.password_hash,
    panLast4: r.pan_last4,
    panValid: r.pan_valid,
    status: r.status,
    isPlatformAdmin: r.is_platform_admin,
  };
}

@Injectable()
export class UsersRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findByIdentifier(identifier: string): Promise<UserRow | null> {
    const { rows } = await this.pool.query<UserDbRow>(
      `SELECT ${SELECT} FROM users WHERE email = $1 OR phone = $1 LIMIT 1`,
      [identifier],
    );
    return rows[0] ? map(rows[0]) : null;
  }

  async findById(id: string): Promise<UserRow | null> {
    const { rows } = await this.pool.query<UserDbRow>(`SELECT ${SELECT} FROM users WHERE id = $1`, [id]);
    return rows[0] ? map(rows[0]) : null;
  }

  async create(input: {
    name: string;
    email: string | null;
    phone: string | null;
    passwordHash: string | null;
    status?: string;
  }): Promise<UserRow> {
    const { rows } = await this.pool.query<UserDbRow>(
      `INSERT INTO users (name, email, phone, password_hash, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${SELECT}`,
      [input.name, input.email, input.phone, input.passwordHash, input.status ?? 'ACTIVE'],
    );
    return map(rows[0]);
  }

  async setPan(id: string, panEncrypted: string, panLast4: string): Promise<void> {
    await this.pool.query(
      `UPDATE users SET pan_encrypted = $2, pan_last4 = $3, pan_valid = true WHERE id = $1`,
      [id, panEncrypted, panLast4],
    );
  }
}
