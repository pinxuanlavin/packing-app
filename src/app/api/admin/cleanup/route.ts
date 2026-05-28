import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

async function getAccessToken(): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.ONEDRIVE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     process.env.ONEDRIVE_CLIENT_ID!,
        client_secret: process.env.ONEDRIVE_CLIENT_SECRET!,
        refresh_token: process.env.ONEDRIVE_REFRESH_TOKEN!,
        grant_type:    "refresh_token",
        scope:         "Files.ReadWrite.All",
      }),
    }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error("token获取失败");
  return data.access_token;
}

// Vercel Cron 每日凌晨2点UTC调用（新加坡时间早上10点）
export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!);

    const cutoff = Math.floor(Date.now() / 1000) - 90 * 24 * 3600;

    const orders = await sql`
      SELECT order_sn, photos_json
      FROM orders
      WHERE review_status = 'approved'
        AND create_time < ${cutoff}
        AND photos_json IS NOT NULL
        AND photos_json != '[]'
    `;

    if (orders.length === 0) {
      return NextResponse.json({ ok: true, cleaned: 0, files: 0 });
    }

    const token = await getAccessToken();
    let deletedFiles = 0;

    for (const order of orders) {
      const photos: string[] = JSON.parse(order.photos_json || "[]");

      await Promise.allSettled(
        photos
          .filter(p => p.startsWith("onedrive://"))
          .map(async p => {
            const fileId = p.replace("onedrive://", "");
            await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            deletedFiles++;
          })
      );

      await sql`UPDATE orders SET photos_json = '[]' WHERE order_sn = ${order.order_sn}`;
    }

    console.log(`[cleanup] ${orders.length} 单, 删除 ${deletedFiles} 张照片`);
    return NextResponse.json({ ok: true, cleaned: orders.length, files: deletedFiles });
  } catch (e: any) {
    console.error("[cleanup] 失败:", e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
