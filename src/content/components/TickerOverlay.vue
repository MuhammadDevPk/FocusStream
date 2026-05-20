<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  text: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const wrapperRef = ref<HTMLDivElement | null>(null)
const textRef = ref<HTMLSpanElement | null>(null)
const offset = ref(0)
const isPlaying = ref(true)
const speed = ref(2)

let animationFrameId: number | null = null

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
  if (wrapperRef.value) {
    // Start text from the center of the screen instead of the far right edge
    offset.value = wrapperRef.value.offsetWidth / 2
  }
  animationFrameId = requestAnimationFrame(animate)
})

onUnmounted(() => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }
})
</script>

<template>
  <div class="ticker-banner">
    <div class="marquee-container" ref="wrapperRef">
      <div 
        class="marquee-text-wrapper" 
        :style="{ transform: `translateX(${offset}px)` }"
      >
        <span class="marquee-text" ref="textRef">{{ props.text }}</span>
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

      <!-- Speed Control Slider -->
      <div class="slider-group">
        <span class="slider-label">Speed</span>
        <input 
          type="range" 
          class="speed-slider" 
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
