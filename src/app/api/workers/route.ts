import { NextResponse } from "next/server";
import { getWorkers, addWorker, initDb } from "@/lib/db";

export async function GET() {
  await initDb();
  return NextResponse.json({ ok: true, workers: await getWorkers() });
}

export async function POST(request: Request) {
  const { name, role } = await request.json();
  if (!name) return NextResponse.json({ ok: false, error: "缺少名字" }, { status: 400 });
  await addWorker(name, role ?? "worker");
  return NextResponse.json({ ok: true, workers: await getWorkers() });
}
