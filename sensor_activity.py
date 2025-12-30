import requests
from datetime import datetime, timezone
import sys

BRIDGE_IP = "192.168.68.62"
USERNAME = "XuImnzeJIl13QqlovPsgrA1-Un1zSAJk6woHUjbt"

def get_time_ago(timestamp_str):
    """Convert ISO timestamp to human-readable time ago"""
    if timestamp_str == "none" or not timestamp_str:
        return "Never"

    try:
        # Parse the timestamp (format: 2025-12-28T18:03:02)
        last_update = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        if last_update.tzinfo is None:
            last_update = last_update.replace(tzinfo=timezone.utc)

        now = datetime.now(timezone.utc)
        diff = now - last_update

        seconds = int(diff.total_seconds())

        if seconds < 60:
            return f"{seconds} seconds ago"
        elif seconds < 3600:
            minutes = seconds // 60
            return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
        elif seconds < 86400:
            hours = seconds // 3600
            return f"{hours} hour{'s' if hours != 1 else ''} ago"
        else:
            days = seconds // 86400
            return f"{days} day{'s' if days != 1 else ''} ago"
    except Exception as e:
        return f"Error parsing: {timestamp_str}"

def list_sensor_activity():
    """List all sensors and their last activity time"""
    url = f"http://{BRIDGE_IP}/api/{USERNAME}/sensors"

    try:
        response = requests.get(url)
        response.raise_for_status()
        sensors = response.json()
    except Exception as e:
        print(f"Error connecting to Hue Bridge: {e}")
        return

    print("=" * 80)
    print("HUE SENSOR ACTIVITY")
    print("=" * 80)
    print()

    # Group sensors by type
    motion_sensors = []
    temperature_sensors = []
    dimmer_switches = []
    other_sensors = []

    for sensor_id, sensor_info in sensors.items():
        sensor_type = sensor_info.get('type', 'Unknown')
        name = sensor_info.get('name', 'Unknown')
        state = sensor_info.get('state', {})
        config = sensor_info.get('config', {})
        lastupdated = state.get('lastupdated', 'none')

        sensor_data = {
            'id': sensor_id,
            'name': name,
            'type': sensor_type,
            'lastupdated': lastupdated,
            'state': state,
            'config': config
        }

        if sensor_type == 'ZLLPresence':
            motion_sensors.append(sensor_data)
        elif sensor_type == 'ZLLTemperature':
            temperature_sensors.append(sensor_data)
        elif sensor_type == 'ZLLLightLevel':
            temperature_sensors.append(sensor_data)  # Group with temp sensors
        elif sensor_type == 'ZLLSwitch':
            dimmer_switches.append(sensor_data)
        elif sensor_type not in ['Daylight', 'CLIPGenericStatus']:
            other_sensors.append(sensor_data)

    # Print Motion Sensors
    if motion_sensors:
        print("MOTION SENSORS")
        print("-" * 80)
        for sensor in motion_sensors:
            time_ago = get_time_ago(sensor['lastupdated'])
            presence = sensor['state'].get('presence', False)
            battery = sensor['config'].get('battery', 'N/A')
            status = "MOTION DETECTED" if presence else "No motion"

            print(f"{sensor['name']} (ID {sensor['id']})")
            print(f"  Status: {status}")
            print(f"  Last updated: {time_ago}")
            print(f"  Battery: {battery}%")
            print()

    # Print Temperature Sensors
    if temperature_sensors:
        print("TEMPERATURE/LIGHT SENSORS")
        print("-" * 80)
        for sensor in temperature_sensors:
            time_ago = get_time_ago(sensor['lastupdated'])
            battery = sensor['config'].get('battery', 'N/A')

            print(f"{sensor['name']} (ID {sensor['id']}) - {sensor['type']}")

            if sensor['type'] == 'ZLLTemperature':
                temp = sensor['state'].get('temperature')
                if temp is not None:
                    temp_c = temp / 100.0
                    print(f"  Temperature: {temp_c}°C")
                else:
                    print(f"  Temperature: N/A")
            elif sensor['type'] == 'ZLLLightLevel':
                lightlevel = sensor['state'].get('lightlevel')
                if lightlevel is not None:
                    print(f"  Light level: {lightlevel}")
                else:
                    print(f"  Light level: N/A")

            print(f"  Last updated: {time_ago}")
            print(f"  Battery: {battery}%")
            print()

    # Print Dimmer Switches
    if dimmer_switches:
        print("DIMMER SWITCHES")
        print("-" * 80)
        for sensor in dimmer_switches:
            time_ago = get_time_ago(sensor['lastupdated'])
            button_event = sensor['state'].get('buttonevent')
            battery = sensor['config'].get('battery', 'N/A')

            print(f"{sensor['name']} (ID {sensor['id']})")
            if button_event:
                print(f"  Last button: {button_event}")
            print(f"  Last pressed: {time_ago}")
            print(f"  Battery: {battery}%")
            print()

    # Print Other Sensors
    if other_sensors:
        print("OTHER SENSORS")
        print("-" * 80)
        for sensor in other_sensors:
            time_ago = get_time_ago(sensor['lastupdated'])

            print(f"{sensor['name']} (ID {sensor['id']}) - {sensor['type']}")
            print(f"  Last updated: {time_ago}")
            print(f"  State: {sensor['state']}")
            print()

if __name__ == "__main__":
    list_sensor_activity()
