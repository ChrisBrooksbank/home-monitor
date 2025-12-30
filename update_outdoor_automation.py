import requests
import json

BRIDGE_IP = "192.168.68.62"
USERNAME = "XuImnzeJIl13QqlovPsgrA1-Un1zSAJk6woHUjbt"
BEHAVIOR_ID = "3853720c-0c70-41ee-b2f5-b83a65e39090"

# New configuration: single timeslot that covers all day, but only triggers when dark
new_config = {
    "light_level": {
        "daylight": {
            "daylight_sensitivity": {
                "light_level_service": {
                    "rid": "3b6eec42-47e0-4334-b57f-e93b40b2e6f6",
                    "rtype": "light_level"
                },
                "settings": {
                    "dark_threshold": 65534,
                    "offset": 7000
                }
            }
        }
    },
    "motion": {
        "motion_service": {
            "rid": "c23fde92-9f4d-431a-923e-bab1eaef8a13",
            "rtype": "motion"
        },
        "when": {
            "timeslots": [
                {
                    "on_motion": {
                        "recall_single": [
                            {
                                "action": {
                                    "recall": {
                                        "rid": "15ae4671-1b4a-4b8a-b052-90e274f509dd",
                                        "rtype": "scene"
                                    }
                                }
                            },
                            {
                                "action": {
                                    "recall": {
                                        "rid": "1b22fefc-2396-4c24-b64e-97ddccf4111b",
                                        "rtype": "scene"
                                    }
                                }
                            },
                            {
                                "action": {
                                    "recall": {
                                        "rid": "5f278673-3b84-44e6-b533-f9d8abae3f6a",
                                        "rtype": "scene"
                                    }
                                }
                            }
                        ]
                    },
                    "on_no_motion": {
                        "after": {
                            "minutes": 10
                        },
                        "recall_single": [
                            {
                                "action": "previous_state"
                            },
                            {
                                "action": "previous_state"
                            },
                            {
                                "action": "previous_state"
                            }
                        ]
                    },
                    "start_time": {
                        "time": {
                            "hour": 0,
                            "minute": 0
                        },
                        "type": "time"
                    }
                }
            ]
        },
        "where": [
            {
                "group": {
                    "rid": "e6a99cfb-f51b-4e0b-a8bf-b96db749e2e5",
                    "rtype": "room"
                }
            },
            {
                "group": {
                    "rid": "b6863e31-1052-4d05-938a-3b5b7fa93116",
                    "rtype": "room"
                }
            },
            {
                "group": {
                    "rid": "50955670-5477-485e-accd-66cb9e134521",
                    "rtype": "room"
                }
            }
        ]
    },
    "source": {
        "rid": "83649a76-5892-4812-be72-eb68396b7121",
        "rtype": "device"
    }
}

url = f"https://{BRIDGE_IP}/clip/v2/resource/behavior_instance/{BEHAVIOR_ID}"
headers = {
    "hue-application-key": USERNAME,
    "Content-Type": "application/json"
}

payload = {
    "configuration": new_config
}

print("Updating outdoor sensor automation...")
print("="*80)
print("New behavior:")
print("  - Active 24/7 (00:00-00:00)")
print("  - Only triggers when DARK (based on light sensor)")
print("  - On motion: Turn on Bright scenes in Kitchen/hall/Outside")
print("  - After 10 min no motion: Return to PREVIOUS STATE")
print("="*80)

response = requests.put(url, headers=headers, json=payload, verify=False)

if response.status_code == 200:
    print("\n✓ Automation updated successfully!")
    print(json.dumps(response.json(), indent=2))
else:
    print(f"\n✗ Error: {response.status_code}")
    print(response.text)
