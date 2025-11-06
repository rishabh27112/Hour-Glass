# Hour-Glass Linux Time Tracker

This is the Linux version of the Hour-Glass time tracking application. It tracks which applications you're using and for how long, similar to the Windows version.

## Requirements

### System Requirements
- **X11 (X.org) display server** - **REQUIRED**
- **NOT compatible with Wayland**

## How It Works

The app uses `xdotool` to query the X11 server for the currently active window. It:
1. Gets the active window ID
2. Retrieves the window title
3. Finds the process ID (PID) of the window
4. Reads process information from `/proc` to get the application name

This approach is:
- Simple and reliable
- Works on all X11-based desktop environments (KDE, GNOME, XFCE, etc.)
- Does NOT work on Wayland (by design - Wayland doesn't expose this information)

## Installation & Setup Guide

### 1. System Check & Preparation

Before running the app, verify your system is ready:

```bash
# Make the setup script executable
chmod +x setup-check.sh

# Run the setup script to check your environment
./setup-check.sh
```

This script will:
- Check if you are running an X11 session (not Wayland)
- Check if `xdotool` is installed (required for window tracking)
- Check Node.js and npm versions
- Offer to install npm dependencies

## Data Storage

Time tracking data is saved to:
```
~/.config/linuxapp/time-tracking-data.json
```

The app automatically:
- Saves data every 30 seconds while running
- Saves on app close
- Loads previous data on startup

## Features

- Real-time tracking of active applications
- Tracks application name, window title, and duration
- Automatic data persistence
- Statistics and analytics
- Export functionality (coming soon)
- Server synchronization (coming soon)

## Architecture

- **Frontend**: React + Vite
- **Backend**: Electron (Node.js)
- **Window Detection**: xdotool (X11 command-line tool)
- **Process Info**: Linux /proc filesystem

## Comparison with Windows Version

| Feature | Windows (winapp) | Linux (Linuxapp) |
|---------|------------------|------------------|
| Window Detection | `active-win` npm package | `xdotool` CLI tool |
| Display Server | Windows API | X11 only |
| Process Info | Windows API | /proc filesystem |
| UI | React | React (same) |
| Framework | Electron | Electron (same) |

## License

Same as the main Hour-Glass project.
