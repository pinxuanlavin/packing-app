import { NextResponse } from "next/server";
import { updateOrderPacked } from "@/lib/db";
import { uploadToOneDrive } from "@/lib/onedrive";

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
      const buffer = Buffer.from(await file.arrayBuffer());
      const fname = `${i + 1}_${Date.now()}.jpg`;
      
      try {
        const url = await uploadToOneDrive(buffer, fname, orderSn, date);
        photoPaths.push(url);
      } catch (e) {
        console.error("OneDrive上传失败:", e);
        photoPaths.push(`/uploads/${orderSn}/${fname}`);
      }
    }

    await updateOrderPacked(orderSn, worker, photoPaths);
    return NextResponse.json({ ok: true, photos: photoPaths });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
