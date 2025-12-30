import requests
import json

BRIDGE_IP = "192.168.68.62"
USERNAME = "XuImnzeJIl13QqlovPsgrA1-Un1zSAJk6woHUjbt"
BEHAVIOR_ID = "5915920b-c177-4773-b7f1-258e56200338"

# Get Office room ID
room_id = "00a34799-7e90-4c64-90a9-04dd0c18bbae"

# Simplified configuration using recall_single with action strings
new_config = {
    "buttons": {
        # Dim down button (keep as-is)
        "171e5eff-3030-44be-ba51-0f82fe17cb37": {
            "on_repeat": {
                "action": "dim_down"
            },
            "where": [{
                "group": {"rid": room_id, "rtype": "room"}
            }]
        },
        # Dim up button (keep as-is)
        "3277870e-8151-4670-8805-f12cbd69922d": {
            "on_repeat": {
                "action": "dim_up"
            },
            "where": [{
                "group": {"rid": room_id, "rtype": "room"}
            }]
        },
        # ON button - all on at 100%
        "b7705431-ef67-4423-ba94-414993d21abb": {
            "on_short_release": {
                "recall_single": [{
                    "action": "all_on"
                }]
            },
            "on_long_press": {
                "action": "do_nothing"
            },
            "where": [{
                "group": {"rid": room_id, "rtype": "room"}
            }]
        },
        # OFF button - all off
        "e49c5fde-0575-4a34-af7d-8288c860fe1c": {
            "on_short_release": {
                "recall_single": [{
                    "action": "all_off"
                }]
            },
            "on_long_press": {
                "action": "do_nothing"
            },
            "where": [{
                "group": {"rid": room_id, "rtype": "room"}
            }]
        }
    },
    "device": {
        "rid": "99d16c28-22bd-4f80-a6b7-1f642d8c1ea7",
        "rtype": "device"
    },
    "model_id": "RWL022"
}

url = f"https://{BRIDGE_IP}/clip/v2/resource/behavior_instance/{BEHAVIOR_ID}"
headers = {
    "hue-application-key": USERNAME,
    "Content-Type": "application/json"
}

payload = {"configuration": new_config}

print("Simplifying OfficeDimmer...")
print("="*80)

response = requests.put(url, headers=headers, json=payload, verify=False)

if response.status_code == 200:
    print("[SUCCESS] OfficeDimmer simplified!")
    print("  ON button: Turn all lights ON at 100%")
    print("  OFF button: Turn all lights OFF")
    print("  Brighten/Dim: Still work")
else:
    print(f"[ERROR] Status: {response.status_code}")
    print(response.text[:500])
