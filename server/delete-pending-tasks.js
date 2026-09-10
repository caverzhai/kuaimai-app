// 删除所有未完成的升级任务
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

async function main() {
  try {
    // 先统计
    const countResult = await sql`
      SELECT COUNT(*) as cnt FROM upgrade_tasks 
      WHERE status IN ('pending', 'in_progress')
    `;
    console.log(`待删除的未完成任务数量: ${countResult[0].cnt}`);

    // 执行删除
    const deleted = await sql`
      DELETE FROM upgrade_tasks 
      WHERE status IN ('pending', 'in_progress')
      RETURNING id, user_id, task_index, title, status
    `;
    console.log(`已删除 ${deleted.length} 条任务:`);
    deleted.forEach(t => {
      console.log(`  - 用户: ${t.user_id.substring(0,8)}..., 任务${t.task_index}: ${t.title} (${t.status})`);
    });

    // 验证剩余
    const remainResult = await sql`
      SELECT COUNT(*) as cnt FROM upgrade_tasks 
      WHERE status IN ('pending', 'in_progress')
    `;
    console.log(`剩余未完成任务: ${remainResult[0].cnt}`);

    await sql.end();
    process.exit(0);
  } catch (err) {
    console.error('删除失败:', err.message);
    await sql.end();
    process.exit(1);
  }
}

main();
