import { NextResponse } from "next/server";
import { updateOrderReview } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { order_sn, pass, comment, reviewer } = await request.json();
    updateOrderReview(order_sn, pass, comment ?? "", reviewer);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
