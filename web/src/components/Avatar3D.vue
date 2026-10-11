<script setup lang="ts">
import { AmbientLight, DirectionalLight, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { Slot } from '../data/outfits'
import { type Avatar3D, buildAvatar } from '../services/avatar3d/avatar'
import type { AvatarParts } from '../stores/avatar'

// 3D 旅人的展示窗（DESIGN.md §7.24a）：拖曳轉（左右各 75 度、上下一點點），放開帶一點慣性。
// 平常輕輕搖、夥伴偶爾跳一下；捲出畫面、分頁在背景時停；減少動態時不搖，只在拖曳時重畫。
// 換外觀或服裝就重新生成（要畫幾張點陣、算距離場，約幾十毫秒），舊的釋放掉。
const props = defineProps<{ parts: AvatarParts; equipped: Partial<Record<Slot, string>> }>()

const host = ref<HTMLDivElement | null>(null)
const failed = ref(false)
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

let renderer: WebGLRenderer | null = null
let controls: OrbitControls | null = null
let current: Avatar3D | null = null
let resize: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let visible = true
let building = 0
const scene = new Scene()
const camera = new PerspectiveCamera(26, 1, 0.1, 100)

// 卡通著色：環境光＋左上的主光；全亮時剛好是原本的顏色（MeshToonMaterial 的亮度是 強度 / π，兩個加起來 π）
scene.add(new AmbientLight(0xffffff, 1.3))
const key = new DirectionalLight(0xffffff, 1.84)
key.position.set(-3, 6, 8)
scene.add(key)

function render() {
  if (renderer) renderer.render(scene, camera)
}

function frame(t: number) {
  controls?.update()
  if (current && !reduced) {
    const s = t / 1000
    current.root.rotation.z = Math.sin((s * Math.PI * 2) / 3.6) * 0.018
    if (current.buddy) {
      const p = (s % 3.6) / 3.6
      current.buddy.position.y = p > 0.4 && p < 0.56 ? Math.sin(((p - 0.4) / 0.16) * Math.PI) * 0.1 : 0
    }
  }
  render()
}

function loop(on: boolean) {
  renderer?.setAnimationLoop(on ? frame : null)
}

async function rebuild() {
  const n = ++building
  const next = await buildAvatar(props.parts, props.equipped)
  if (n !== building) {
    next.dispose()
    return
  }
  if (current) {
    scene.remove(current.root)
    current.dispose()
  }
  current = next
  scene.add(next.root)
  render()
}

function fit() {
  if (!renderer || !host.value) return
  const w = host.value.clientWidth
  const h = host.value.clientHeight
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  render()
}

onMounted(async () => {
  if (!host.value) return
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false })
  } catch {
    failed.value = true
    return
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.domElement.classList.add('size-full', 'block')
  host.value.append(renderer.domElement)

  camera.position.set(0, 2.5, 11.5)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 2.2, 0)
  controls.enablePan = false
  controls.enableZoom = false
  controls.enableDamping = !reduced
  controls.dampingFactor = 0.08
  // 視角：上下只到稍微俯視、仰視；左右各 75 度（正側面、背面是充氣的薄邊與反過來的畫，不給轉過去）
  controls.minPolarAngle = Math.PI * 0.4
  controls.maxPolarAngle = Math.PI * 0.54
  controls.minAzimuthAngle = -Math.PI * 0.42
  controls.maxAzimuthAngle = Math.PI * 0.42
  controls.rotateSpeed = 0.7
  // 手機上下滑還是捲頁面，左右拖才轉
  renderer.domElement.style.touchAction = 'pan-y'
  controls.addEventListener('change', render)
  controls.update()

  fit()
  resize = new ResizeObserver(fit)
  resize.observe(host.value)
  io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting)
    loop(visible && !document.hidden && !reduced)
  })
  io.observe(host.value)
  await rebuild()
  loop(visible && !reduced)
})

const onVisibility = () => loop(visible && !document.hidden && !reduced)
document.addEventListener('visibilitychange', onVisibility)

watch(
  () => [props.parts, props.equipped],
  () => void rebuild(),
  { deep: true },
)

/** 雙擊轉回正面 */
function home() {
  if (!controls) return
  camera.position.set(0, 2.5, 11.5)
  controls.target.set(0, 2.2, 0)
  controls.update()
  render()
}

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  loop(false)
  resize?.disconnect()
  io?.disconnect()
  controls?.dispose()
  if (current) current.dispose()
  renderer?.dispose()
  renderer?.domElement.remove()
})
</script>

<template>
  <div ref="host" class="avatar-3d relative cursor-grab active:cursor-grabbing" role="img" aria-label="旅人（3D，可以拖曳轉圈）" @dblclick="home">
    <p v-if="failed" class="absolute inset-0 grid place-items-center text-body-sm text-sub">這台裝置不支援 3D 顯示</p>
  </div>
</template>
