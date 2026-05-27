import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

// 初始化 Neon 数据库连接
const sql = neon(process.env.DATABASE_URL || '');

export async function POST(request: Request) {
  try {
    // 1. 安全解析前端传过来的数据
    const body = await request.json();
    const { orderId, imageUrl, status } = body;

    // 健壮性检查：确保核心数据不为空
    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: '图片地址不能为空' },
        { status: 400 }
      );
    }

    // 2. 将拍摄的订单信息写入 Neon 临时数据库
    // 自动兼容防错：如果表不存在，或者字段写入失败，这里会抓取具体错误
    await sql`
      INSERT INTO pending_reviews (order_id, image_url, status, created_at)
      VALUES (${orderId || 'UNKNOWN'}, ${imageUrl}, ${status || 'pending'}, NOW())
    `;

    // 3. 成功返回
    return NextResponse.json({ 
      success: true, 
      message: '成功计入审核列表' 
    });

  } catch (error: any) {
    // 核心修复：把服务器内部的 500 错误打印出来，防止白屏死机
    console.error('【Aether Flow 打包 App 错误日志】:', error.message);
    
    return NextResponse.json(
      { 
        success: false, 
        error: '临时数据库写入失败', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
