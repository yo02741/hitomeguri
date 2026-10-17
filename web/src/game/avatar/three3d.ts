/**
 * 旅人側面（side3d.ts）用到的 three.js：只 re-export 用到的幾個（整個命名空間 import 的話打包器沒辦法 tree-shake，
 * Avatar3D 那一檔會多出 PositionalAudio、AnimationMixer 之類用不到的）。side3d 要用新的類別時加在這裡。
 */
export { AmbientLight, Group, LinearFilter, OrthographicCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
