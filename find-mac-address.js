// Find IP address for a specific MAC address
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const TARGET_MAC = '74-da-88-ff-f9-3f';

async function findIPbyMAC() {
    console.log(`\n🔍 Searching for device with MAC: ${TARGET_MAC}\n`);

    try {
        // Use arp -a to get ARP table
        const { stdout } = await execPromise('arp -a');

        // Parse ARP table
        const lines = stdout.split('\n');

        for (const line of lines) {
            // Look for the MAC address (normalize formatting)
            const normalizedLine = line.toLowerCase().replace(/[-:]/g, '-');
            const normalizedMAC = TARGET_MAC.toLowerCase();

            if (normalizedLine.includes(normalizedMAC)) {
                // Extract IP address from the line
                const ipMatch = line.match(/(\d+\.\d+\.\d+\.\d+)/);
                if (ipMatch) {
                    console.log('✅ FOUND!');
                    console.log(`   IP Address: ${ipMatch[1]}`);
                    console.log(`   MAC Address: ${TARGET_MAC}`);
                    console.log(`\n📝 Add this to tapo-control.js PLUGS:`);
                    console.log(`   'winter-lights': '${ipMatch[1]}'`);
                    console.log('');
                    return ipMatch[1];
                }
            }
        }

        console.log('❌ Device not found in ARP table');
        console.log('\n💡 Try these steps:');
        console.log('   1. Check your Tapo app: Device Settings → Device Info → IP Address');
        console.log('   2. Ensure the device is powered on and connected to WiFi');
        console.log('   3. Check your router\'s DHCP client list');
        console.log('   4. Ping the device from the Tapo app, then run this script again\n');

        return null;
    } catch (error) {
        console.error('Error scanning network:', error.message);
        return null;
    }
}

findIPbyMAC();
