import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const [hashed, salt] = hash.split(".");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    const stored = Buffer.from(hashed, "hex");
    if (buf.length !== stored.length) return false;
    return timingSafeEqual(buf, stored);
  } catch { return false; }
}

export function generateTempPassword(): string {
  return randomBytes(5).toString("hex").toUpperCase();
}
