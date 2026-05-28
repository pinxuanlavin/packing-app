import { NextResponse } from "next/server";
import { updateOrderPacked } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { order_sn, worker, photos } = await request.json();
    await updateOrderPacked(order_sn, worker, photos);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
