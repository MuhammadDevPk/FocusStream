import { createApp } from 'vue'
import TickerOverlay from './components/TickerOverlay.vue'
import tickerStyles from './components/TickerOverlay.css?inline'

let hostElement: HTMLDivElement | null = null
let vueApp: any = null

/**
 * Clean up the overlay and unmount the Vue app
 */
function destroyOverlay() {
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
}

/**
 * Create and mount the floating ticker overlay
 */
function createOverlay(text: string) {
  // Remove existing overlay if any
  destroyOverlay()

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

  // Instantiate and mount the Vue application
  vueApp = createApp(TickerOverlay, {
    text: text,
    onClose: () => {
      destroyOverlay()
    }
  })

  try {
    vueApp.mount(mountPoint)
  } catch (e) {
    console.error('Error mounting TickerOverlay Vue app:', e)
    destroyOverlay()
  }
}

/**
 * Handle mouse selection events
 */
function handleSelection(event: MouseEvent) {
  // If the user clicks inside our own shadow host container, do not modify the overlay
  if (hostElement && (event.target === hostElement || hostElement.contains(event.target as Node))) {
    return
  }

  // Get active text selection
  const selectedText = window.getSelection()?.toString().trim()

  if (selectedText) {
    createOverlay(selectedText)
  } else {
    // If selection is cleared by clicking elsewhere, dismiss the overlay
    destroyOverlay()
  }
}

// Bind events to the active document
document.addEventListener('mouseup', handleSelection)
document.addEventListener('dblclick', handleSelection)
