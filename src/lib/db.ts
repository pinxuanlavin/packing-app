import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      order_sn         TEXT PRIMARY KEY,
      tracking_number  TEXT,
      package_number   TEXT,
      shipping_carrier TEXT,
      create_time      INTEGER,
      items_json       TEXT,
      status           TEXT DEFAULT 'pending',
      worker           TEXT DEFAULT '',
      packed_at        INTEGER,
      review_status    TEXT DEFAULT '',
      review_comment   TEXT DEFAULT '',
      reviewed_by      TEXT DEFAULT '',
      reviewed_at      INTEGER,
      photos_json      TEXT DEFAULT '[]',
      synced_at        INTEGER,
      shopee_status    TEXT DEFAULT '',
      shop_id          TEXT DEFAULT 'SG',
      region           TEXT DEFAULT 'SG'
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS workers (
      id   SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      role TEXT DEFAULT 'worker'
    )
  `;
  await sql`INSERT INTO workers (name, role) VALUES ('审核', 'boss') ON CONFLICT (name) DO NOTHING`;
}

export async function upsertOrders(orders: any[]) {
  for (const o of orders) {
    await sql`
      INSERT INTO orders (order_sn, tracking_number, package_number, shipping_carrier, shopee_status, shop_id, region, create_time, items_json, synced_at)
      VALUES (${o.order_sn}, ${o.tracking_number}, ${o.package_number}, ${o.shipping_carrier}, ${o.shopee_status}, ${o.shop_id||'SG'}, ${o.region||'SG'}, ${o.create_time}, ${JSON.stringify(o.items)}, ${Math.floor(Date.now()/1000)})
      ON CONFLICT (order_sn) DO UPDATE SET
        tracking_number  = EXCLUDED.tracking_number,
        package_number   = EXCLUDED.package_number,
        shipping_carrier = EXCLUDED.shipping_carrier,
        shopee_status    = EXCLUDED.shopee_status,
        shop_id          = EXCLUDED.shop_id,
        region           = EXCLUDED.region,
        items_json       = EXCLUDED.items_json,
        synced_at        = EXCLUDED.synced_at
    `;
  }
}

export async function getAllOrders() {
  const rows = await sql`SELECT * FROM orders ORDER BY create_time DESC`;
  return rows.map(parseOrder);
}

export async function getOrderByTracking(trackingNo: string) {
  const rows = await sql`SELECT * FROM orders WHERE UPPER(tracking_number) = UPPER(${trackingNo})`;
  return rows[0] ? parseOrder(rows[0]) : null;
}

export async function getOrderBySn(orderSn: string) {
  const rows = await sql`SELECT * FROM orders WHERE UPPER(order_sn) = UPPER(${orderSn})`;
  return rows[0] ? parseOrder(rows[0]) : null;
}

export async function getAllOrdersForScan() {
  const rows = await sql`SELECT * FROM orders ORDER BY create_time DESC`;
  return rows.map(parseOrder);
}

export async function updateOrderPacked(orderSn: string, worker: string, photos: string[]) {
  await sql`
    UPDATE orders SET status='packed', worker=${worker}, packed_at=${Math.floor(Date.now()/1000)}, review_status='pending', photos_json=${JSON.stringify(photos)}
    WHERE order_sn=${orderSn}
  `;
}

export async function updateOrderReview(orderSn: string, pass: boolean, comment: string, reviewer: string) {
  await sql`
    UPDATE orders SET
      status=${pass?"approved":"rejected"},
      review_status=${pass?"approved":"rejected"},
      review_comment=${comment},
      reviewed_by=${reviewer},
      reviewed_at=${Math.floor(Date.now()/1000)}
    WHERE order_sn=${orderSn}
  `;
}

function parseOrder(row: any) {
  return {
    ...row,
    items:  JSON.parse(row.items_json  || "[]"),
    photos: JSON.parse(row.photos_json || "[]"),
  };
}

export async function getWorkers() {
  return await sql`SELECT * FROM workers ORDER BY role DESC, name ASC`;
}

export async function addWorker(name: string, role = "worker") {
  await sql`INSERT INTO workers (name, role) VALUES (${name}, ${role}) ON CONFLICT (name) DO NOTHING`;
}
