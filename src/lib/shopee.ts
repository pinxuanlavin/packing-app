import crypto from "crypto";
import { neon } from "@neondatabase/serverless";

const PARTNER_ID  = parseInt(process.env.SHOPEE_PARTNER_ID!);
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY!;
const BASE_URL    = "https://partner.shopeemobile.com";

const SHOPS = [
  { shop_id: 209859170,  region: "SG" },
  { shop_id: 1778322972, region: "TH" },
];

function makeSign(path: string, ts: number, token = "", shop = 0) {
  const parts = [String(PARTNER_ID), path, String(ts)];
  if (token) parts.push(token);
  if (shop)  parts.push(String(shop));
  return crypto.createHmac("sha256", PARTNER_KEY).update(parts.join("")).digest("hex");
}

async function getRefreshToken(shopId: number): Promise<string> {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`SELECT refresh_token FROM shopee_tokens WHERE shop_id = ${shopId}`;
    if (rows[0]?.refresh_token) return rows[0].refresh_token;
  } catch (e) {}
  // 从环境变量读
  if (shopId === 1778322972) return process.env.SHOPEE_REFRESH_TOKEN_TH!;
  return process.env.SHOPEE_REFRESH_TOKEN!;
}

async function saveTokens(shopId: number, accessToken: string, refreshToken: string) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO shopee_tokens (shop_id, access_token, refresh_token, updated_at)
      VALUES (${shopId}, ${accessToken}, ${refreshToken}, ${Math.floor(Date.now()/1000)})
      ON CONFLICT (shop_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        updated_at = EXCLUDED.updated_at
    `;
  } catch (e) {
    console.error("保存token失败:", e);
  }
}

async function getValidToken(shopId: number): Promise<string> {
  const refreshToken = await getRefreshToken(shopId);
  const path = "/api/v2/auth/access_token/get";
  const ts   = Math.floor(Date.now() / 1000);
  const sign = makeSign(path, ts);
  const res  = await fetch(`${BASE_URL}${path}?partner_id=${PARTNER_ID}&timestamp=${ts}&sign=${sign}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken, partner_id: PARTNER_ID, shop_id: shopId }),
  });
  const data = await res.json();
  if (data.access_token) {
    // 自动保存新token
    await saveTokens(shopId, data.access_token, data.refresh_token);
    return data.access_token;
  }
  console.error(`[shop:${shopId}] token刷新失败:`, data.error);
  return process.env.SHOPEE_ACCESS_TOKEN!;
}

async function shopeeGet(path: string, token: string, shopId: number, extra: Record<string, any> = {}) {
  const ts = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({
    partner_id:   String(PARTNER_ID),
    timestamp:    String(ts),
    sign:         makeSign(path, ts, token, shopId),
    shop_id:      String(shopId),
    access_token: token,
    ...Object.fromEntries(Object.entries(extra).map(([k,v]) => [k, String(v)])),
  });
  const res = await fetch(`${BASE_URL}${path}?${params}`);
  return res.json();
}

async function fetchShopOrders(shopId: number, region: string) {
  const token    = await getValidToken(shopId);
  const now      = Math.floor(Date.now() / 1000);
  const timeFrom = now - 2 * 24 * 3600;

  const [list1, list2] = await Promise.all([
    shopeeGet("/api/v2/order/get_order_list", token, shopId, {
      time_range_field: "create_time", time_from: timeFrom, time_to: now,
      page_size: 50, order_status: "PROCESSED", response_optional_fields: "order_status",
    }),
    shopeeGet("/api/v2/order/get_order_list", token, shopId, {
      time_range_field: "create_time", time_from: timeFrom, time_to: now,
      page_size: 50, order_status: "READY_TO_SHIP", response_optional_fi
cat > ~/packing-app/src/lib/shopee.ts << 'EOF'
import crypto from "crypto";
import { neon } from "@neondatabase/serverless";

const PARTNER_ID  = parseInt(process.env.SHOPEE_PARTNER_ID!);
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY!;
const BASE_URL    = "https://partner.shopeemobile.com";

const SHOPS = [
  { shop_id: 209859170,  region: "SG" },
  { shop_id: 1778322972, region: "TH" },
];

function makeSign(path: string, ts: number, token = "", shop = 0) {
  const parts = [String(PARTNER_ID), path, String(ts)];
  if (token) parts.push(token);
  if (shop)  parts.push(String(shop));
  return crypto.createHmac("sha256", PARTNER_KEY).update(parts.join("")).digest("hex");
}

async function getRefreshToken(shopId: number): Promise<string> {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`SELECT refresh_token FROM shopee_tokens WHERE shop_id = ${shopId}`;
    if (rows[0]?.refresh_token) return rows[0].refresh_token;
  } catch (e) {}
  // 从环境变量读
  if (shopId === 1778322972) return process.env.SHOPEE_REFRESH_TOKEN_TH!;
  return process.env.SHOPEE_REFRESH_TOKEN!;
}

async function saveTokens(shopId: number, accessToken: string, refreshToken: string) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO shopee_tokens (shop_id, access_token, refresh_token, updated_at)
      VALUES (${shopId}, ${accessToken}, ${refreshToken}, ${Math.floor(Date.now()/1000)})
      ON CONFLICT (shop_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        updated_at = EXCLUDED.updated_at
    `;
  } catch (e) {
    console.error("保存token失败:", e);
  }
}

async function getValidToken(shopId: number): Promise<string> {
  const refreshToken = await getRefreshToken(shopId);
  const path = "/api/v2/auth/access_token/get";
  const ts   = Math.floor(Date.now() / 1000);
  const sign = makeSign(path, ts);
  const res  = await fetch(`${BASE_URL}${path}?partner_id=${PARTNER_ID}&timestamp=${ts}&sign=${sign}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken, partner_id: PARTNER_ID, shop_id: shopId }),
  });
  const data = await res.json();
  if (data.access_token) {
    // 自动保存新token
    await saveTokens(shopId, data.access_token, data.refresh_token);
    return data.access_token;
  }
  console.error(`[shop:${shopId}] token刷新失败:`, data.error);
  return process.env.SHOPEE_ACCESS_TOKEN!;
}

async function shopeeGet(path: string, token: string, shopId: number, extra: Record<string, any> = {}) {
  const ts = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({
    partner_id:   String(PARTNER_ID),
    timestamp:    String(ts),
    sign:         makeSign(path, ts, token, shopId),
    shop_id:      String(shopId),
    access_token: token,
    ...Object.fromEntries(Object.entries(extra).map(([k,v]) => [k, String(v)])),
  });
  const res = await fetch(`${BASE_URL}${path}?${params}`);
  return res.json();
}

async function fetchShopOrders(shopId: number, region: string) {
  const token    = await getValidToken(shopId);
  const now      = Math.floor(Date.now() / 1000);
  const timeFrom = now - 2 * 24 * 3600;

  const [list1, list2] = await Promise.all([
    shopeeGet("/api/v2/order/get_order_list", token, shopId, {
      time_range_field: "create_time", time_from: timeFrom, time_to: now,
      page_size: 50, order_status: "PROCESSED", response_optional_fields: "order_status",
    }),
    shopeeGet("/api/v2/order/get_order_list", token, shopId, {
      time_range_field: "create_time", time_from: timeFrom, time_to: now,
      page_size: 50, order_status: "READY_TO_SHIP", response_optional_fields: "order_status",
    }),
  ]);

  const orderList: any[] = [
    ...(list1?.response?.order_list ?? []),
    ...(list2?.response?.order_list ?? []),
  ];

  console.log(`[${region}] 订单列表:`, orderList.length, "个");
  if (!orderList.length) return [];

  const sns = orderList.map((o: any) => o.order_sn).join(",");
  const detailData = await shopeeGet("/api/v2/order/get_order_detail", token, shopId, {
    order_sn_list: sns,
    response_optional_fields: "item_list,package_list,shipping_carrier",
  });

  const orders: any[] = detailData?.response?.order_list ?? [];
  const result = [];

  for (const order of orders) {
    const pkg = order.package_list?.[0];
    let spxNo = "";
    if (pkg?.package_number) {
      const trackData = await shopeeGet("/api/v2/logistics/get_tracking_number", token, shopId, {
        order_sn: order.order_sn, package_number: pkg.package_number,
      });
      spxNo = trackData?.response?.tracking_number ?? "";
    }
    const shopeeStatus = orderList.find((o:any) => o.order_sn === order.order_sn)?.order_status ?? "";
    result.push({
      order_sn:         order.order_sn,
      tracking_number:  spxNo,
      package_number:   pkg?.package_number ?? "",
      shipping_carrier: order.shipping_carrier ?? "",
      shopee_status:    shopeeStatus,
      shop_id:          String(shopId),
      region:           region,
      create_time:      order.create_time,
      items: (order.item_list ?? []).map((i: any) => ({
        name:  i.item_name,
        sku:   i.model_sku,
        model: i.model_name,
        qty:   i.model_quantity_purchased,
        image: i.image_info?.image_url ?? "",
      })),
    });
  }
  return result;
}

export async function fetchReadyOrders() {
  const results = await Promise.all(
    SHOPS.map(s => fetchShopOrders(s.shop_id, s.region))
  );
  return results.flat();
}
