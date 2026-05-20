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
const speed = ref(2)
const fontSize = ref(15)
const position = ref({ x: 0, y: 0 })
const bannerWidth = ref('100%')
const bannerHeight = ref('50px')

const isLoaded = ref(false)
let animationFrameId: number | null = null
let resizeObserver: ResizeObserver | null = null

// --- State Persistence ---
const saveState = () => {
  if (!isLoaded.value) return
  chrome.storage.local.set({
    focusStreamState: {
      position: position.value,
      fontSize: fontSize.value,
      speed: speed.value,
      width: bannerWidth.value,
      height: bannerHeight.value
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
      if (state.width) bannerWidth.value = state.width
      if (state.height) bannerHeight.value = state.height
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
    resizeObserver = new ResizeObserver((entries) => {
      // Don't capture sizes while still loading defaults
      if (!isLoaded.value) return
      
      for (const entry of entries) {
        if (entry.target === bannerRef.value) {
          bannerWidth.value = `${bannerRef.value.offsetWidth}px`
          bannerHeight.value = `${bannerRef.value.offsetHeight}px`
          saveState()
        }
      }
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
      width: bannerWidth,
      height: bannerHeight,
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

      <!-- Speed Control Slider -->
      <div class="slider-group">
        <span class="slider-label">Speed</span>
        <input 
          type="range" 
          class="custom-slider" 
          v-model.number="speed" 
          min="0.5" 
          max="10" 
          step="0.5"
          title="Speed control"
        />
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
