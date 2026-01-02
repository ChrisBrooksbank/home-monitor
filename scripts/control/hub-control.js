// Google Home Hub Control Library
// Controls for your Google Home Hub at 192.168.68.62

const http = require('http');
const https = require('https');

const HUB_IP = '192.168.68.62';
const HUB_PORT = 8008;
const HUB_NAME = 'Hub';

// ========================================
// DEVICE INFO & STATUS
// ========================================

/**
 * Get device information
 */
async function getDeviceInfo() {
    return new Promise((resolve, reject) => {
        http.get(`http://${HUB_IP}:${HUB_PORT}/setup/eureka_info`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const info = JSON.parse(data);
                    resolve({
                        name: info.name,
                        ip: info.ip_address,
                        mac: info.mac_address,
                        version: info.build_version,
                        uptime: Math.floor(info.uptime / 3600) + ' hours',
                        connected: info.connected
                    });
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

/**
 * Get current playback status
 */
async function getStatus() {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            requestId: 1,
            type: 'GET_STATUS'
        });

        const options = {
            hostname: HUB_IP,
            port: HUB_PORT,
            path: '/apps',
            method: 'GET',
            timeout: 3000
        };

        http.get(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const status = JSON.parse(data);

                    if (status.applications && status.applications.length > 0) {
                        const app = status.applications[0];
                        resolve({
                            isPlaying: true,
                            appId: app.appId,
                            displayName: app.displayName,
                            statusText: app.statusText || 'Active'
                        });
                    } else {
                        resolve({
                            isPlaying: false,
                            appId: null,
                            displayName: 'Idle',
                            statusText: 'Ready'
                        });
                    }
                } catch (e) {
                    // If JSON parse fails, Hub is likely idle
                    resolve({
                        isPlaying: false,
                        appId: null,
                        displayName: 'Idle',
                        statusText: 'Ready'
                    });
                }
            });
        }).on('error', reject);
    });
}

// ========================================
// MEDIA CONTROLS
// ========================================

/**
 * Stop current playback
 */
async function stop() {
    console.log(`🛑 Stopping playback on ${HUB_NAME}...`);

    try {
        const status = await getStatus();

        if (!status.isPlaying) {
            console.log('ℹ️  Hub is already idle');
            return { success: true, message: 'Hub is idle' };
        }

        // Post empty request to stop app
        const postData = '';
        const options = {
            hostname: HUB_IP,
            port: HUB_PORT,
            path: `/apps/${status.appId}`,
            method: 'DELETE',
            timeout: 3000
        };

        return new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                console.log('✓ Playback stopped');
                resolve({ success: true, message: 'Stopped' });
            });

            req.on('error', reject);
            req.end(postData);
        });
    } catch (error) {
        console.error('✗ Failed to stop playback:', error.message);
        throw error;
    }
}

/**
 * Set volume (0-100)
 */
async function setVolume(level) {
    if (level < 0 || level > 100) {
        throw new Error('Volume must be between 0 and 100');
    }

    console.log(`🔊 Setting ${HUB_NAME} volume to ${level}%...`);

    const volumeLevel = level / 100;

    const postData = JSON.stringify({
        type: 'SET_VOLUME',
        volume: {
            level: volumeLevel,
            muted: false
        }
    });

    const options = {
        hostname: HUB_IP,
        port: HUB_PORT,
        path: '/connection',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 3000
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            console.log(`✓ Volume set to ${level}%`);
            resolve({ success: true, volume: level });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// ========================================
// CASTING FUNCTIONS
// ========================================

/**
 * Cast a YouTube video to the Hub
 */
async function castYouTube(videoId) {
    console.log(`📺 Casting YouTube video ${videoId} to ${HUB_NAME}...`);

    const appId = '233637DE'; // YouTube app ID

    const postData = JSON.stringify({
        type: 'LOAD',
        media: {
            contentId: videoId,
            streamType: 'BUFFERED',
            contentType: 'video/mp4'
        }
    });

    const options = {
        hostname: HUB_IP,
        port: HUB_PORT,
        path: `/apps/YouTube`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 5000
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`✓ YouTube video casting to ${HUB_NAME}`);
                resolve({
                    success: true,
                    videoId: videoId,
                    message: 'Casting YouTube video'
                });
            });
        });

        req.on('error', (err) => {
            console.error('✗ Failed to cast YouTube:', err.message);
            reject(err);
        });

        req.write(postData);
        req.end();
    });
}

/**
 * Display a web page on the Hub
 */
async function displayWebPage(url) {
    console.log(`🌐 Displaying web page on ${HUB_NAME}: ${url}`);

    const appId = 'E8C28D3C'; // Default Media Receiver

    const postData = JSON.stringify({
        type: 'LOAD',
        media: {
            contentId: url,
            contentType: 'text/html',
            streamType: 'LIVE'
        }
    });

    const options = {
        hostname: HUB_IP,
        port: HUB_PORT,
        path: `/apps/${appId}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        timeout: 5000
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            console.log(`✓ Web page displayed on ${HUB_NAME}`);
            resolve({ success: true, url: url });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

/**
 * Show your home dashboard on the Hub
 */
async function showDashboard() {
    // Assumes your dashboard is running on port 3000
    // Update this URL to match your actual dashboard URL
    const dashboardUrl = 'http://192.168.68.1:3000/index.html'; // Update with your server IP

    console.log(`🏠 Displaying home dashboard on ${HUB_NAME}...`);
    return displayWebPage(dashboardUrl);
}

// ========================================
// ANNOUNCEMENTS (Text-to-Speech)
// ========================================

/**
 * Make an announcement on the Hub using Google TTS
 */
async function announce(message, language = 'en') {
    console.log(`📢 Announcing on ${HUB_NAME}: "${message}"`);

    // Use Google Translate TTS API
    const encodedMessage = encodeURIComponent(message);
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${language}&q=${encodedMessage}`;

    const appId = 'CC1AD845'; // Default Media Receiver for audio

    const postData = JSON.stringify({
        type: 'LOAD',
        autoplay: true,
        media: {
            contentId: ttsUrl,
            contentType: 'audio/mp3',
            streamType: 'BUFFERED'
        }
    });

    const options = {
        hostname: HUB_IP,
        port: HUB_PORT,
        path: `/apps/${appId}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 5000
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            console.log(`✓ Announcement sent to ${HUB_NAME}`);
            resolve({ success: true, message: message });
        });

        req.on('error', (err) => {
            console.error('✗ Failed to announce:', err.message);
            reject(err);
        });

        req.write(postData);
        req.end();
    });
}

/**
 * Reboot the Hub
 */
async function reboot() {
    console.log(`🔄 Rebooting ${HUB_NAME}...`);

    const options = {
        hostname: HUB_IP,
        port: HUB_PORT,
        path: '/setup/reboot',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        timeout: 5000
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            console.log(`✓ ${HUB_NAME} is rebooting...`);
            resolve({ success: true, message: 'Rebooting' });
        });

        req.on('error', reject);
        req.end(JSON.stringify({ params: 'now' }));
    });
}

// ========================================
// CONVENIENCE FUNCTIONS
// ========================================

/**
 * Play a YouTube video by search term or video ID
 */
async function playYouTube(searchOrId) {
    // If it's a full URL, extract video ID
    let videoId = searchOrId;

    if (searchOrId.includes('youtube.com') || searchOrId.includes('youtu.be')) {
        const match = searchOrId.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
        if (match) {
            videoId = match[1];
        }
    }

    return castYouTube(videoId);
}

/**
 * Quick announcement shortcuts
 */
const announcements = {
    dinnerReady: () => announce("Dinner is ready! Please come to the dining room."),
    goodMorning: () => announce("Good morning! Have a wonderful day."),
    goodNight: () => announce("Good night! Sleep well."),
    doorbell: () => announce("Someone is at the door."),
    reminder: (text) => announce(`Reminder: ${text}`)
};

// ========================================
// CLI INTERFACE
// ========================================

if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('\nGoogle Home Hub Control');
        console.log('=======================\n');
        console.log(`Hub: ${HUB_NAME} (${HUB_IP})\n`);
        console.log('Usage:');
        console.log('  node hub-control.js info                      - Get device info');
        console.log('  node hub-control.js status                    - Get playback status');
        console.log('  node hub-control.js stop                      - Stop playback');
        console.log('  node hub-control.js volume <0-100>            - Set volume');
        console.log('  node hub-control.js youtube <video-id>        - Play YouTube video');
        console.log('  node hub-control.js web <url>                 - Display web page');
        console.log('  node hub-control.js dashboard                 - Show home dashboard');
        console.log('  node hub-control.js announce "<message>"      - Make announcement');
        console.log('  node hub-control.js reboot                    - Reboot Hub');
        console.log('\nExamples:');
        console.log('  node hub-control.js youtube dQw4w9WgXcQ');
        console.log('  node hub-control.js announce "Dinner is ready"');
        console.log('  node hub-control.js volume 50\n');
        process.exit(0);
    }

    const command = args[0].toLowerCase();
    const param = args.slice(1).join(' ');

    (async () => {
        try {
            switch (command) {
                case 'info':
                    const info = await getDeviceInfo();
                    console.log('\nHub Information:');
                    console.log(`  Name: ${info.name}`);
                    console.log(`  IP: ${info.ip}`);
                    console.log(`  MAC: ${info.mac}`);
                    console.log(`  Version: ${info.version}`);
                    console.log(`  Uptime: ${info.uptime}`);
                    console.log(`  Connected: ${info.connected}\n`);
                    break;

                case 'status':
                    const status = await getStatus();
                    console.log('\nPlayback Status:');
                    console.log(`  State: ${status.displayName}`);
                    console.log(`  Status: ${status.statusText}`);
                    console.log(`  Playing: ${status.isPlaying ? 'Yes' : 'No'}\n`);
                    break;

                case 'stop':
                    await stop();
                    break;

                case 'volume':
                    if (!param) throw new Error('Please specify volume level (0-100)');
                    const volume = parseInt(param);
                    await setVolume(volume);
                    break;

                case 'youtube':
                case 'yt':
                    if (!param) throw new Error('Please specify YouTube video ID or URL');
                    await playYouTube(param);
                    break;

                case 'web':
                case 'url':
                    if (!param) throw new Error('Please specify URL');
                    await displayWebPage(param);
                    break;

                case 'dashboard':
                    await showDashboard();
                    break;

                case 'announce':
                case 'say':
                    if (!param) throw new Error('Please specify message to announce');
                    await announce(param);
                    break;

                case 'reboot':
                    await reboot();
                    break;

                default:
                    console.error(`Unknown command: ${command}`);
                    console.log('Run without arguments to see available commands');
                    process.exit(1);
            }

            process.exit(0);
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    })();
}

// Export functions
module.exports = {
    getDeviceInfo,
    getStatus,
    stop,
    setVolume,
    castYouTube,
    playYouTube,
    displayWebPage,
    showDashboard,
    announce,
    announcements,
    reboot,
    HUB_IP,
    HUB_NAME
};
