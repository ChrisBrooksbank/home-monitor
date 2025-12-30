#!/bin/bash

BRIDGE_IP="192.168.68.62"
USERNAME="XuImnzeJIl13QqlovPsgrA1-Un1zSAJk6woHUjbt"

# Lounge color lights
LIGHTS=(9 12)

echo "=========================================="
echo "LOUNGE LIGHTS COLOR LOOP"
echo "=========================================="
echo "Lights: loungeLight2 (ID 9), LoungeLight3 (ID 12)"
echo "Press Ctrl+C to stop"
echo ""

# Color loop
HUE=0
COLORS=("Red" "Orange" "Yellow" "Green" "Cyan" "Blue" "Purple" "Pink")
COLOR_HUES=(0 5000 12000 25000 35000 46000 50000 56000)

while true; do
    for i in "${!COLOR_HUES[@]}"; do
        HUE=${COLOR_HUES[$i]}
        COLOR=${COLORS[$i]}

        echo "Setting color: $COLOR (hue: $HUE)"

        # Set color for each lounge light
        for LIGHT_ID in "${LIGHTS[@]}"; do
            curl -X PUT \
                "http://$BRIDGE_IP/api/$USERNAME/lights/$LIGHT_ID/state" \
                -d "{\"on\":true,\"hue\":$HUE,\"sat\":254,\"bri\":254,\"transitiontime\":10}" \
                -s > /dev/null
        done

        sleep 2
    done
done
