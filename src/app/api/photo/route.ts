import { NextResponse } from "next/server";

async function getAccessToken() {
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
  return data.access_token;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("id");
  if (!fileId) return NextResponse.json({ error: "缺少id" }, { status: 400 });

  const token = await getAccessToken();

  // /content 直接返回 302 到下载链接，一次调用替代两次
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: "manual",
  });

  const url = res.headers.get("Location");
  if (!url) return NextResponse.json({ error: "获取下载链接失败" }, { status: 500 });

  return NextResponse.redirect(url);
}
