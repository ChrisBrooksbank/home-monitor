#!/bin/bash

BRIDGE_IP="192.168.68.62"
USERNAME="XuImnzeJIl13QqlovPsgrA1-Un1zSAJk6woHUjbt"

# All light IDs
LIGHTS=(1 2 3 4 8 9 11 12 13 14 15 16 17 18 19 20 21)

echo "Flashing all lights for 10 seconds..."

END_TIME=$((SECONDS + 10))

while [ $SECONDS -lt $END_TIME ]; do
    # Turn all lights ON
    for LIGHT_ID in "${LIGHTS[@]}"; do
        curl -X PUT \
            "http://$BRIDGE_IP/api/$USERNAME/lights/$LIGHT_ID/state" \
            -d '{"on":true,"bri":254,"alert":"none"}' \
            -s > /dev/null &
    done
    wait
    sleep 0.3

    # Turn all lights OFF
    for LIGHT_ID in "${LIGHTS[@]}"; do
        curl -X PUT \
            "http://$BRIDGE_IP/api/$USERNAME/lights/$LIGHT_ID/state" \
            -d '{"on":false}' \
            -s > /dev/null &
    done
    wait
    sleep 0.3
done

echo "Flash complete!"
