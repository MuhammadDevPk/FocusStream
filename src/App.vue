<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

const isEnabled = ref(true)

onMounted(() => {
  chrome.storage.local.get(['focusStreamEnabled'], (result) => {
    if (result.focusStreamEnabled !== undefined) {
      isEnabled.value = !!result.focusStreamEnabled
    }
  })
})

watch(isEnabled, (newValue) => {
  chrome.storage.local.set({ focusStreamEnabled: newValue })
})
</script>

<template>
  <div class="popup-container">
    <header class="header">
      <h1 class="title">FocusStream</h1>
      <p class="subtitle">Floating text marquee</p>
    </header>

    <div class="settings-section">
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-title">Enable Extension</span>
          <span class="setting-desc">Toggle the text scanner</span>
        </div>
        
        <label class="switch">
          <input type="checkbox" v-model="isEnabled">
          <span class="slider round"></span>
        </label>
      </div>
    </div>
    
    <footer class="footer">
      <kbd>Cmd+O</kbd> / <kbd>Ctrl+O</kbd> to toggle instantly
    </footer>
  </div>
</template>

<style>
body {
  margin: 0;
  padding: 0;
  width: 300px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: #0f1117;
  color: #f3f4f6;
}

.popup-container {
  padding: 24px 20px;
}

.header {
  margin-bottom: 24px;
}

.title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 4px 0;
  background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
}

.settings-section {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-title {
  font-size: 14px;
  font-weight: 600;
}

.setting-desc {
  font-size: 12px;
  color: #9ca3af;
}

.footer {
  margin-top: 24px;
  text-align: center;
  font-size: 12px;
  color: #6b7280;
}

kbd {
  background-color: #1f2937;
  border: 1px solid #374151;
  border-radius: 4px;
  padding: 2px 6px;
  font-family: monospace;
  font-size: 11px;
}

/* The switch - the box around the slider */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

/* Hide default HTML checkbox */
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

/* The slider */
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #374151;
  transition: .3s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .3s;
}

input:checked + .slider {
  background-color: #3b82f6;
}

input:focus + .slider {
  box-shadow: 0 0 1px #3b82f6;
}

input:checked + .slider:before {
  transform: translateX(20px);
}

/* Rounded sliders */
.slider.round {
  border-radius: 24px;
}

.slider.round:before {
  border-radius: 50%;
}
</style>
