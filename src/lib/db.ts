import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "packing.db");
let _db: Database.Database | null = null;

export function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    initDb(_db);
  }
  return _db;
}

function initDb(db: Database.Database) {
  db.exec(`
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
      synced_at        INTEGER
    );
    CREATE TABLE IF NOT EXISTS workers (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      role TEXT DEFAULT 'worker'
    );
    INSERT OR IGNORE INTO workers (name, role) VALUES ('Boss', 'boss');
  `);
}

export function upsertOrders(orders: any[]) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO orders (order_sn, tracking_number, package_number, shipping_carrier, shopee_status, shop_id, region, create_time, items_json, synced_at)
    VALUES (@order_sn, @tracking_number, @package_number, @shipping_carrier, @shopee_status, @shop_id, @region, @create_time, @items_json, @synced_at)
    ON CONFLICT(order_sn) DO UPDATE SET
      tracking_number  = excluded.tracking_number,
      package_number   = excluded.package_number,
      shipping_carrier = excluded.shipping_carrier,
      shopee_status    = excluded.shopee_status,
      shop_id          = excluded.shop_id,
      region           = excluded.region,
      items_json       = excluded.items_json,
      synced_at        = excluded.synced_at
  `);
  const now = Math.floor(Date.now() / 1000);
  const insertMany = db.transaction((orders: any[]) => {
    for (const o of orders) {
      stmt.run({
        order_sn:         o.order_sn,
        tracking_number:  o.tracking_number,
        package_number:   o.package_number,
        shipping_carrier: o.shipping_carrier,
        shopee_status:    o.shopee_status ?? "",
        shop_id:          o.shop_id ?? "SG",
        region:           o.region ?? "SG",
        create_time:      o.create_time,
        items_json:       JSON.stringify(o.items),
        synced_at:        now,
      });
    }
  });
  insertMany(orders);
}

export function getAllOrders() {
  const rows = getDb().prepare("SELECT * FROM orders ORDER BY create_time DESC").all() as any[];
  return rows.map(parseOrder);
}

export function getOrderByTracking(trackingNo: string) {
  const row = getDb().prepare("SELECT * FROM orders WHERE UPPER(tracking_number) = UPPER(?)").get(trackingNo) as any;
  return row ? parseOrder(row) : null;
}

export function getOrderBySn(orderSn: string) {
  const row = getDb().prepare("SELECT * FROM orders WHERE UPPER(order_sn) = UPPER(?)").get(orderSn) as any;
  return row ? parseOrder(row) : null;
}

export function updateOrderPacked(orderSn: string, worker: string, photos: string[]) {
  getDb().prepare(`
    UPDATE orders SET status='packed', worker=?, packed_at=?, review_status='pending', photos_json=?
    WHERE order_sn=?
  `).run(worker, Math.floor(Date.now() / 1000), JSON.stringify(photos), orderSn);
}

export function updateOrderReview(orderSn: string, pass: boolean, comment: string, reviewer: string) {
  getDb().prepare(`
    UPDATE orders SET status=?, review_status=?, review_comment=?, reviewed_by=?, reviewed_at=?
    WHERE order_sn=?
  `).run(pass?"approved":"rejected", pass?"approved":"rejected", comment, reviewer, Math.floor(Date.now()/1000), orderSn);
}

function parseOrder(row: any) {
  return { ...row, items: JSON.parse(row.items_json||"[]"), photos: JSON.parse(row.photos_json||"[]") };
}

export function getWorkers() {
  return getDb().prepare("SELECT * FROM workers ORDER BY role DESC, name ASC").all();
}

export function addWorker(name: string, role = "worker") {
  getDb().prepare("INSERT OR IGNORE INTO workers (name, role) VALUES (?, ?)").run(name, role);
}
