import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  
  if (error) {
    return new Response(`授权失败: ${error}`, { status: 400 });
  }
  
  if (!code) {
    return new Response("没有收到code", { status: 400 });
  }

  // 用code换token
  const tokenRes = await fetch("https://login.microsoftonline.com/a4830359-e397-4b7c-8a8d-8bad305b0878/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     "2b04e544-41ed-4ed4-a6d7-eae28369b9b3",
      client_secret: "5nQ8Q~4lUX14J5sIqyaPX6Uk-m4a8MRuyoacibDC",
      code:          code,
      redirect_uri:  "https://packing-app-tawny.vercel.app/api/auth/callback",
      grant_type:    "authorization_code",
      scope:         "Files.ReadWrite.All offline_access User.Read",
    }),
  });

  const data = await tokenRes.json();
  
  if (data.access_token) {
    return new Response(`
      <h2>✅ 授权成功！</h2>
      <p><b>Access Token:</b><br/><textarea rows=3 style="width:100%">${data.access_token}</textarea></p>
      <p><b>Refresh Token:</b><br/><textarea rows=3 style="width:100%">${data.refresh_token}</textarea></p>
      <p>请复制Refresh Token发给Claude</p>
    `, { headers: { "Content-Type": "text/html" } });
  }
  
  return new Response(`失败: ${JSON.stringify(data)}`, { status: 400 });
}
