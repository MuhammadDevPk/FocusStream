# FocusStream

FocusStream is a premium, feature-rich Manifest V3 Chrome Extension designed for speed reading. It scans user selections or double-clicked text on any web page and displays it in a floating glassmorphic marquee at the top of the viewport, scrolling at a comfortable reading pace. It also features **ChatGPT Auto-Stream** detection, allowing you to feed real-time AI generations directly into your scrolling ticker.

---

## ✨ Features

- **Double-Click or Drag-to-Select**: Instantly triggers the floating speed-reading marquee overlay on any website.
- **ChatGPT Auto-Stream**: Autodetects live ChatGPT response streams, feeding them character-by-character into the ticker as they generate.
- **Interactive Text Scrubbing (Drag-to-Scroll)**: Grab the scrolling text directly with your mouse to scroll/scrub it forward or backward manually.
- **Precision Controls**: Adjust speed (default is a comfortable `2.3x` pace), font size (Aa slider), play/pause, and skip forward or backward by 5 words.
- **Isolated Styling**: Wrapped inside a Shadow DOM so the extension style rules never interfere with the host website CSS.
- **Instant Hotkey Toggle**: Press `Cmd+O` (Mac) or `Ctrl+O` (Windows/Linux) to enable/disable the text scanner instantly.

---

## 🚀 Getting Started (Local Development)

Follow these steps to run FocusStream on your local machine:

### 1. Prerequisites

Make sure you have [Node.js](https://nodejs.org/) (v16+ recommended) and `npm` installed.

### 2. Clone the Repository

Clone this project repository to your local directory:

```bash
git clone <repository-url>
cd FocusStream
```

### 3. Install Dependencies

Install the project dependencies using npm:

```bash
npm install
```

### 4. Build the Extension

Compile the Vite build bundles. You can build for production or run the hot-reloading development server:

#### Build for Production (Recommended)

```bash
npm run build
```

This compiles and outputs the production bundle inside the `dist/` directory.

#### Compile and Auto-Reload for Development

```bash
npm run dev
```

This runs Vite in watch mode, rebuilt automatically on saving changes.

---

## 🔌 Loading the Extension in Google Chrome

Once the build finishes and the `dist/` directory is generated:

1. Open **Google Chrome** and navigate to `chrome://extensions/`.
2. Enable **Developer mode** by toggling the switch in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `dist` folder inside your project workspace directory (e.g., `FocusStream/dist`).
5. Open any website (like [chatgpt.com](https://chatgpt.com)) and double-click or select text to test it!

---

## 🛠️ Project Structure

- `manifest.json`: Configuration for Chrome Extension Manifest V3 mapping content scripts, popups, and permissions.
- `vite.config.ts`: Configured with `@crxjs/vite-plugin` to build Manifest V3 resources.
- `src/content/index.ts`: Content script entrypoint registering MutationObservers for ChatGPT, handling selections, and injecting the Shadow DOM.
- `src/content/components/TickerOverlay.vue`: Main Vue 3 ticker overlay component housing marquee logic, controls, navigation, and text scrubbing handlers.
- `src/content/components/TickerOverlay.css`: Glassmorphic layout styling isolated for Shadow DOM rendering.
- `src/App.vue`: Vue popup control panel displaying configuration toggles.
