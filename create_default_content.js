import axios from 'axios';

async function createDefaultContent() {
  try {
    // Login first
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@company.com',
      password: 'admin123456'
    });

    const token = loginResponse.data.token;
    console.log('✅ Logged in successfully');

    // Create default content
    const defaultContent = [
      {
        title: 'Welcome to Our Institution',
        content: 'Welcome to our smart classroom system. We are committed to providing the best educational experience through innovative technology.',
        type: 'default',
        priority: 10,
        duration: 30,
        schedule: {
          type: 'always'
        },
        assignedBoards: [], // Will be assigned to all boards
        isActive: true
      },
      {
        title: 'Morning Announcements',
        content: 'Good morning! Please ensure all devices are charged and ready for the day\'s activities. Remember to follow safety protocols.',
        type: 'user',
        priority: 8,
        duration: 45,
        schedule: {
          type: 'recurring',
          startTime: '08:00',
          endTime: '09:00',
          daysOfWeek: [1, 2, 3, 4, 5] // Monday to Friday
        },
        assignedBoards: [],
        isActive: true
      },
      {
        title: 'Emergency Procedures',
        content: 'EMERGENCY: In case of emergency, follow the evacuation procedures posted near the exits. Contact security immediately.',
        type: 'emergency',
        priority: 10,
        duration: 60,
        schedule: {
          type: 'always'
        },
        assignedBoards: [],
        isActive: true
      },
      {
        title: 'Library Hours',
        content: 'Library Hours: Monday-Friday: 8:00 AM - 8:00 PM | Saturday: 9:00 AM - 5:00 PM | Sunday: Closed',
        type: 'user',
        priority: 3,
        duration: 20,
        schedule: {
          type: 'recurring',
          startTime: '12:00',
          endTime: '13:00',
          daysOfWeek: [1, 2, 3, 4, 5]
        },
        assignedBoards: [],
        isActive: true
      }
    ];

    for (const content of defaultContent) {
      try {
        const response = await axios.post('http://localhost:3001/api/content', content, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log(`✅ Created content: ${content.title}`);
      } catch (error) {
        console.error(`❌ Failed to create content: ${content.title}`, error.response?.data || error.message);
      }
    }

    console.log('🎉 Default content creation completed!');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

createDefaultContent();