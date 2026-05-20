import { createApp, ref, h } from 'vue'
import TickerOverlay from './components/TickerOverlay.vue'
import tickerStyles from './components/TickerOverlay.css?inline'

let hostElement: HTMLDivElement | null = null
let vueApp: any = null
let pollInterval: number | null = null

// Reactive reference to store the active selection text
const textRef = ref('')

/**
 * Clean up the overlay, unmount the Vue app, and clear polling
 */
function destroyOverlay() {
  if (pollInterval !== null) {
    window.clearInterval(pollInterval)
    pollInterval = null
  }
  if (vueApp) {
    try {
      vueApp.unmount()
    } catch (e) {
      console.error('Error unmounting Vue app:', e)
    }
    vueApp = null
  }
  if (hostElement) {
    try {
      hostElement.remove()
    } catch (e) {
      console.error('Error removing host element:', e)
    }
    hostElement = null
  }
  textRef.value = ''
}

/**
 * Create and mount the floating ticker overlay
 */
function createOverlay(initialText: string) {
  // Remove existing overlay if any
  destroyOverlay()

  textRef.value = initialText

  // Create the host container element
  hostElement = document.createElement('div')
  hostElement.id = 'focus-stream-ticker-host'

  // Attach Shadow DOM for CSS isolation
  const shadowRoot = hostElement.attachShadow({ mode: 'open' })

  // Create and append the style element with isolated CSS rules
  const styleElement = document.createElement('style')
  styleElement.textContent = tickerStyles
  shadowRoot.appendChild(styleElement)

  // Create mount point for Vue
  const mountPoint = document.createElement('div')
  mountPoint.id = 'focus-stream-ticker-root'
  shadowRoot.appendChild(mountPoint)

  // Append host to the document body
  document.body.appendChild(hostElement)

  // Instantiate and mount the Vue application using a render function 
  // to ensure textRef remains reactive when passed as a prop
  vueApp = createApp({
    render() {
      return h(TickerOverlay, {
        text: textRef.value,
        onClose: destroyOverlay
      })
    }
  })

  try {
    vueApp.mount(mountPoint)
  } catch (e) {
    console.error('Error mounting TickerOverlay Vue app:', e)
    destroyOverlay()
  }

  // Set up polling to dynamically capture streaming text selections (e.g. ChatGPT output)
  pollInterval = window.setInterval(() => {
    const currentSelection = window.getSelection()?.toString().trim()
    
    // Only update if the selection is not empty. If it's empty (e.g. user clicked inside the overlay),
    // we preserve the last known text so the marquee continues running.
    if (currentSelection && currentSelection !== textRef.value) {
      textRef.value = currentSelection
    }
  }, 200) // Poll 5 times a second for near-instant responsiveness
}

/**
 * Handle mouse selection events
 */
function handleSelection(event: MouseEvent) {
  if (!isExtensionEnabled) return

  // If the user clicks inside our own shadow host container, do not modify the overlay
  if (hostElement && (event.target === hostElement || hostElement.contains(event.target as Node))) {
    return
  }

  // Get active text selection
  const selectedText = window.getSelection()?.toString().trim()

  if (selectedText) {
    // If an overlay isn't already active for this exact text, create it
    if (textRef.value !== selectedText) {
      createOverlay(selectedText)
    }
  } else {
    // If selection is cleared by clicking elsewhere on the page, dismiss the overlay
    destroyOverlay()
  }
}

// Bind events to the active document
document.addEventListener('mouseup', handleSelection)
document.addEventListener('dblclick', handleSelection)

// --- Global Extension On/Off State ---
let isExtensionEnabled = true

// Initialize from storage
chrome.storage.local.get(['focusStreamEnabled'], (result) => {
  if (result.focusStreamEnabled !== undefined) {
    isExtensionEnabled = !!result.focusStreamEnabled
  }
})

// Listen for toggles from the popup or other tabs
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.focusStreamEnabled) {
    isExtensionEnabled = !!changes.focusStreamEnabled.newValue
    if (!isExtensionEnabled) {
      destroyOverlay()
    }
  }
})

// Cmd+O / Ctrl+O Shortcut
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
    e.preventDefault() // Prevent browser's "Open File" dialog
    const newState = !isExtensionEnabled
    chrome.storage.local.set({ focusStreamEnabled: newState })
  }
})
