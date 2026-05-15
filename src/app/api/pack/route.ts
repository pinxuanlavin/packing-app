import { NextResponse } from "next/server";
import { updateOrderPacked } from "@/lib/db";
import { put } from "@vercel/blob";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const orderSn  = formData.get("order_sn") as string;
    const worker   = formData.get("worker") as string;
    const files    = formData.getAll("photos") as File[];

    const date = new Date().toISOString().split("T")[0];
    const photoPaths: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fname = `${date}/${orderSn}/${i + 1}_${Date.now()}.jpg`;
      
      const blob = await put(fname, file, {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      photoPaths.push(blob.url);
    }

    await updateOrderPacked(orderSn, worker, photoPaths);
    return NextResponse.json({ ok: true, photos: photoPaths });
  } catch (e: any) {
    console.error("上传失败:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
