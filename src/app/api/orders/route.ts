import { NextResponse } from "next/server";
import { fetchReadyOrders } from "@/lib/shopee";
import { upsertOrders, getAllOrders } from "@/lib/db";

export async function POST() {
  try {
    console.log("开始同步...");
    console.log("REFRESH:", process.env.SHOPEE_REFRESH_TOKEN?.slice(0,20));
    const orders = await fetchReadyOrders();
    console.log("订单数:", orders.length);
    const sgCount = orders.filter((o:any) => o.region === "SG").length;
    const myCount = orders.filter((o:any) => o.region === "MY").length;
    console.log("SG:", sgCount, "MY:", myCount);
    upsertOrders(orders);
    return NextResponse.json({ ok: true, count: orders.length });
  } catch (e: any) {
    console.error("错误:", e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    return NextResponse.json({ ok: true, orders: getAllOrders() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
