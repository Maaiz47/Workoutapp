import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  const filePath = path.join(process.cwd(), "qa-state.json");
  const raw = await fs.readFile(filePath, "utf-8");
  return NextResponse.json(JSON.parse(raw));
}
