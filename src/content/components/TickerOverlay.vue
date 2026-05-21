<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  text: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const wrapperRef = ref<HTMLDivElement | null>(null)
const bannerRef = ref<HTMLDivElement | null>(null)
const textRef = ref<HTMLSpanElement | null>(null)
const offset = ref(0)
const isPlaying = ref(true)

// --- Configurable State ---
const speed = ref(2.3)
const fontSize = ref(36)
const position = ref({ x: 0, y: 0 })

const isLoaded = ref(false)
let animationFrameId: number | null = null
let resizeObserver: ResizeObserver | null = null

// --- State Persistence ---
const saveState = () => {
  if (!isLoaded.value || !bannerRef.value) return
  chrome.storage.local.set({
    focusStreamState: {
      position: position.value,
      fontSize: fontSize.value,
      speed: speed.value,
      width: bannerRef.value.style.width,
      height: bannerRef.value.style.height
    }
  })
}

// Watch state properties and save to chrome storage automatically
watch([position, fontSize, speed], () => {
  saveState()
}, { deep: true })

// --- Dragging Logic ---
const isDragging = ref(false)
let dragOffset = { x: 0, y: 0 }

const onMouseDown = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  
  // Prevent dragging if clicking inside the controls container
  if (target.closest('.controls-container')) return
  
  // Prevent dragging if the user is clicking the native CSS resize handle 
  const banner = e.currentTarget as HTMLElement
  const rect = banner.getBoundingClientRect()
  const isResizeHandle = (rect.right - e.clientX) < 20 && (rect.bottom - e.clientY) < 20
  if (isResizeHandle) return

  isDragging.value = true
  dragOffset.x = e.clientX - position.value.x
  dragOffset.y = e.clientY - position.value.y

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const onMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return
  e.preventDefault()
  position.value.x = e.clientX - dragOffset.x
  position.value.y = e.clientY - dragOffset.y
}

const onMouseUp = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

const jumpWords = (delta: number) => {
  const textEl = textRef.value
  if (!textEl) return
  
  const text = props.text
  if (!text) return

  // 1. Find the starting character index of each word
  const wordOffsets: number[] = []
  const regex = /[^\s]+/g
  let match
  while ((match = regex.exec(text)) !== null) {
    wordOffsets.push(match.index)
  }
  
  if (wordOffsets.length === 0) return

  // 2. Estimate average character width
  const totalWidth = textEl.offsetWidth
  const avgCharWidth = totalWidth / text.length

  // 3. Find current character index at the left edge of the viewport
  const currentScrolledPixels = Math.max(0, -offset.value)
  const currentCharIndex = currentScrolledPixels / avgCharWidth

  // 4. Find the current word index
  let currentWordIdx = 0
  for (let i = 0; i < wordOffsets.length; i++) {
    const wOffset = wordOffsets[i]
    if (wOffset !== undefined && wOffset <= currentCharIndex) {
      currentWordIdx = i
    } else {
      break
    }
  }

  // 5. Calculate target word index
  let targetWordIdx = currentWordIdx + delta
  if (targetWordIdx < 0) targetWordIdx = 0
  if (targetWordIdx >= wordOffsets.length) targetWordIdx = wordOffsets.length - 1

  // 6. Set the new offset
  const targetCharIndex = wordOffsets[targetWordIdx] ?? 0
  const targetPixelOffset = -(targetCharIndex * avgCharWidth)
  
  offset.value = targetPixelOffset
  console.log(`[FocusStream] Jumped ${delta} words. From word index ${currentWordIdx} to ${targetWordIdx}. New offset: ${offset.value}`)
}

// --- Animation ---
const togglePlay = () => {
  isPlaying.value = !isPlaying.value
}

const animate = () => {
  if (isPlaying.value && wrapperRef.value && textRef.value) {
    const wrapperWidth = wrapperRef.value.offsetWidth
    const textWidth = textRef.value.offsetWidth

    offset.value -= speed.value

    // Wrap around when the text is completely scrolled out of view to the left
    if (offset.value < -textWidth) {
      offset.value = wrapperWidth
    }
  }
  animationFrameId = requestAnimationFrame(animate)
}

onMounted(() => {
  // 1. Load saved state from chrome storage
  chrome.storage.local.get(['focusStreamState'], (result) => {
    if (result.focusStreamState) {
      const state = result.focusStreamState as any
      if (state.position) position.value = state.position
      if (state.fontSize) fontSize.value = state.fontSize
      if (state.speed) speed.value = state.speed
      if (state.width && bannerRef.value) bannerRef.value.style.width = state.width
      if (state.height && bannerRef.value) bannerRef.value.style.height = state.height
    } else {
      if (bannerRef.value) {
        bannerRef.value.style.width = '70%'
        bannerRef.value.style.height = '200px'
      }
    }
    
    // Reveal the component after state is loaded to avoid visual snapping/flashing
    isLoaded.value = true

    // Initialize animation starting offset to center
    if (wrapperRef.value) {
      offset.value = wrapperRef.value.offsetWidth / 2
    }
    animationFrameId = requestAnimationFrame(animate)
  })

  // 2. Observe manual browser resizes to dynamically save new dimensions
  if (bannerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      // Don't capture sizes while still loading defaults
      if (!isLoaded.value) return
      saveState()
    })
    resizeObserver.observe(bannerRef.value)
  }
})

onUnmounted(() => {
  if (animationFrameId !== null) cancelAnimationFrame(animationFrameId)
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  if (resizeObserver) resizeObserver.disconnect()
})
</script>

<template>
  <div 
    class="ticker-banner"
    ref="bannerRef"
    :style="{ 
      transform: `translate(${position.x}px, ${position.y}px)`,
      opacity: isLoaded ? 1 : 0
    }"
    @mousedown="onMouseDown"
  >
    <div class="marquee-container" ref="wrapperRef">
      <div 
        class="marquee-text-wrapper" 
        :style="{ transform: `translateX(${offset}px)` }"
      >
        <span class="marquee-text" ref="textRef" :style="{ fontSize: `${fontSize}px` }">
          {{ props.text }}
        </span>
      </div>
    </div>
    
    <div class="controls-container">
      <!-- Skip Backward Button -->
      <button 
        class="control-btn" 
        @click="jumpWords(-5)"
        title="Skip backward 5 words"
      >
        <svg viewBox="0 0 24 24">
          <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/>
        </svg>
      </button>

      <!-- Play / Pause Button -->
      <button 
        class="control-btn" 
        @click="togglePlay"
        :title="isPlaying ? 'Pause' : 'Play'"
      >
        <svg v-if="isPlaying" viewBox="0 0 24 24">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
        <svg v-else viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </button>

      <!-- Skip Forward Button -->
      <button 
        class="control-btn" 
        @click="jumpWords(5)"
        title="Skip forward 5 words"
      >
        <svg viewBox="0 0 24 24">
          <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
        </svg>
      </button>

      <!-- Font Size Slider -->
      <div class="slider-group">
        <span class="slider-label" style="font-size: 14px; font-family: serif; text-transform: none;">Aa</span>
        <input 
          type="range" 
          class="custom-slider" 
          v-model.number="fontSize" 
          min="10" 
          max="72" 
          step="1"
          title="Font size control"
          style="width: 50px;"
        />
      </div>

      <!-- Speed Control Input -->
      <div class="slider-group">
        <span class="slider-label">Speed</span>
        <input 
          type="number" 
          class="speed-input" 
          v-model.number="speed" 
          min="0.1" 
          max="10" 
          step="0.1"
          title="Speed control"
        />
        <span class="slider-label" style="margin-left: -5px; text-transform: lowercase;">x</span>
      </div>

      <!-- Close Button -->
      <button 
        class="close-btn" 
        @click="emit('close')"
        title="Close overlay"
      >
        <svg viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>
</template>
