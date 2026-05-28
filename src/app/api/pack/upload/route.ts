import { NextResponse } from "next/server";
import { uploadToOneDrive } from "@/lib/onedrive";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file    = formData.get("photo") as File;
    const orderSn = formData.get("order_sn") as string;

    const date = new Date().toISOString().split("T")[0];
    const ts   = Date.now();
    const buf  = Buffer.from(await file.arrayBuffer());
    const url  = await uploadToOneDrive(buf, `${ts}.jpg`, orderSn, date);

    return NextResponse.json({ ok: true, url });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
