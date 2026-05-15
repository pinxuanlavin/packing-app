import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`
    CREATE TABLE IF NOT EXISTS shopee_tokens (
      shop_id       INTEGER PRIMARY KEY,
      access_token  TEXT,
      refresh_token TEXT,
      updated_at    INTEGER
    )
  `;
  // SG - 只在没有记录时初始化
  await sql`
    INSERT INTO shopee_tokens (shop_id, access_token, refresh_token, updated_at)
    VALUES (209859170, ${process.env.SHOPEE_ACCESS_TOKEN}, ${process.env.SHOPEE_REFRESH_TOKEN}, ${Math.floor(Date.now()/1000)})
    ON CONFLICT (shop_id) DO NOTHING
  `;
  // TH - 只在没有记录时初始化
  await sql`
    INSERT INTO shopee_tokens (shop_id, access_token, refresh_token, updated_at)
    VALUES (1778322972, '', ${process.env.SHOPEE_REFRESH_TOKEN_TH}, ${Math.floor(Date.now()/1000)})
    ON CONFLICT (shop_id) DO NOTHING
  `;
  const rows = await sql`SELECT shop_id, updated_at FROM shopee_tokens`;
  return NextResponse.json({ ok: true, message: "初始化完成", tokens: rows });
}
