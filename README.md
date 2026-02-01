# OpenClaw AvatarCam

This repository contains the implementation for a Virtual VRM Avatar Camera driven by OpenClaw.

## Architecture

```ascii
[OpenClaw Agent] 
      | (HTTP POST or CLI)
      v
[Avatar API (Node.js)]
      | (WebSocket)
      v
[Electron Renderer (Three.js + VRM)] --> [Shared Memory /tmp/openclaw_avatar.raw]
      ^                                              |
      | LipSync via Audio Analysis                  |
      |                                              v
[macOS/Windows VirtualCam Plugin] --> [Zoom / Teams / OBS]
```

## Directory Structure

- **web-avatar/**: Electron application with Three.js VRM renderer
- **models/**: VRM avatar models and animations (.vrm, .vrma)
- **tools/**: Standalone CLI video generator
- **macos-virtualcam/**: C++ sources for the CoreMediaIO DAL Plugin (macOS)
- **windows-virtualcam/**: C++ sources for the DirectShow Filter (Windows)
- **docs/**: Setup instructions and signing guide
- **tests/**: Test scripts

## Quick Start

See [docs/setup.md](docs/setup.md) for detailed installation and routing instructions.

## Video Generation

Generate videos with custom audio, avatar, and background:

```bash
node tools/standalone_gen.js --audio input.wav --output output.mp4 --bg-color "#FF00FF"
```

See the walkthrough for more details.
