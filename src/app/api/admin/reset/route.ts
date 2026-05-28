import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function POST() {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const result = await sql`
      UPDATE orders
      SET status='pending', worker='', packed_at=NULL,
          review_status='', review_comment='', reviewed_by='',
          reviewed_at=NULL, photos_json='[]'
      WHERE status IN ('packed', 'rejected')
      RETURNING order_sn
    `;
    return NextResponse.json({ ok: true, reset: result.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
