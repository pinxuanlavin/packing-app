import { NextResponse } from "next/server";
import { fetchReadyOrders } from "@/lib/shopee";
import { upsertOrders, getAllOrders, initDb } from "@/lib/db";

export async function POST() {
  try {
    await initDb();
    console.log("开始同步...");
    const orders = await fetchReadyOrders();
    console.log("订单数:", orders.length);
    await upsertOrders(orders);
    return NextResponse.json({ ok: true, count: orders.length });
  } catch (e: any) {
    console.error("同步错误:", e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await initDb();
    const orders = await getAllOrders();
    return NextResponse.json({ ok: true, orders });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
