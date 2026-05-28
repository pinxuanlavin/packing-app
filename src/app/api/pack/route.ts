import { NextResponse } from "next/server";
import { updateOrderPacked } from "@/lib/db";
import { uploadMultipleToOneDrive } from "@/lib/onedrive";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const orderSn  = formData.get("order_sn") as string;
    const worker   = formData.get("worker") as string;
    const files    = formData.getAll("photos") as File[];

    const date = new Date().toISOString().split("T")[0];
    const photoPaths = await uploadMultipleToOneDrive(files, orderSn, date);

    await updateOrderPacked(orderSn, worker, photoPaths);
    return NextResponse.json({ ok: true, photos: photoPaths });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
