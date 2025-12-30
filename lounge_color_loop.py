import requests
import time
import json

BRIDGE_IP = "192.168.68.62"
USERNAME = "XuImnzeJIl13QqlovPsgrA1-Un1zSAJk6woHUjbt"

# Lounge color lights
LOUNGE_COLOR_LIGHTS = [9, 12]  # loungeLight2 and LoungeLight3

def set_light_color(light_id, hue, saturation=254, brightness=254):
    """Set a light to a specific color using hue value"""
    url = f"http://{BRIDGE_IP}/api/{USERNAME}/lights/{light_id}/state"
    payload = {
        "on": True,
        "hue": hue,
        "sat": saturation,
        "bri": brightness,
        "transitiontime": 10  # 1 second transition (10 * 100ms)
    }
    response = requests.put(url, json=payload)
    return response.json()

def color_loop(duration_seconds=None, speed=2):
    """
    Loop through colors continuously
    duration_seconds: how long to run (None = forever)
    speed: seconds between color changes
    """
    print(f"Starting color loop for lounge lights (IDs: {LOUNGE_COLOR_LIGHTS})")
    print(f"Speed: {speed} seconds per color change")
    if duration_seconds:
        print(f"Duration: {duration_seconds} seconds")
    else:
        print("Duration: Forever (press Ctrl+C to stop)")
    print()

    start_time = time.time()
    hue = 0

    try:
        while True:
            # Check if we've exceeded duration
            if duration_seconds and (time.time() - start_time) > duration_seconds:
                print("\nDuration reached. Stopping color loop.")
                break

            # Set color for all lounge lights
            for light_id in LOUNGE_COLOR_LIGHTS:
                set_light_color(light_id, hue, saturation=254, brightness=254)

            color_name = get_color_name(hue)
            print(f"Color: {color_name} (hue: {hue})")

            # Increment hue (0-65535 range for Philips Hue)
            hue = (hue + 5000) % 65535

            time.sleep(speed)

    except KeyboardInterrupt:
        print("\n\nColor loop stopped by user.")
        print("Lights will remain at their current color.")

def get_color_name(hue):
    """Get approximate color name from hue value"""
    # Hue range is 0-65535
    # Red: 0, Orange: 5000, Yellow: 12000, Green: 25000,
    # Cyan: 35000, Blue: 46000, Purple: 50000, Pink: 56000

    if hue < 3000:
        return "Red"
    elif hue < 8000:
        return "Orange"
    elif hue < 16000:
        return "Yellow"
    elif hue < 30000:
        return "Green"
    elif hue < 40000:
        return "Cyan"
    elif hue < 48000:
        return "Blue"
    elif hue < 54000:
        return "Purple"
    else:
        return "Pink"

if __name__ == "__main__":
    import sys

    # Parse command line arguments
    speed = 2  # default speed
    duration = None  # default duration (forever)

    if len(sys.argv) > 1:
        try:
            speed = float(sys.argv[1])
        except ValueError:
            print("Invalid speed value. Using default: 2 seconds")

    if len(sys.argv) > 2:
        try:
            duration = int(sys.argv[2])
        except ValueError:
            print("Invalid duration value. Running forever.")

    print("=" * 50)
    print("LOUNGE LIGHTS COLOR LOOP")
    print("=" * 50)
    color_loop(duration_seconds=duration, speed=speed)
