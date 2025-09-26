const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function countUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_classroom');
    console.log('Connected to MongoDB');
    console.log('==========================================');
    console.log('📊 USER COUNT ANALYSIS');
    console.log('==========================================\n');

    // Total user count
    const totalUsers = await User.countDocuments();
    console.log(`🔢 TOTAL USERS: ${totalUsers}`);
    
    if (totalUsers === 0) {
      console.log('❌ No users found in the database.');
      return;
    }

    console.log('\n📈 USERS BY ROLE:');
    console.log('------------------------------------------');
    
    // Count by role
    const roleStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          active: { 
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } 
          },
          approved: { 
            $sum: { $cond: [{ $eq: ['$isApproved', true] }, 1, 0] } 
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    roleStats.forEach(role => {
      console.log(`${role._id.toUpperCase().padEnd(12)} | Count: ${role.count.toString().padEnd(3)} | Active: ${role.active.toString().padEnd(3)} | Approved: ${role.approved}`);
    });

    console.log('\n🏢 USERS BY DEPARTMENT:');
    console.log('------------------------------------------');
    
    // Count by department
    const deptStats = await User.aggregate([
      {
        $match: { department: { $ne: null, $ne: '' } }
      },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 },
          active: { 
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } 
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    if (deptStats.length === 0) {
      console.log('No department information available.');
    } else {
      deptStats.forEach(dept => {
        console.log(`${dept._id.padEnd(20)} | Count: ${dept.count.toString().padEnd(3)} | Active: ${dept.active}`);
      });
    }

    console.log('\n📊 USER STATUS SUMMARY:');
    console.log('------------------------------------------');
    
    const activeUsers = await User.countDocuments({ isActive: true });
    const approvedUsers = await User.countDocuments({ isApproved: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });
    const pendingApproval = await User.countDocuments({ isApproved: false });
    const onlineUsers = await User.countDocuments({ isOnline: true });

    console.log(`✅ Active Users:      ${activeUsers}/${totalUsers} (${((activeUsers/totalUsers)*100).toFixed(1)}%)`);
    console.log(`📝 Approved Users:    ${approvedUsers}/${totalUsers} (${((approvedUsers/totalUsers)*100).toFixed(1)}%)`);
    console.log(`❌ Inactive Users:    ${inactiveUsers}/${totalUsers} (${((inactiveUsers/totalUsers)*100).toFixed(1)}%)`);
    console.log(`⏳ Pending Approval:  ${pendingApproval}/${totalUsers} (${((pendingApproval/totalUsers)*100).toFixed(1)}%)`);
    console.log(`🟢 Currently Online:  ${onlineUsers}/${totalUsers} (${((onlineUsers/totalUsers)*100).toFixed(1)}%)`);

    console.log('\n📅 RECENT USER ACTIVITY:');
    console.log('------------------------------------------');
    
    const recentUsers = await User.find({})
      .sort({ lastLogin: -1 })
      .limit(5)
      .select('name email role lastLogin isOnline')
      .lean();
      
    if (recentUsers.length > 0) {
      console.log('Last 5 users to login:');
      recentUsers.forEach((user, index) => {
        const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never';
        const status = user.isOnline ? '🟢 Online' : '🔴 Offline';
        console.log(`${index + 1}. ${user.name} (${user.role}) - ${lastLogin} ${status}`);
      });
    }

    console.log('\n📋 DETAILED USER LIST:');
    console.log('------------------------------------------');
    
    const allUsers = await User.find({})
      .sort({ role: 1, name: 1 })
      .select('name email role department isActive isApproved createdAt')
      .lean();
      
    allUsers.forEach((user, index) => {
      const status = user.isActive ? '✅' : '❌';
      const approved = user.isApproved ? '📝' : '⏳';
      const created = new Date(user.createdAt).toLocaleDateString();
      console.log(`${(index + 1).toString().padEnd(3)} | ${status} ${approved} | ${user.role.toUpperCase().padEnd(9)} | ${user.name.padEnd(20)} | ${user.email.padEnd(25)} | ${user.department || 'N/A'.padEnd(15)} | ${created}`);
    });

  } catch (error) {
    console.error('❌ Error counting users:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Database connection closed.');
  }
}

// Run the script
if (require.main === module) {
  countUsers();
}

module.exports = countUsers;
