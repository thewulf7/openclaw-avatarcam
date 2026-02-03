# openclaw-avatarcam

Generate video messages with a lip-syncing VRM avatar for OpenClaw.

## Installation

```bash
npm install -g openclaw-avatarcam
```

### System Dependencies

| Platform | Command |
|----------|---------|
| **macOS** | `brew install ffmpeg` |
| **Linux** | `sudo apt-get install -y xvfb xauth ffmpeg` |
| **Windows** | Install [ffmpeg](https://www.gyan.dev/ffmpeg/builds/) and add to PATH |
| **Docker** | See [Docker Setup](#docker-setup) |

> **Note:** macOS and Windows don't need xvfb — they have native display support.

## Usage

```bash
# Basic usage with color background
avatarcam --audio voice.mp3 --output video.mp4 --background "#00FF00"

# With image background
avatarcam --audio voice.mp3 --output video.mp4 --background ./bg.png

# With custom avatar
avatarcam --audio voice.mp3 --output video.mp4 --avatar ./my-avatar.vrm
```

## Options

| Option | Required | Description |
|--------|----------|-------------|
| `--audio <path>` | Yes | Input audio file (mp3, wav, etc.) |
| `--output <path>` | Yes | Output video file (.mp4) |
| `--avatar <path>` | No | VRM avatar model (default: built-in) |
| `--background <val>` | No | Color hex or image path (default: #00FF00) |

## Output Format

- **Resolution:** 384x384 (square, optimized for Telegram video notes)
- **Frame rate:** 30fps constant
- **Max duration:** 60 seconds
- **Codec:** H.264 + AAC
- **Container:** MP4

## OpenClaw Integration

This package includes an OpenClaw skill in `skill/SKILL.md`.

**To install the skill:**
```bash
# Copy to your OpenClaw skills folder
cp -r $(npm root -g)/openclaw-avatarcam/skill ~/.openclaw/skills/video-message
```

Or configure manually in `openclaw.json`:
```json
{
  "skills": {
    "entries": {
      "video-message": {
        "avatar": "default.vrm",
        "background": "#00FF00"
      }
    }
  }
}
```

## Docker Setup

Add to `OPENCLAW_DOCKER_APT_PACKAGES`:

```
build-essential procps curl file git ca-certificates xvfb xauth libgbm1 libxss1 libatk1.0-0 libatk-bridge2.0-0 libgdk-pixbuf2.0-0 libgtk-3-0 libasound2 libnss3 ffmpeg
```

## Custom Avatars

Place `.vrm` files in the models directory or specify with `--avatar`:

```bash
avatarcam --audio voice.mp3 --output video.mp4 --avatar ~/my-avatars/custom.vrm
```

## Technical Details

1. Electron renders VRM avatar with lip sync at 1280x720
2. WebM captured via canvas.captureStream(30)
3. FFmpeg processes: crop → fps normalize → scale → encode
4. Output: 384x384 MP4 ready for Telegram sendVideoNote

## Headless Rendering

The CLI auto-detects headless environments:
- Uses `xvfb-run` when `$DISPLAY` is not set (Linux only)
- macOS uses native Quartz display
- GPU stall warnings are safe to ignore

## License

MIT © Evgeny Utkin
