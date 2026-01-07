// NVIDIA SHIELD Control Library
// Uses Google Cast protocol to control SHIELD Android TV

import http from 'http';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(execCallback);

const SHIELD_IP = '192.168.68.63';
const SHIELD_PORT = 8008;

// Find ADB executable
function findAdb() {
    // Common ADB locations on Windows
    const possiblePaths = [
        // Winget installation
        join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages', 'Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe', 'platform-tools', 'adb.exe'),
        // Standard Android SDK location
        join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
        // Chocolatey
        'C:\\ProgramData\\chocolatey\\bin\\adb.exe',
        // Manual install
        'C:\\platform-tools\\adb.exe'
    ];

    for (const adbPath of possiblePaths) {
        if (existsSync(adbPath)) {
            return `"${adbPath}"`;
        }
    }

    // Fall back to hoping it's in PATH
    return 'adb';
}

const ADB_PATH = findAdb();

// Common app IDs for Google Cast
const APPS = {
    netflix: 'CA5E8412',
    youtube: '233637DE',
    plex: '06EE44FE',
    spotify: 'CC32E753',
    twitch: '3E5D9C28',
    hbo: 'A81C1C43',
    prime: 'A12E4113',
    disney: '2D71BC2E'
};

/**
 * Launch an app on the SHIELD using ADB
 * Requires: ADB installed and SHIELD with debugging enabled
 */
async function launchApp(appName) {
    const appPackages = {
        netflix: 'com.netflix.ninja/.MainActivity',
        youtube: 'com.google.android.youtube.tv/com.google.android.apps.youtube.tv.activity.ShellActivity',
        plex: 'com.plexapp.android/.PlatformPlayerActivity',
        spotify: 'com.spotify.tv.android/com.spotify.tv.android.SpotifyTVActivity',
        twitch: 'tv.twitch.android.app/tv.twitch.android.feature.LaunchActivity',
        hbo: 'com.hbo.hbonow/.MainActivity',
        prime: 'com.amazon.avod.thirdpartyclient/.LauncherActivity',
        disney: 'com.disney.disneyplus/com.bamtechmedia.dominguez.main.MainActivity',
        settings: 'com.android.settings/.Settings'
    };

    const component = appPackages[appName.toLowerCase()];

    if (!component) {
        throw new Error(`Unknown app: ${appName}. Available: ${Object.keys(appPackages).join(', ')}`);
    }

    console.log(`📺 Launching ${appName} on SHIELD via ADB...`);

    try {
        console.log(`Using ADB: ${ADB_PATH}`);

        // Launch app using ADB
        const { stdout, stderr } = await execAsync(
            `${ADB_PATH} connect ${SHIELD_IP}:5555 && ${ADB_PATH} shell am start -n ${component}`
        );

        if (stderr && !stderr.includes('already connected')) {
            console.error('ADB stderr:', stderr);
        }

        // Check for connection refused errors
        if (stdout.includes('refused') || stdout.includes('10061')) {
            throw new Error('SHIELD connection refused - enable Network Debugging on SHIELD');
        }

        console.log(`✓ ${appName} launched successfully`);
        console.log('ADB output:', stdout);

        return {
            success: true,
            app: appName,
            component: component,
            output: stdout
        };

    } catch (error) {
        console.error(`✗ Failed to launch ${appName}:`, error.message);

        // Provide helpful error messages
        if (error.message.includes('command not found') || error.message.includes('not recognized')) {
            throw new Error('ADB not installed. Run: winget install Google.PlatformTools');
        } else if (error.message.includes('refused') || error.message.includes('10061') || error.message.includes('unable to connect')) {
            throw new Error(`SHIELD connection refused. Enable Network Debugging: Settings → Device Preferences → Developer Options → Network Debugging`);
        } else {
            throw error;
        }
    }
}

/**
 * Stop the currently running app / Go to home screen
 */
async function stopApp() {
    console.log('📺 Returning to home screen...');

    try {
        const { stdout } = await execAsync(
            `${ADB_PATH} connect ${SHIELD_IP}:5555 && ${ADB_PATH} shell input keyevent KEYCODE_HOME`
        );

        // Check for connection refused errors
        if (stdout.includes('refused') || stdout.includes('10061')) {
            throw new Error('SHIELD connection refused - enable Network Debugging on SHIELD');
        }

        console.log('✓ Returned to home screen');

        return {
            success: true,
            action: 'home',
            output: stdout
        };

    } catch (error) {
        console.error('✗ Failed to go home:', error.message);
        if (error.message.includes('refused') || error.message.includes('10061')) {
            throw new Error(`SHIELD connection refused. Enable Network Debugging: Settings → Device Preferences → Developer Options → Network Debugging`);
        }
        throw error;
    }
}

/**
 * Get SHIELD device info
 */
async function getDeviceInfo() {
    return new Promise((resolve, reject) => {
        http.get(`http://${SHIELD_IP}:${SHIELD_PORT}/setup/eureka_info`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const info = JSON.parse(data);
                    resolve({
                        name: info.name,
                        ip: info.ip_address,
                        connected: info.connected,
                        uptime: Math.floor(info.uptime / 3600) + ' hours'
                    });
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

/**
 * Send a notification to the SHIELD
 */
async function sendNotification(message) {
    console.log(`📺 Sending notification to SHIELD: "${message}"`);
    // This would require a custom receiver app
    // For now, return a placeholder
    return { success: false, message: 'Notifications require custom receiver app' };
}

// Export functions
export {
    launchApp,
    stopApp,
    getDeviceInfo,
    sendNotification,
    APPS
};

// CLI usage
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('\nNVIDIA SHIELD Control');
        console.log('====================\n');
        console.log('Usage:');
        console.log('  node shield-control.js launch <app>    - Launch an app');
        console.log('  node shield-control.js stop             - Stop current app');
        console.log('  node shield-control.js info             - Get device info');
        console.log('\nAvailable apps:');
        console.log(' ', Object.keys(APPS).join(', '));
        process.exit(0);
    }

    const command = args[0];
    const param = args[1];

    switch (command) {
        case 'launch':
            if (!param) {
                console.error('Error: Please specify an app name');
                console.log('Available:', Object.keys(APPS).join(', '));
                process.exit(1);
            }
            launchApp(param)
                .then(() => process.exit(0))
                .catch(err => {
                    console.error('Error:', err.message);
                    process.exit(1);
                });
            break;

        case 'stop':
            stopApp()
                .then(() => process.exit(0))
                .catch(err => {
                    console.error('Error:', err.message);
                    process.exit(1);
                });
            break;

        case 'info':
            getDeviceInfo()
                .then(info => {
                    console.log('\nSHIELD Device Info:');
                    console.log('  Name:', info.name);
                    console.log('  IP:', info.ip);
                    console.log('  Connected:', info.connected);
                    console.log('  Uptime:', info.uptime);
                    process.exit(0);
                })
                .catch(err => {
                    console.error('Error:', err.message);
                    process.exit(1);
                });
            break;

        default:
            console.error('Unknown command:', command);
            console.log('Use: launch, stop, or info');
            process.exit(1);
    }
}
