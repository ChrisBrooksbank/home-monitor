// Test Hue Bridge Connection
const http = require('http');

// Config values from config.js
const BRIDGE_IP = "192.168.68.51";
const USERNAME = "XuImnzeJIl13QqlovPsgrA1-Un1zSAJk6woHUjbt";

console.log('\n=== Testing Hue Bridge Connection ===\n');
console.log(`Bridge IP: ${BRIDGE_IP}`);
console.log(`Username: ${USERNAME.substring(0, 10)}...`);
console.log('\n');

// Test 1: Check if we can reach the bridge
async function testBridgeReachability() {
    console.log('Test 1: Checking if bridge is reachable...');
    return new Promise((resolve) => {
        const req = http.get(`http://${BRIDGE_IP}/api/config`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('✓ Bridge is reachable');
                    const config = JSON.parse(data);
                    console.log(`  Bridge Name: ${config.name}`);
                    console.log(`  API Version: ${config.apiversion}`);
                    console.log(`  Software Version: ${config.swversion}`);
                } else {
                    console.log(`✗ Bridge responded with status ${res.statusCode}`);
                }
                resolve(res.statusCode === 200);
            });
        });
        req.on('error', (err) => {
            console.log(`✗ Cannot reach bridge: ${err.message}`);
            resolve(false);
        });
        req.setTimeout(5000, () => {
            req.destroy();
            console.log('✗ Connection timeout');
            resolve(false);
        });
    });
}

// Test 2: Check authentication
async function testAuthentication() {
    console.log('\nTest 2: Checking authentication...');
    return new Promise((resolve) => {
        const req = http.get(`http://${BRIDGE_IP}/api/${USERNAME}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const response = JSON.parse(data);
                if (response[0] && response[0].error) {
                    console.log(`✗ Authentication failed: ${response[0].error.description}`);
                    resolve(false);
                } else {
                    console.log('✓ Authentication successful');
                    resolve(true);
                }
            });
        });
        req.on('error', (err) => {
            console.log(`✗ Request failed: ${err.message}`);
            resolve(false);
        });
        req.setTimeout(5000, () => {
            req.destroy();
            console.log('✗ Connection timeout');
            resolve(false);
        });
    });
}

// Test 3: Fetch lights
async function testLightsFetch() {
    console.log('\nTest 3: Fetching lights...');
    return new Promise((resolve) => {
        const req = http.get(`http://${BRIDGE_IP}/api/${USERNAME}/lights`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const lights = JSON.parse(data);
                    if (lights[0] && lights[0].error) {
                        console.log(`✗ Error: ${lights[0].error.description}`);
                        resolve(false);
                    } else {
                        const lightCount = Object.keys(lights).length;
                        console.log(`✓ Successfully fetched ${lightCount} lights`);
                        Object.entries(lights).slice(0, 3).forEach(([id, light]) => {
                            console.log(`  - Light ${id}: ${light.name} (${light.state.on ? 'ON' : 'OFF'})`);
                        });
                        if (lightCount > 3) console.log(`  ... and ${lightCount - 3} more`);
                        resolve(true);
                    }
                } catch (err) {
                    console.log(`✗ Failed to parse response: ${err.message}`);
                    resolve(false);
                }
            });
        });
        req.on('error', (err) => {
            console.log(`✗ Request failed: ${err.message}`);
            resolve(false);
        });
        req.setTimeout(5000, () => {
            req.destroy();
            console.log('✗ Connection timeout');
            resolve(false);
        });
    });
}

// Test 4: Fetch sensors
async function testSensorsFetch() {
    console.log('\nTest 4: Fetching sensors...');
    return new Promise((resolve) => {
        const req = http.get(`http://${BRIDGE_IP}/api/${USERNAME}/sensors`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const sensors = JSON.parse(data);
                    if (sensors[0] && sensors[0].error) {
                        console.log(`✗ Error: ${sensors[0].error.description}`);
                        resolve(false);
                    } else {
                        const sensorCount = Object.keys(sensors).length;
                        console.log(`✓ Successfully fetched ${sensorCount} sensors`);
                        const tempSensors = Object.entries(sensors)
                            .filter(([, sensor]) => sensor.type === 'ZLLTemperature')
                            .slice(0, 3);
                        tempSensors.forEach(([id, sensor]) => {
                            const temp = sensor.state.temperature / 100;
                            console.log(`  - Sensor ${id}: ${sensor.name} (${temp}°C)`);
                        });
                        resolve(true);
                    }
                } catch (err) {
                    console.log(`✗ Failed to parse response: ${err.message}`);
                    resolve(false);
                }
            });
        });
        req.on('error', (err) => {
            console.log(`✗ Request failed: ${err.message}`);
            resolve(false);
        });
        req.setTimeout(5000, () => {
            req.destroy();
            console.log('✗ Connection timeout');
            resolve(false);
        });
    });
}

// Run all tests
(async () => {
    const reachable = await testBridgeReachability();
    if (!reachable) {
        console.log('\n=== DIAGNOSIS ===');
        console.log('The bridge is not reachable. Possible causes:');
        console.log('1. Bridge IP address may have changed');
        console.log('2. Bridge may be offline or powered off');
        console.log('3. Network connectivity issue');
        console.log('\nTry:');
        console.log('- Check if the bridge is powered on');
        console.log('- Verify the IP address in your router settings');
        console.log('- Ping the bridge: ping ' + BRIDGE_IP);
        return;
    }

    const authenticated = await testAuthentication();
    if (!authenticated) {
        console.log('\n=== DIAGNOSIS ===');
        console.log('Authentication failed. Possible causes:');
        console.log('1. The API username may have expired or been deleted');
        console.log('2. The bridge may have been reset');
        console.log('\nYou may need to create a new API user.');
        return;
    }

    await testLightsFetch();
    await testSensorsFetch();

    console.log('\n=== Test Complete ===\n');
})();
