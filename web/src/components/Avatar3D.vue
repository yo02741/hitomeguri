<script setup lang="ts">
import { AmbientLight, DirectionalLight, MathUtils, PerspectiveCamera, Scene, Spherical, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { Slot } from '../data/outfits'
import { type Avatar3D, buildAvatar } from '../services/avatar3d/avatar'
import type { AvatarParts } from '../stores/avatar'

// 3D 旅人的展示窗（DESIGN.md §7.24a）：拖曳轉（左右各 75 度、上下一點點），放開帶一點慣性。
// 雙擊轉回正面；鍵盤 ←→ 一次轉 30 度、Home 回正面（跟紙立牌一樣）。
// 平常輕輕搖、夥伴偶爾跳一下；捲出畫面、分頁在背景時停；減少動態時不搖，只在拖曳時重畫。
// 構圖跟紙立牌相同：腳底在下緣往上 17%（旅人頁地板的上緣），頭頂到 82% 左右；畫面窄的時候改用寬度決定，左右不切到。
// 換外觀或服裝就重新生成（要畫幾張點陣、算距離場，約 0.15 秒），舊的釋放掉。
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

/** 鏡頭離旅人多遠（遠一點透視變形小）、正面時從多高往下看一點 */
const DIST = 15
const LIFT = 0.4
/** 腳底在畫面高度的哪裡（從下緣算）；畫面至少看得到的上下、左右半寬（紙娃娃的頭高 54px = 1） */
const FEET = 0.17
const HALF_H = 3.36
const HALF_W = 2.3
const offset = new Vector3()
const sph = new Spherical()
/** 鍵盤、雙擊要轉到的角度；動畫迴圈每格往那裡靠一點 */
let aim: { theta: number; phi: number } | null = null
const HOME_PHI = Math.atan2(DIST, LIFT)

// 卡通著色：環境光＋左上的主光；全亮時剛好是原本的顏色（MeshToonMaterial 的亮度是 強度 / π，兩個加起來 π）
scene.add(new AmbientLight(0xffffff, 1.3))
const key = new DirectionalLight(0xffffff, 1.84)
key.position.set(-3, 6, 8)
scene.add(key)

function render() {
  if (renderer) renderer.render(scene, camera)
}

/** 依目前鏡頭到中心的方向，換成 (theta, phi) 再放回去 */
function orbit(theta: number, phi: number) {
  if (!controls) return
  sph.setFromVector3(offset.copy(camera.position).sub(controls.target))
  sph.theta = MathUtils.clamp(theta, controls.minAzimuthAngle, controls.maxAzimuthAngle)
  sph.phi = MathUtils.clamp(phi, controls.minPolarAngle, controls.maxPolarAngle)
  camera.position.copy(controls.target).add(offset.setFromSpherical(sph))
  camera.lookAt(controls.target)
}

function ease() {
  if (!aim || !controls) return
  sph.setFromVector3(offset.copy(camera.position).sub(controls.target))
  const dt = aim.theta - sph.theta
  const dp = aim.phi - sph.phi
  if (Math.abs(dt) < 0.002 && Math.abs(dp) < 0.002) {
    orbit(aim.theta, aim.phi)
    aim = null
  } else orbit(sph.theta + dt * 0.16, sph.phi + dp * 0.16)
}

function frame(t: number) {
  ease()
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
  if (!renderer || !host.value || !controls) return
  const w = host.value.clientWidth
  const h = host.value.clientHeight
  if (!w || !h) return
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  // 看得到的半高：至少 HALF_H；畫面窄就放大到左右也有 HALF_W。腳底留在 FEET，中心跟著上下移（鏡頭一起移，角度不變）
  const half = Math.max(HALF_H, HALF_W / camera.aspect)
  camera.fov = MathUtils.radToDeg(2 * Math.atan(half / DIST))
  camera.updateProjectionMatrix()
  const dy = half * (1 - 2 * FEET) - controls.target.y
  controls.target.y += dy
  camera.position.y += dy
  controls.update()
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

  camera.position.set(0, LIFT, DIST)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0, 0)
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
  // 開始拖曳就不再轉向鍵盤、雙擊要去的角度
  controls.addEventListener('start', () => (aim = null))
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

/** 轉到 (theta, phi)：減少動態或動畫迴圈沒在跑時直接到 */
function turn(theta: number, phi: number) {
  if (!controls) return
  aim = { theta, phi }
  if (reduced || !visible || document.hidden) {
    orbit(theta, phi)
    aim = null
    controls.update()
    render()
  }
}

/** 雙擊、Home 轉回正面 */
function home() {
  turn(0, HOME_PHI)
}

function onKey(e: KeyboardEvent) {
  if (!controls) return
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    sph.setFromVector3(offset.copy(camera.position).sub(controls.target))
    const from = aim?.theta ?? sph.theta
    turn(from + (e.key === 'ArrowLeft' ? 1 : -1) * MathUtils.degToRad(30), aim?.phi ?? sph.phi)
  } else if (e.key === 'Home') home()
  else return
  e.preventDefault()
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
  <!-- 外層接使用的地方給的版面（absolute inset-0、aspect…），裡面這層放畫布 -->
  <div class="avatar-3d cursor-grab select-none active:cursor-grabbing" tabindex="0" role="img" aria-label="旅人（可以左右拖拉旋轉）" @dblclick="home" @keydown="onKey">
    <div ref="host" class="relative size-full">
      <p v-if="failed" class="absolute inset-0 grid place-items-center text-body-sm text-sub">這台裝置不支援 3D 顯示</p>
    </div>
  </div>
</template>

<style scoped>
.avatar-3d {
  outline-offset: -4px;
}
</style>
