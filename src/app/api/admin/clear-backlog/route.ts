import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function POST() {
  try {
    const sql = neon(process.env.DATABASE_URL!);

    // 昨天14:00之前的未完成订单视为积压
    const yc = new Date();
    yc.setDate(yc.getDate() - 1);
    yc.setHours(14, 0, 0, 0);
    const cutoff = Math.floor(yc.getTime() / 1000);

    const result = await sql`
      UPDATE orders
      SET status = 'shipped_unreviewed'
      WHERE status = 'pending'
      AND create_time < ${cutoff}
      RETURNING order_sn
    `;

    return NextResponse.json({ ok: true, cleared: result.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
