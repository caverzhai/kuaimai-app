// 数据库初始化脚本
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

async function initDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL 环境变量未设置');
    process.exit(1);
  }

  console.log('连接到数据库...');
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 30 });

  try {
    // 读取 init.sql
    const initSqlPath = path.join(__dirname, 'database', 'init.sql');
    const initSql = fs.readFileSync(initSqlPath, 'utf-8');

    console.log('执行初始化脚本...');
    await sql.unsafe(initSql);
    console.log('✅ 数据库初始化成功！');

    // 验证表是否创建
    const tables = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' ORDER BY table_name
    `;
    console.log('\n已创建的表：');
    tables.forEach(t => console.log('  -', t.table_name));

  } catch (error) {
    console.error('❌ 数据库初始化失败：', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

initDatabase();
