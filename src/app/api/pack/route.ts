import { NextResponse } from "next/server";
import { updateOrderPacked } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const orderSn  = formData.get("order_sn") as string;
    const worker   = formData.get("worker") as string;
    const files    = formData.getAll("photos") as File[];
    const uploadDir = path.join(process.cwd(), "public", "uploads", orderSn);
    await mkdir(uploadDir, { recursive: true });
    const photoPaths: string[] = [];
    for (const file of files) {
      const fname = `${Date.now()}_${file.name}`;
      await writeFile(path.join(uploadDir, fname), Buffer.from(await file.arrayBuffer()));
      photoPaths.push(`/uploads/${orderSn}/${fname}`);
    }
    await updateOrderPacked(orderSn, worker, photoPaths);
    return NextResponse.json({ ok: true, photos: photoPaths });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
