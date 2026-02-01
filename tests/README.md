# Tests

This directory contains scripts to verify the OpenClaw Avatar functionality.

## 1. WebSocket Relay Test (`test_relay.js`)
Verifies that the Avatar API correctly accepts WebSocket connections and relays messages (Reactions, Audio Chunks) to the renderer.

### Usage
1.  Ensure the App is running: `npm start` (in `../web-avatar`).
2.  Run the test:
    ```bash
    cd ../web-avatar
    node ../tests/test_relay.js
    ```
    *Note: We run from `web-avatar` to use its `ws` dependency without reinstalling.*

### Expected Output
-   "Connected to Avatar API"
-   "Sending Smile Reaction..."
-   "Sending Dummy Audio..."

## 2. LipSync Audio Test (`test_lipsync.sh`)
Sends a generated sine wave audio chunk to the legacy `/speak` HTTP endpoint to test audio decoding and lip-sync movement.

### Usage
```bash
./test_lipsync.sh
```

### Expected Output
-   `{"status":"sent","length":...}`
-   You should hear a short "beep" from the avatar and see the mouth move.
