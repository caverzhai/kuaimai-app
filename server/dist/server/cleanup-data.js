"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const postgres_1 = require("postgres");
const sql = (0, postgres_1.default)(process.env.DATABASE_URL);
async function cleanup() {
    console.log('开始清理数据...');
    const adminId = '4b51567f-8020-415c-8b5d-1de2f28e141d';
    try {
        const consultOrders = await sql `DELETE FROM consult_orders RETURNING id`;
        console.log(`删除咨询订单: ${consultOrders.length} 条`);
        const mallOrders = await sql `DELETE FROM mall_orders RETURNING id`;
        console.log(`删除商城订单: ${mallOrders.length} 条`);
        const inviteRecords = await sql `DELETE FROM invite_records RETURNING id`;
        console.log(`删除邀请记录: ${inviteRecords.length} 条`);
        const teamRelations = await sql `DELETE FROM team_relations RETURNING id`;
        console.log(`删除团队关系: ${teamRelations.length} 条`);
        try {
            const chatMessages = await sql `DELETE FROM chat_messages RETURNING id`;
            console.log(`删除聊天室消息: ${chatMessages.length} 条`);
        }
        catch (e) {
            console.log('聊天室消息表不存在或已清空');
        }
        try {
            const chatMembers = await sql `DELETE FROM chat_room_members RETURNING id`;
            console.log(`删除聊天室成员: ${chatMembers.length} 条`);
        }
        catch (e) {
            console.log('聊天室成员表不存在或已清空');
        }
        try {
            const chatRooms = await sql `DELETE FROM chat_rooms RETURNING id`;
            console.log(`删除聊天室: ${chatRooms.length} 条`);
        }
        catch (e) {
            console.log('聊天室表不存在或已清空');
        }
        const users = await sql `DELETE FROM users WHERE id != ${adminId} RETURNING id, nickname, phone`;
        console.log(`删除用户: ${users.length} 个`);
        users.forEach(u => console.log(`  - ${u.nickname} (${u.phone})`));
        await sql `
      UPDATE users SET
        direct_invite_count = 0,
        team_total_count = 0,
        tree_level = 0,
        parent_id = NULL,
        inviter_id = NULL,
        is_invited = false
      WHERE id = ${adminId}
    `;
        console.log('管理员统计数据已重置');
        console.log('\n清理完成！');
        console.log('保留的管理员: 13800000000 (我是管理员)');
    }
    catch (error) {
        console.error('清理失败:', error);
    }
    finally {
        await sql.end();
    }
}
cleanup();
//# sourceMappingURL=cleanup-data.js.map