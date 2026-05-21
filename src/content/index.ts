import { createApp, ref, h } from 'vue'
import TickerOverlay from './components/TickerOverlay.vue'
import tickerStyles from './components/TickerOverlay.css?inline'

let hostElement: HTMLDivElement | null = null
let vueApp: any = null
let pollInterval: number | null = null

// Reactive reference to store the active selection text
const textRef = ref('')

// ChatGPT Autodetect State Machine
let currentObservedNode: HTMLElement | null = null
let lastCompletedText = ''
let lastCompletedNode: HTMLElement | null = null
let userClosedCurrentStream = false
let lastTextValue = ''
let lastChangeTime = 0
let isCurrentlyStreaming = false
let lastMarkdownCount = 0

/**
 * Clean up the overlay, unmount the Vue app, and clear polling
 */
function destroyOverlay(isManualClose = false) {
  if (pollInterval !== null) {
    window.clearInterval(pollInterval)
    pollInterval = null
  }
  
  // Track if we manually closed an active ChatGPT stream to prevent it from immediately re-opening
  if (isManualClose && currentObservedNode) {
    userClosedCurrentStream = true
    lastCompletedNode = currentObservedNode
    currentObservedNode = null
    isCurrentlyStreaming = false
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
  // returned from setup to ensure textRef remains reactive when passed as a prop
  vueApp = createApp({
    setup() {
      console.log('[FocusStream] root setup called, initial text:', textRef.value)
      return () => {
        console.log('[FocusStream] root render called, textRef.value:', textRef.value)
        return h(TickerOverlay, {
          text: textRef.value,
          onClose: () => destroyOverlay(true)
        })
      }
    }
  })

  try {
    vueApp.mount(mountPoint)
    console.log('[FocusStream] Vue app mounted successfully')
  } catch (e) {
    console.error('Error mounting TickerOverlay Vue app:', e)
    destroyOverlay()
  }

  // Set up polling to dynamically capture streaming text selections (e.g. ChatGPT output)
  pollInterval = window.setInterval(() => {
    // If the ChatGPT autodetect is active and currently updating the textRef, skip selection polling
    if (isCurrentlyStreaming) return

    const currentSelection = window.getSelection()?.toString().trim()
    
    // Only update if the selection is not empty. If it's empty (e.g. user clicked inside the overlay),
    // we preserve the last known text so the marquee continues running.
    if (currentSelection && currentSelection !== textRef.value) {
      console.log('[FocusStream] Selection polling updated text:', currentSelection)
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
    destroyOverlay(true)
  }
}

// Bind events to the active document
document.addEventListener('mouseup', handleSelection)
document.addEventListener('dblclick', handleSelection)

// --- Global Extension On/Off State ---
let isExtensionEnabled = true
let isGptFeatureEnabled = false
let gptObserver: MutationObserver | null = null
let isHistoryInitialized = false

// Initialize states from storage
chrome.storage.local.get(['focusStreamEnabled', 'focusStreamGptFeature'], (result) => {
  if (result.focusStreamEnabled !== undefined) {
    isExtensionEnabled = !!result.focusStreamEnabled
  }
  if (result.focusStreamGptFeature !== undefined) {
    isGptFeatureEnabled = !!result.focusStreamGptFeature
  }
  
  // Set initial count of top-level markdown elements
  const allDivs = document.querySelectorAll('.markdown, .markdown-new-styling, .prose')
  const markdownDivs = Array.from(allDivs).filter(div => {
    let parent = div.parentElement
    while (parent) {
      if (parent.classList.contains('markdown') || parent.classList.contains('markdown-new-styling') || parent.classList.contains('prose')) {
        return false
      }
      parent = parent.parentElement
    }
    return true
  })
  lastMarkdownCount = markdownDivs.length
  const initialLatest = markdownDivs[lastMarkdownCount - 1] as HTMLElement | null
  lastCompletedText = initialLatest ? initialLatest.innerText.trim() : ''
  isHistoryInitialized = markdownDivs.length > 0
  if (isHistoryInitialized) {
    lastCompletedNode = initialLatest
  }
  
  toggleGptObserver()
})

// Listen for toggles from the popup or other tabs
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.focusStreamEnabled) {
      isExtensionEnabled = !!changes.focusStreamEnabled.newValue
      if (!isExtensionEnabled) {
        destroyOverlay(true)
      }
    }
    if (changes.focusStreamGptFeature) {
      isGptFeatureEnabled = !!changes.focusStreamGptFeature.newValue
      toggleGptObserver()
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

// --- ChatGPT Autodetect Feature ---
function toggleGptObserver() {
  const isGptDomain = window.location.hostname.includes('chatgpt.com') || window.location.hostname.includes('openai.com')
  
  if (isExtensionEnabled && isGptFeatureEnabled && isGptDomain) {
    if (!gptObserver) {
      gptObserver = new MutationObserver(handleGptMutations)
      gptObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      })
      // Run initial check in case generation is already in progress
      handleGptMutations()
    }
  } else {
    if (gptObserver) {
      gptObserver.disconnect()
      gptObserver = null
    }
    currentObservedNode = null
    lastCompletedNode = null
    userClosedCurrentStream = false
    isCurrentlyStreaming = false
    isHistoryInitialized = false
  }
}

function handleGptMutations() {
  if (!isExtensionEnabled || !isGptFeatureEnabled) return

  // Query only top-level markdown containers, ignoring nested ones (e.g., in code blocks)
  const allDivs = document.querySelectorAll('.markdown, .markdown-new-styling, .prose')
  const markdownDivs = Array.from(allDivs).filter(div => {
    let parent = div.parentElement
    while (parent) {
      if (parent.classList.contains('markdown') || parent.classList.contains('markdown-new-styling') || parent.classList.contains('prose')) {
        return false
      }
      parent = parent.parentElement
    }
    return true
  })
  const count = markdownDivs.length
  const latestMarkdown = markdownDivs[count - 1] as HTMLElement | null

  // Reset tracking if chat is completely empty/cleared or switching
  if (count === 0) {
    isHistoryInitialized = false
    lastMarkdownCount = 0
    lastCompletedText = ''
    lastCompletedNode = null
    if (currentObservedNode) {
      currentObservedNode = null
      isCurrentlyStreaming = false
    }
    console.log('[FocusStream GPT] Chat empty, observer reset')
    return
  }

  // Check if ChatGPT is currently generating/streaming a response
  const isGptGenerating = !!(
    document.querySelector('button[aria-label*="stop" i]') ||
    document.querySelector('button[title*="stop" i]') ||
    document.querySelector('button[data-testid*="stop" i]') ||
    document.querySelector('[class*="streaming" i]') ||
    document.querySelector('[class*="generating" i]') ||
    Array.from(document.querySelectorAll('button')).some(b => {
      const txt = b.innerText.trim().toLowerCase()
      const label = (b.getAttribute('aria-label') || '').toLowerCase()
      const title = (b.getAttribute('title') || '').toLowerCase()
      const testid = (b.getAttribute('data-testid') || '').toLowerCase()
      return txt.includes('stop') || label.includes('stop') || title.includes('stop') || testid.includes('stop')
    })
  )

  // Initialize history count on the first mutation if not already done
  if (!isHistoryInitialized) {
    if (count > 0 && !isGptGenerating) {
      console.log('[FocusStream GPT] Initializing history count to', count)
      lastMarkdownCount = count
      lastCompletedText = latestMarkdown ? latestMarkdown.innerText.trim() : ''
      lastCompletedNode = latestMarkdown
      isHistoryInitialized = true
      return
    } else if (count > 0 && isGptGenerating) {
      isHistoryInitialized = true
      console.log('[FocusStream GPT] History initialized while generating. Count:', count)
    }
  }

  // Reset the closed stream lock if ChatGPT has stopped generating
  if (!isGptGenerating) {
    userClosedCurrentStream = false
  }

  // Handle cases where the message list shrinks (switching chats or deleting messages)
  if (count < lastMarkdownCount) {
    console.log('[FocusStream GPT] Message count decreased from', lastMarkdownCount, 'to', count)
    lastMarkdownCount = count
    lastCompletedText = latestMarkdown ? latestMarkdown.innerText.trim() : ''
    if (currentObservedNode && !document.body.contains(currentObservedNode)) {
      currentObservedNode = null
      isCurrentlyStreaming = false
    }
  }

  // To prevent stale element references (e.g., when React replaces DOM elements during generation),
  // always bind our current observed node to the fresh latest markdown element.
  if (currentObservedNode && latestMarkdown) {
    currentObservedNode = latestMarkdown
  }

  console.log(
    '[FocusStream GPT] Mutation - Count:', count,
    'LastCount:', lastMarkdownCount,
    'Generating:', isGptGenerating,
    'Streaming:', isCurrentlyStreaming,
    'HasNode:', !!currentObservedNode,
    'Nodes:', markdownDivs.map((d, idx) => `[${idx}] ${d.tagName}.${d.className.replace(/\s+/g, '.')} (Text: "${(d as HTMLElement).innerText.trim().substring(0, 50)}")`)
  )

  // Case 1: A new top-level markdown message node has been added to the chat.
  // We unconditionally start tracking a new container as soon as it appears, 
  // bypassing any race condition where the Stop button has not yet finished rendering.
  if (count > lastMarkdownCount) {
    console.log('[FocusStream GPT] Case 1 triggered. count > lastMarkdownCount')
    lastMarkdownCount = count
    if (latestMarkdown && latestMarkdown !== lastCompletedNode && !userClosedCurrentStream) {
      currentObservedNode = latestMarkdown
      lastTextValue = latestMarkdown.innerText.trim()
      lastChangeTime = Date.now()
      isCurrentlyStreaming = true
      console.log('[FocusStream GPT] Case 1 - New node observed. Text:', lastTextValue)
      
      if (lastTextValue) {
        createOverlay(lastTextValue)
      }
    }
    return
  }

  // Case 2: GPT is generating, we aren't tracking any node, and it's a new message node (not completed/closed)
  if (isGptGenerating && !currentObservedNode && latestMarkdown && latestMarkdown !== lastCompletedNode && !userClosedCurrentStream && latestMarkdown.innerText.trim() !== lastCompletedText) {
    console.log('[FocusStream GPT] Case 2 triggered (generating state detected)')
    currentObservedNode = latestMarkdown
    lastTextValue = latestMarkdown.innerText.trim()
    lastChangeTime = Date.now()
    isCurrentlyStreaming = true
    if (lastTextValue) {
      createOverlay(lastTextValue)
    }
    return
  }

  // Case 3: We are actively tracking a message node, check for text updates
  if (currentObservedNode) {
    const text = currentObservedNode.innerText.trim()
    
    if (text !== lastTextValue) {
      console.log('[FocusStream GPT] Case 3 - Text changed. Length:', text.length)
      lastTextValue = text
      lastChangeTime = Date.now()
      isCurrentlyStreaming = true

      if (!hostElement) {
        console.log('[FocusStream GPT] Case 3 - hostElement not present, creating overlay')
        createOverlay(text)
      } else {
        textRef.value = text
      }
    } else if (isCurrentlyStreaming) {
      const timeDiff = Date.now() - lastChangeTime
      // Timeout streaming if quiet for too long. If still generating, use a longer timeout (10s), otherwise 2s.
      const timeoutLimit = isGptGenerating ? 10000 : 2000
      if (timeDiff > timeoutLimit) {
        console.log('[FocusStream GPT] Stream finished. Quiet time:', timeDiff, 'ms, isGptGenerating:', isGptGenerating)
        isCurrentlyStreaming = false
        lastCompletedText = text
        lastCompletedNode = currentObservedNode
        currentObservedNode = null
      }
    }
  }
}
