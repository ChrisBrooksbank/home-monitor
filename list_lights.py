import requests
import json
import sys

BRIDGE_IP = "192.168.68.62"

def create_user():
    """Create a new API user - requires pressing the link button on the bridge first"""
    url = f"http://{BRIDGE_IP}/api"
    payload = {"devicetype": "hue_light_manager#user"}

    response = requests.post(url, json=payload)
    result = response.json()
    print(json.dumps(result, indent=2))

    if isinstance(result, list) and len(result) > 0:
        if "success" in result[0]:
            username = result[0]["success"]["username"]
            print(f"\n✓ Success! Your API username is: {username}")
            print("Save this for future use!")
            return username
        elif "error" in result[0]:
            print(f"\n✗ Error: {result[0]['error']['description']}")
    return None

def list_lights(username):
    """List all lights connected to the bridge"""
    url = f"http://{BRIDGE_IP}/api/{username}/lights"

    response = requests.get(url)
    lights = response.json()

    print(f"\n{'='*60}")
    print(f"Hue Lights on Bridge {BRIDGE_IP}")
    print(f"{'='*60}\n")

    for light_id, light_info in lights.items():
        name = light_info.get('name', 'Unknown')
        state = light_info.get('state', {})
        on = state.get('on', False)
        bri = state.get('bri', 0)
        model = light_info.get('modelid', 'Unknown')

        status = "ON" if on else "OFF"
        brightness = f"{int(bri/254*100)}%" if on else "N/A"

        print(f"ID {light_id}: {name}")
        print(f"  Status: {status}")
        print(f"  Brightness: {brightness}")
        print(f"  Model: {model}")
        print()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Use provided username
        username = sys.argv[1]
        list_lights(username)
    else:
        print("No API username provided.")
        print("\nTo create a new user:")
        print("1. Press the link button on your Hue Bridge")
        print("2. Run: python list_lights.py create")
        print("\nTo list lights with existing username:")
        print("   python list_lights.py YOUR_USERNAME")

        if len(sys.argv) > 1 and sys.argv[1] == "create":
            create_user()
