#!/bin/bash

# Hour-Glass Linux App - System Check and Setup Script
# This script checks if your system is ready to run the Linux time tracker

echo "=========================================="
echo "Hour-Glass Linux Time Tracker - Setup"
echo "=========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Verify X11 session
echo "Checking display server..."
SESSION_TYPE="${XDG_SESSION_TYPE:-unknown}"

if [ "$SESSION_TYPE" = "x11" ]; then
    echo -e "${GREEN}✓${NC} Running X11 session"
elif [ "$SESSION_TYPE" = "wayland" ]; then
    echo -e "${RED}✗${NC} Running Wayland session"
    echo -e "${YELLOW}  WARNING: This app requires X11!${NC}"
    echo "  Please log out and select an X11 session:"
    echo "  - KDE: Select 'Plasma (X11)'"
    echo "  - GNOME: Select 'GNOME on Xorg'"
    echo ""
    ISSUES_FOUND=1
elif [ -n "$DISPLAY" ] && [ -z "$WAYLAND_DISPLAY" ]; then
    echo -e "${GREEN}✓${NC} Likely running X11 (DISPLAY is set, no WAYLAND_DISPLAY)"
else
    echo -e "${YELLOW}?${NC} Could not determine session type (detected as: $SESSION_TYPE)"
    echo "  DISPLAY=$DISPLAY"
    echo "  WAYLAND_DISPLAY=$WAYLAND_DISPLAY"
    echo ""
fi

# Check 2: Verify xdotool is installed
echo ""
echo "Checking for xdotool..."
if command -v xdotool &> /dev/null; then
    XDOTOOL_VERSION=$(xdotool --version 2>&1 | head -n 1)
    echo -e "${GREEN}✓${NC} xdotool is installed ($XDOTOOL_VERSION)"
else
    echo -e "${RED}✗${NC} xdotool is NOT installed"
    echo -e "${YELLOW}  This tool is REQUIRED for window tracking!${NC}"
    echo ""
    echo "  Install it with:"

    # Detect distro and suggest appropriate command
    if [ -f /etc/debian_version ]; then
        echo "    sudo apt install xdotool"
    elif [ -f /etc/redhat-release ]; then
        echo "    sudo dnf install xdotool"
    elif [ -f /etc/arch-release ]; then
        echo "    sudo pacman -S xdotool"
    elif [ -f /etc/SuSE-release ]; then
        echo "    sudo zypper install xdotool"
    else
        echo "    (check your package manager for 'xdotool')"
    fi
    echo ""
    ISSUES_FOUND=1
fi

# Check 3: Verify Node.js is installed
echo ""
echo "Checking for Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js is installed ($NODE_VERSION)"

    # Check version (need at least v16)
    NODE_MAJOR=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 16 ]; then
        echo -e "${YELLOW}  WARNING: Node.js version is old (need v16+)${NC}"
    fi
else
    echo -e "${RED}✗${NC} Node.js is NOT installed"
    echo "  Install from: https://nodejs.org/"
    ISSUES_FOUND=1
fi

# Check 4: Verify npm is installed
echo ""
echo "Checking for npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} npm is installed ($NPM_VERSION)"
else
    echo -e "${RED}✗${NC} npm is NOT installed"
    echo "  (Usually comes with Node.js)"
    ISSUES_FOUND=1
fi

# Check 5: Verify /proc filesystem
echo ""
echo "Checking /proc filesystem..."
if [ -d "/proc" ] && [ -r "/proc/self/comm" ]; then
    echo -e "${GREEN}✓${NC} /proc filesystem is accessible"
else
    echo -e "${YELLOW}?${NC} /proc filesystem may not be accessible"
fi

# Summary
echo ""
echo "=========================================="
if [ -z "$ISSUES_FOUND" ]; then
    echo -e "${GREEN}✓ System check passed!${NC}"
    echo ""
    echo "You're ready to run the app. Next steps:"
    echo "  1. npm install"
    echo "  2. npm run dev"
else
    echo -e "${YELLOW}⚠ Issues found - please fix them before running the app${NC}"
fi
echo "=========================================="
echo ""

# Offer to install npm dependencies
if [ -z "$ISSUES_FOUND" ] && [ -f "package.json" ]; then
    read -p "Install npm dependencies now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Installing dependencies..."
        npm install
        echo ""
        echo -e "${GREEN}✓ Dependencies installed!${NC}"
        echo ""
        echo "Run the app with: npm run dev"
    fi
fi

