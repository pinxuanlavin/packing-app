const CLIENT_ID     = process.env.ONEDRIVE_CLIENT_ID!;
const CLIENT_SECRET = process.env.ONEDRIVE_CLIENT_SECRET!;
const TENANT_ID     = process.env.ONEDRIVE_TENANT_ID!;
const REFRESH_TOKEN = process.env.ONEDRIVE_REFRESH_TOKEN!;

async function getAccessToken(): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN,
        grant_type:    "refresh_token",
        scope:         "Files.ReadWrite.All",
      }),
    }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error("OneDrive token失败: " + JSON.stringify(data));
  return data.access_token;
}

export async function uploadToOneDrive(
  fileBuffer: Buffer,
  fileName: string,
  orderSn: string,
  date: string
): Promise<string> {
  const token = await getAccessToken();
  
  // 文件夹路径：PackFlow配货照片/2026-05-14/ORDER_SN/
  const folderPath = `PackFlow配货照片/${date}/${orderSn}`;
  const uploadPath = `/me/drive/root:/${folderPath}/${fileName}:/content`;

  const res = await fetch(`https://graph.microsoft.com/v1.0${uploadPath}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "image/jpeg",
    },
    body: fileBuffer as unknown as BodyInit,
  });

  const data = await res.json();
  if (!data.id) throw new Error("上传失败: " + JSON.stringify(data));
  
  // 返回 onedrive://文件ID 格式，后续通过API实时获取下载链接
  return `onedrive://${data.id}`;
}
