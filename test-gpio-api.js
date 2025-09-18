import axios from 'axios';

// Test GPIO info endpoint
async function testGpioInfo() {
    try {
        console.log('Testing GPIO info endpoint...');

        // First, let's login to get a token
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            email: 'admin@iotclassroom.com',
            password: 'admin123456'
        });

        const token = loginResponse.data.token;
        console.log('✅ Login successful, got token');

        // Now test the GPIO info endpoint
        const gpioResponse = await axios.get('http://localhost:3001/api/devices/gpio-info', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('✅ GPIO info endpoint working');
        console.log('GPIO pins data:', JSON.stringify(gpioResponse.data, null, 2));

        // Check if we have the expected structure
        if (gpioResponse.data.success && gpioResponse.data.data) {
            console.log('✅ GPIO data structure is correct');

            // Check for safe/problematic/reserved pins
            const pins = gpioResponse.data.data;
            const safePins = pins.filter(p => p.status === 'safe');
            const problematicPins = pins.filter(p => p.status === 'problematic');
            const reservedPins = pins.filter(p => p.status === 'reserved');

            console.log(`Safe pins: ${safePins.length}`);
            console.log(`Problematic pins: ${problematicPins.length}`);
            console.log(`Reserved pins: ${reservedPins.length}`);

            // Verify specific pins
            const pin16 = pins.find(p => p.pin === 16);
            const pin4 = pins.find(p => p.pin === 4);

            if (pin16 && pin16.status === 'safe') {
                console.log('✅ Pin 16 correctly marked as safe');
            } else {
                console.log('❌ Pin 16 not correctly marked as safe');
            }

            if (pin4 && pin4.status === 'problematic') {
                console.log('✅ Pin 4 correctly marked as problematic');
            } else {
                console.log('❌ Pin 4 not correctly marked as problematic');
            }

        } else {
            console.log('❌ GPIO data structure is incorrect');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.response ? error.response.data : error.message);
    }
}

testGpioInfo();