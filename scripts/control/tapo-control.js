// Tapo P105 Smart Plug Control
// Install: npm install tp-link-tapo-connect

import { loginDeviceByIp } from 'tp-link-tapo-connect';

// ========================================
// CONFIGURATION - UPDATE THESE VALUES
// ========================================

const TAPO_EMAIL = 'chrisbrooksbank@gmail.com';
const TAPO_PASSWORD = 'Monty@28';

// Define your Tapo P105 plugs
const PLUGS = {
    'tree': '192.168.68.77',
    'winter': '192.168.68.72',
    'extension': '192.168.68.80'
};

// ========================================
// CONTROL FUNCTIONS
// ========================================

/**
 * Turn a plug ON
 */
async function turnOn(plugName) {
    const ip = PLUGS[plugName];
    if (!ip) {
        throw new Error(`Unknown plug: ${plugName}. Available: ${Object.keys(PLUGS).join(', ')}`);
    }

    console.log(`🔌 Turning ON ${plugName} (${ip})...`);

    try {
        const device = await loginDeviceByIp(TAPO_EMAIL, TAPO_PASSWORD, ip);
        await device.turnOn();
        console.log(`✓ ${plugName} is now ON`);
        return { success: true, plug: plugName, state: 'on' };
    } catch (error) {
        console.error(`✗ Failed to turn on ${plugName}:`, error.message);
        throw error;
    }
}

/**
 * Turn a plug OFF
 */
async function turnOff(plugName) {
    const ip = PLUGS[plugName];
    if (!ip) {
        throw new Error(`Unknown plug: ${plugName}. Available: ${Object.keys(PLUGS).join(', ')}`);
    }

    console.log(`🔌 Turning OFF ${plugName} (${ip})...`);

    try {
        const device = await loginDeviceByIp(TAPO_EMAIL, TAPO_PASSWORD, ip);
        await device.turnOff();
        console.log(`✓ ${plugName} is now OFF`);
        return { success: true, plug: plugName, state: 'off' };
    } catch (error) {
        console.error(`✗ Failed to turn off ${plugName}:`, error.message);
        throw error;
    }
}

/**
 * Toggle a plug (ON → OFF or OFF → ON)
 */
async function toggle(plugName) {
    const ip = PLUGS[plugName];
    if (!ip) {
        throw new Error(`Unknown plug: ${plugName}. Available: ${Object.keys(PLUGS).join(', ')}`);
    }

    console.log(`🔌 Toggling ${plugName} (${ip})...`);

    try {
        const device = await loginDeviceByIp(TAPO_EMAIL, TAPO_PASSWORD, ip);
        const info = await device.getDeviceInfo();
        const currentState = info.device_on;

        if (currentState) {
            await device.turnOff();
            console.log(`✓ ${plugName} toggled OFF`);
            return { success: true, plug: plugName, state: 'off' };
        } else {
            await device.turnOn();
            console.log(`✓ ${plugName} toggled ON`);
            return { success: true, plug: plugName, state: 'on' };
        }
    } catch (error) {
        console.error(`✗ Failed to toggle ${plugName}:`, error.message);
        throw error;
    }
}

/**
 * Get plug status and information
 */
async function getStatus(plugName) {
    const ip = PLUGS[plugName];
    if (!ip) {
        throw new Error(`Unknown plug: ${plugName}. Available: ${Object.keys(PLUGS).join(', ')}`);
    }

    console.log(`📊 Getting status for ${plugName} (${ip})...`);

    try {
        const device = await loginDeviceByIp(TAPO_EMAIL, TAPO_PASSWORD, ip);
        const info = await device.getDeviceInfo();

        const status = {
            name: plugName,
            ip: ip,
            state: info.device_on ? 'ON' : 'OFF',
            model: info.model,
            deviceId: info.device_id,
            nickname: info.nickname,
            rssi: info.rssi + ' dBm',
            onTime: Math.floor(info.on_time / 60) + ' minutes'
        };

        console.log(`\n${plugName} Status:`);
        console.log(`  State: ${status.state}`);
        console.log(`  Model: ${status.model}`);
        console.log(`  Signal: ${status.rssi}`);
        console.log(`  On Time: ${status.onTime}`);

        return status;
    } catch (error) {
        console.error(`✗ Failed to get status for ${plugName}:`, error.message);
        throw error;
    }
}

/**
 * Get status of all plugs
 */
async function getAllStatus() {
    console.log('📊 Checking all plugs...\n');

    const results = {};
    for (const [name, ip] of Object.entries(PLUGS)) {
        try {
            results[name] = await getStatus(name);
        } catch (error) {
            results[name] = { error: error.message };
        }
    }

    return results;
}

// ========================================
// CLI INTERFACE
// ========================================

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('\nTapo P105 Smart Plug Control');
        console.log('============================\n');
        console.log('Usage:');
        console.log('  node tapo-control.js on <plug-name>      - Turn plug on');
        console.log('  node tapo-control.js off <plug-name>     - Turn plug off');
        console.log('  node tapo-control.js toggle <plug-name>  - Toggle plug state');
        console.log('  node tapo-control.js status <plug-name>  - Get plug status');
        console.log('  node tapo-control.js status all          - Get all plug statuses');
        console.log('\nConfigured plugs:');
        Object.entries(PLUGS).forEach(([name, ip]) => {
            console.log(`  - ${name} (${ip})`);
        });
        console.log('\n⚠️  Remember to update TAPO_EMAIL and TAPO_PASSWORD in this file!\n');
        process.exit(0);
    }

    const command = args[0].toLowerCase();
    const plugName = args[1];

    (async () => {
        try {
            switch (command) {
                case 'on':
                    if (!plugName) throw new Error('Please specify a plug name');
                    await turnOn(plugName);
                    break;

                case 'off':
                    if (!plugName) throw new Error('Please specify a plug name');
                    await turnOff(plugName);
                    break;

                case 'toggle':
                    if (!plugName) throw new Error('Please specify a plug name');
                    await toggle(plugName);
                    break;

                case 'status':
                    if (plugName === 'all') {
                        await getAllStatus();
                    } else if (plugName) {
                        await getStatus(plugName);
                    } else {
                        throw new Error('Please specify a plug name or "all"');
                    }
                    break;

                default:
                    console.error(`Unknown command: ${command}`);
                    console.log('Valid commands: on, off, toggle, status');
                    process.exit(1);
            }
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    })();
}

// Export functions for use in other scripts
export {
    turnOn,
    turnOff,
    toggle,
    getStatus,
    getAllStatus,
    PLUGS
};
