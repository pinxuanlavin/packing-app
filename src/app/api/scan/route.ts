import { NextResponse } from "next/server";
import { getOrderByTracking, getOrderBySn, getAllOrders } from "@/lib/db";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code")?.trim().toUpperCase();
  if (!code) return NextResponse.json({ ok: false, error: "缺少扫码内容" }, { status: 400 });

  let order = await getOrderByTracking(code) ?? await getOrderBySn(code);

  if (!order && code.length <= 6) {
    const all = await getAllOrders();
    const matches = all.filter((o: any) => o.order_sn.endsWith(code));
    if (matches.length === 1) order = matches[0];
    else if (matches.length > 1) return NextResponse.json({ ok: false, error: `找到${matches.length}个匹配，请多输入几位` });
  }

  if (!order) return NextResponse.json({ ok: false, error: `找不到订单：${code}` }, { status: 404 });
  return NextResponse.json({ ok: true, order });
}
