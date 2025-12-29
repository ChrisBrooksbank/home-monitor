# 🔊 Google Home Broadcast Setup with IFTTT

This guide will help you set up Google Home broadcasts for motion detection alerts using IFTTT webhooks.

## Step 1: Get Your IFTTT Webhook Key

1. Go to https://ifttt.com and sign in (create account if needed)
2. Go to https://ifttt.com/maker_webhooks
3. Click **Settings** (top right)
4. Copy your **webhook key** (it's the last part of the URL shown)
   - Example URL: `https://maker.ifttt.com/use/abc123xyz789`
   - Your key is: `abc123xyz789`

## Step 2: Create IFTTT Applets (One for Each Room)

You need to create 4 applets - one for each monitored room.

### For Outdoor Motion:

1. Go to https://ifttt.com/create
2. Click **If This**:
   - Search for and select **Webhooks**
   - Choose **Receive a web request**
   - Event Name: `motion_outdoor`
   - Click **Create trigger**
3. Click **Then That**:
   - Search for and select **Google Assistant**
   - Choose **Say a phrase with a device**
   - What do you want to say: `Motion detected outside`
   - Which device: Select your Google Home device (or leave blank for all)
   - Click **Create action**
4. Click **Continue**, then **Finish**

### For Hall Motion:

Repeat the above steps with:
- Event Name: `motion_hall`
- Phrase: `Motion detected in the hall`

### For Landing Motion:

Repeat with:
- Event Name: `motion_landing`
- Phrase: `Motion detected on the landing`

### For Bathroom Motion:

Repeat with:
- Event Name: `motion_bathroom`
- Phrase: `Motion detected in the bathroom`

## Step 3: Update Your Webpage Configuration

Open `celcius.html.html` in a text editor and find this section (around line 838):

```javascript
const IFTTT_CONFIG = {
    enabled: false, // Set to true once you've configured IFTTT
    webhookKey: 'YOUR_IFTTT_WEBHOOK_KEY_HERE', // Replace with your key
    events: {
        'Outdoor': 'motion_outdoor',
        'Hall': 'motion_hall',
        'Landing': 'motion_landing',
        'Bathroom': 'motion_bathroom'
    }
};
```

**Change it to:**

```javascript
const IFTTT_CONFIG = {
    enabled: true, // ✅ Enable IFTTT
    webhookKey: 'abc123xyz789', // ✅ Paste your actual webhook key here
    events: {
        'Outdoor': 'motion_outdoor',
        'Hall': 'motion_hall',
        'Landing': 'motion_landing',
        'Bathroom': 'motion_bathroom'
    }
};
```

## Step 4: Test It!

1. Save the file and refresh the webpage
2. Walk past one of your motion sensors
3. You should hear:
   - The local web speech announcement (from your computer)
   - AND the Google Home broadcast (from your Google Home speakers)
4. Check the browser console (F12) for confirmation:
   - ✅ Success: `✅ IFTTT notification sent for [Room]`
   - ❌ Error: Check your webhook key and event names

## Troubleshooting

### Google Home isn't speaking
- Make sure your Google Home is online
- Check that you selected the correct device in IFTTT
- Try saying "Hey Google, broadcast test" to verify your Google Home is working
- Check IFTTT applet settings - make sure it's enabled

### "IFTTT notification sent" but nothing happens
- Wait 1-2 seconds - IFTTT webhooks can have slight delay
- Go to IFTTT.com → Activity to see if webhook was received
- Check that the event names match exactly (case-sensitive)

### Webhook not triggering
- Verify your webhook key is correct
- Check browser console for CORS or network errors
- Make sure `enabled: true` in the config

## Customization

### Change the announcement message
In your IFTTT applet, edit the "What do you want to say" field to customize the message.

### Announce on specific Google Home devices
In IFTTT, specify which device should speak (e.g., "Kitchen speaker" or "Living room display")

### Add more rooms
1. Create a new IFTTT applet with a new event name
2. Add the event to the `IFTTT_CONFIG.events` object
3. Add the room to the `motionSensors` object in the code

## Tips

- **Free tier**: IFTTT free allows unlimited applet runs
- **Delay**: Typical delay is 1-2 seconds from motion to broadcast
- **Volume**: Control Google Home volume with "Hey Google, set volume to 50%"
- **Night mode**: Consider using IFTTT's filter code to only broadcast during certain hours

---

**Need help?** Check your browser console (F12) for debug messages!
