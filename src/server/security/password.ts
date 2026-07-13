import bcrypt from 'bcryptjs';

const COST_FACTOR = 12;

export async function hashPassword(password: string, pepper: string) {
  return bcrypt.hash(`${password}${pepper}`, COST_FACTOR);
}

export async function verifyPassword(password: string, hash: string, pepper: string) {
  return bcrypt.compare(`${password}${pepper}`, hash);
}
