/*!
Selected Vanta 0.5.24 visual, rebuilt from commit f8b351906688b56f0fc744e53bde81fc3c56f150.
See MODIFICATIONS.json for the small distribution changes.

Copyright 2020 Teng Bao

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


Dependency: Three.js r134
The MIT License

Copyright © 2010-2021 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/
(function () {
  'use strict';
  const modules = {
"src/vanta.dots.js": function(module, exports, require) {
const VantaBase = require("src/_base.js").default;
const {VANTA} = require("src/_base.js");
const {rn, ri, sample, mobileCheck} = require("src/helpers.js");
const win = typeof window == 'object'
let THREE = win && window.THREE

class Effect extends VantaBase {
  static initClass() {
    this.prototype.defaultOptions = {
      color: 0xff8820,
      color2: 0xff8820,
      backgroundColor: 0x222222,
      size: 3,
      spacing: 35,
      showLines: true,
    };
  }

  onInit() {
    var camera = this.camera = new THREE.PerspectiveCamera(50, this.width / this.height, 0.1, 5000)
    camera.position.x = 0
    camera.position.y = 250
    camera.position.z = 50
    camera.tx = 0
    camera.ty = 50
    camera.tz = 350
    camera.lookAt(0,0,0)
    this.scene.add(camera)

    var starsGeometry = this.starsGeometry = new THREE.BufferGeometry()
    var i,j,k,l,star,starsMaterial,starField
    var space = this.options.spacing
    const points = []

    for (i = k = -30; k <= 30; i = ++k) {
      for (j = l = -30; l <= 30; j = ++l) {
        star = new THREE.Vector3()
        star.x = i * space + space/2
        star.y = rn(0, 5) - 150
        star.z = j * space + space/2
        points.push(star)
      }
    }
    starsGeometry.setFromPoints(points)


    starsMaterial = new THREE.PointsMaterial({
      color: this.options.color,
      size: this.options.size
    });
    starField = this.starField = new THREE.Points(starsGeometry, starsMaterial)
    this.scene.add(starField)

    if (this.options.showLines) {
      var material = new THREE.LineBasicMaterial( { color: this.options.color2 } );
      var linesGeo = new THREE.BufferGeometry()
      const points = []
      for (i = 0; i < 200; i ++) {
        var f1 = rn(40,60)
        var f2 = f1 + rn(12,20)
        // https://math.stackexchange.com/questions/1585975/how-to-generate-random-points-on-a-sphere
        var z = rn(-1,1)
        var r = Math.sqrt(1 - z*z)
        var theta = rn(0, Math.PI * 2)
        var y = Math.sin(theta) * r
        var x = Math.cos(theta) * r
        points.push(new THREE.Vector3( x*f1, y*f1, z*f1) )
        points.push(new THREE.Vector3( x*f2, y*f2, z*f2) )
      }
      linesGeo.setFromPoints(points)
      this.linesMesh = new THREE.LineSegments( linesGeo, material )
      this.scene.add(this.linesMesh)
    }

    // this.geometry = new THREE.BoxGeometry( 10, 10, 10 );
    // this.material = new THREE.MeshLambertMaterial({
    //   color: this.options.color,
    //   emissive: this.options.color,
    //   emissiveIntensity: 0.75
    // });
    // this.cube = new THREE.Mesh( this.geometry, this.material );
    // this.scene.add(this.cube);

    // const c = this.camera = new THREE.PerspectiveCamera( 75, this.width/this.height, 0.1, 1000 );
    // c.position.z = 30;
    // this.scene.add(c);

    // const light = new THREE.HemisphereLight( 0xffffff, this.options.backgroundColor , 1 );
    // this.scene.add(light);
  }

  onUpdate() {
    const starsGeometry = this.starsGeometry
    const starField = this.starField
    for (var j = 0; j < starsGeometry.attributes.position.array.length; j+=3) {
      const x = starsGeometry.attributes.position.array[j]
      const y = starsGeometry.attributes.position.array[j+1]
      const z = starsGeometry.attributes.position.array[j+2]
      // var i = starsGeometry.vertices[j]
      const newY = y + 0.1 * Math.sin(z*0.02 + x*0.015 + this.t*0.02)
      starsGeometry.attributes.position.array[j+1] = newY
    }

    starsGeometry.attributes.position.setUsage(THREE.DynamicDrawUsage)
    starsGeometry.computeVertexNormals()
    starsGeometry.attributes.position.needsUpdate = true

    const c = this.camera
    const rate = 0.003
    c.position.x += (c.tx - c.position.x) * rate
    c.position.y += (c.ty - c.position.y) * rate
    c.position.z += (c.tz - c.position.z) * rate
    c.lookAt(0,0,0)

    if (this.linesMesh) {
      this.linesMesh.rotation.z += 0.002
      this.linesMesh.rotation.x += 0.0008
      this.linesMesh.rotation.y += 0.0005
      // starField.rotation.y += (this.mouseX * 0.1 - starField.rotation.y) * 0.01
    }
  }

  onMouseMove(x,y) {
    this.camera.tx = (x - 0.5) * 100 // -50 to 50
    this.camera.ty = 50 + y * 50 // 50 to 100
  }

  onRestart() {
    this.scene.remove( this.starField )
  }
}
Effect.initClass()
exports.default = VANTA.register('DOTS', Effect)



},
"src/_base.js": function(module, exports, require) {
const {mobileCheck, q, color2Hex, clearThree} = require("src/helpers.js");
// const DEBUGMODE = window.location.toString().indexOf('VANTADEBUG') !== -1

const win = typeof window == 'object'
let THREE = (win && window.THREE) || {}
if (win && !window.VANTA) window.VANTA = {}
const VANTA = (win && window.VANTA) || {}
VANTA.register = (name, Effect) => {
  return VANTA[name] = (opts) => new Effect(opts)
}
VANTA.version = '0.5.24'

exports.VANTA = VANTA;
// const ORBITCONTROLS = {
//   enableZoom: false,
//   userPanSpeed: 3,
//   userRotateSpeed: 2.0,
//   maxPolarAngle: Math.PI * 0.8, // (pi/2 is pure horizontal)
//   mouseButtons: {
//     ORBIT: THREE.MOUSE.LEFT,
//     ZOOM: null,
//     PAN: null
//   }
// }
// if (DEBUGMODE) {
//   Object.assign(ORBITCONTROLS, {
//     enableZoom: true,
//     zoomSpeed: 4,
//     minDistance: 100,
//     maxDistance: 4500
//   })
// }

// Namespace for errors
const error = function() {
  Array.prototype.unshift.call(arguments, '[VANTA]')
  return console.error.apply(this, arguments)
}

VANTA.VantaBase = class VantaBase {
  constructor(userOptions = {}) {
    if (!win) return false
    VANTA.current = this
    this.windowMouseMoveWrapper = this.windowMouseMoveWrapper.bind(this)
    this.windowTouchWrapper = this.windowTouchWrapper.bind(this)
    this.windowGyroWrapper = this.windowGyroWrapper.bind(this)
    this.resize = this.resize.bind(this)
    this.animationLoop = this.animationLoop.bind(this)
    this.restart = this.restart.bind(this)

    const defaultOptions = (typeof this.getDefaultOptions === 'function') ? this.getDefaultOptions() : this.defaultOptions
    this.options = Object.assign({
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200,
      minWidth: 200,
      scale: 1,
      scaleMobile: 1,
    }, defaultOptions)

    if (userOptions instanceof HTMLElement || typeof userOptions === 'string') {
      userOptions = {el: userOptions}
    }
    Object.assign(this.options, userOptions)

    if (this.options.THREE) {
      THREE = this.options.THREE // Optionally use a custom build of three.js
    }

    // Set element
    this.el = this.options.el
    if (this.el == null) {
      error("Instance needs \"el\" param!")
    } else if (!(this.options.el instanceof HTMLElement)) {
      const selector = this.el
      this.el = q(selector)
      if (!this.el) {
        error("Cannot find element", selector)
        return
      }
    }

    this.prepareEl()
    this.initThree()
    this.setSize() // Init needs size

    try {
      this.init()
    } catch (e) {
      // FALLBACK - just use color
      error('Init error', e)
      if (this.renderer && this.renderer.domElement) {
        this.el.removeChild(this.renderer.domElement)
      }
      if (this.options.backgroundColor) {
        console.log('[VANTA] Falling back to backgroundColor')
        this.el.style.background = color2Hex(this.options.backgroundColor)
      }
      return
    }

    // After init
    this.initMouse() // Triggers mouse, which needs to be called after init
    this.resize()
    this.animationLoop()

    // Event listeners
    const ad = window.addEventListener
    ad('resize', this.resize)
    window.requestAnimationFrame(this.resize) // Force a resize after the first frame

    // Add event listeners on window, because this element may be below other elements, which would block the element's own mousemove event
    if (this.options.mouseControls) {
      ad('scroll', this.windowMouseMoveWrapper)
      ad('mousemove', this.windowMouseMoveWrapper)
    }
    if (this.options.touchControls) {
      ad('touchstart', this.windowTouchWrapper)
      ad('touchmove', this.windowTouchWrapper)
    }
    if (this.options.gyroControls) {
      ad('deviceorientation', this.windowGyroWrapper)
    }
  }

  setOptions(userOptions={}){
    Object.assign(this.options, userOptions)
    this.triggerMouseMove()
  }

  prepareEl() {
    let i, child
    // wrapInner for text nodes, so text nodes can be put into foreground
    if (typeof Node !== 'undefined' && Node.TEXT_NODE) {
      for (i = 0; i < this.el.childNodes.length; i++) {
        const n = this.el.childNodes[i]
        if (n.nodeType === Node.TEXT_NODE) {
          const s = document.createElement('span')
          s.textContent = n.textContent
          n.parentElement.insertBefore(s, n)
          n.remove()
        }
      }
    }
    // Set foreground elements
    for (i = 0; i < this.el.children.length; i++) {
      child = this.el.children[i]
      if (getComputedStyle(child).position === 'static') {
        child.style.position = 'relative'
      }
      if (getComputedStyle(child).zIndex === 'auto') {
        child.style.zIndex = 1
      }
    }
    // Set canvas and container style
    if (getComputedStyle(this.el).position === 'static') {
      this.el.style.position = 'relative'
    }
  }

  applyCanvasStyles(canvasEl, opts={}){
    Object.assign(canvasEl.style, {
      position: 'absolute',
      zIndex: 0,
      top: 0,
      left: 0,
      background: '',
    })
    if (this.options.pixelated) {
      canvasEl.style.imageRendering = 'pixelated'
    }
    Object.assign(canvasEl.style, opts)
    canvasEl.classList.add('vanta-canvas')
  }

  initThree() {
    if (!THREE.WebGLRenderer) {
      console.warn("[VANTA] No THREE defined on window")
      return
    }
    // Set renderer
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    })
    this.el.appendChild(this.renderer.domElement)
    this.applyCanvasStyles(this.renderer.domElement)
    if (isNaN(this.options.backgroundAlpha)) {
      this.options.backgroundAlpha = 1
    }

    this.scene = new THREE.Scene()
  }

  getCanvasElement() {
    if (this.renderer) {
      return this.renderer.domElement // three.js
    }
    if (this.p5renderer) {
      return this.p5renderer.canvas // p5
    }
  }

  getCanvasRect() {
    const canvas = this.getCanvasElement()
    if (!canvas) return false
    return canvas.getBoundingClientRect()
  }

  windowMouseMoveWrapper(e){
    const rect = this.getCanvasRect()
    if (!rect) return false
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (x>=0 && y>=0 && x<=rect.width && y<=rect.height) {
      this.mouseX = x
      this.mouseY = y
      if (!this.options.mouseEase) this.triggerMouseMove(x, y)
    }
  }
  windowTouchWrapper(e){
    const rect = this.getCanvasRect()
    if (!rect) return false
    if (e.touches.length === 1) {
      const x = e.touches[0].clientX - rect.left
      const y = e.touches[0].clientY - rect.top
      if (x>=0 && y>=0 && x<=rect.width && y<=rect.height) {
        this.mouseX = x
        this.mouseY = y
        if (!this.options.mouseEase) this.triggerMouseMove(x, y)
      }
    }
  }
  windowGyroWrapper(e){
    const rect = this.getCanvasRect()
    if (!rect) return false
    const x = Math.round(e.alpha * 2) - rect.left
    const y = Math.round(e.beta * 2) - rect.top
    if (x>=0 && y>=0 && x<=rect.width && y<=rect.height) {
      this.mouseX = x
      this.mouseY = y
      if (!this.options.mouseEase) this.triggerMouseMove(x, y)
    }
  }

  triggerMouseMove(x, y) {
    if (x === undefined && y === undefined) { // trigger at current position
      if (this.options.mouseEase) {
        x = this.mouseEaseX
        y = this.mouseEaseY
      } else {
        x = this.mouseX
        y = this.mouseY
      }
    }
    if (this.uniforms) {
      this.uniforms.iMouse.value.x = x / this.scale // pixel values
      this.uniforms.iMouse.value.y = y / this.scale // pixel values
    }
    const xNorm = x / this.width // 0 to 1
    const yNorm = y / this.height // 0 to 1
    typeof this.onMouseMove === "function" ? this.onMouseMove(xNorm, yNorm) : void 0
  }

  setSize() {
    this.scale || (this.scale = 1)
    if (mobileCheck() && this.options.scaleMobile) {
      this.scale = this.options.scaleMobile
    } else if (this.options.scale) {
      this.scale = this.options.scale
    }
    this.width = Math.max(this.el.offsetWidth, this.options.minWidth)
    this.height = Math.max(this.el.offsetHeight, this.options.minHeight)
  }
  initMouse() {
    // Init mouseX and mouseY
    if ((!this.mouseX && !this.mouseY) ||
      (this.mouseX === this.options.minWidth/2 && this.mouseY === this.options.minHeight/2)) {
      this.mouseX = this.width/2
      this.mouseY = this.height/2
      this.triggerMouseMove(this.mouseX, this.mouseY)
    }
  }

  resize() {
    this.setSize()
    if (this.camera) {
      this.camera.aspect = this.width / this.height
      if (typeof this.camera.updateProjectionMatrix === "function") {
        this.camera.updateProjectionMatrix()
      }
    }
    if (this.renderer) {
      this.renderer.setSize(this.width, this.height)
      this.renderer.setPixelRatio(window.devicePixelRatio / this.scale)
    }
    typeof this.onResize === "function" ? this.onResize() : void 0
  }

  isOnScreen() {
    const elHeight = this.el.offsetHeight
    const elRect = this.el.getBoundingClientRect()
    const scrollTop = (window.pageYOffset ||
      (document.documentElement || document.body.parentNode || document.body).scrollTop
    )
    const offsetTop = elRect.top + scrollTop
    const minScrollTop = offsetTop - window.innerHeight
    const maxScrollTop = offsetTop + elHeight
    return minScrollTop <= scrollTop && scrollTop <= maxScrollTop
  }

  animationLoop() {
    // Step time
    this.t || (this.t = 0)
    // Uniform time
    this.t2 || (this.t2 = 0)

    // Normalize animation speed to 60fps
    const now = performance.now()
    if (this.prevNow) {
      let elapsedTime = (now-this.prevNow) / (1000/60)
      elapsedTime = Math.max(0.2, Math.min(elapsedTime, 5))
      this.t += elapsedTime

      this.t2 += (this.options.speed || 1) * elapsedTime
      if (this.uniforms) {
        this.uniforms.iTime.value = this.t2 * 0.016667 // iTime is in seconds
      }
    }
    this.prevNow = now


    if (this.options.mouseEase) {
      this.mouseEaseX = this.mouseEaseX || this.mouseX || 0
      this.mouseEaseY = this.mouseEaseY || this.mouseY || 0
      if (Math.abs(this.mouseEaseX-this.mouseX) + Math.abs(this.mouseEaseY-this.mouseY) > 0.1) {
        this.mouseEaseX += (this.mouseX - this.mouseEaseX) * 0.05
        this.mouseEaseY += (this.mouseY - this.mouseEaseY) * 0.05
        this.triggerMouseMove(this.mouseEaseX, this.mouseEaseY)
      }
    }

    // Only animate if element is within view
    if (this.isOnScreen() || this.options.forceAnimate) {
      if (typeof this.onUpdate === "function") {
        this.onUpdate()
      }
      if (this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera)
        this.renderer.setClearColor(this.options.backgroundColor, this.options.backgroundAlpha)
      }
      // if (this.stats) this.stats.update()
      // if (this.renderStats) this.renderStats.update(this.renderer)
      if (this.fps && this.fps.update) this.fps.update()
      if (typeof this.afterRender === "function") this.afterRender()
    }
    return this.req = window.requestAnimationFrame(this.animationLoop)
  }

  // setupControls() {
  //   if (DEBUGMODE && THREE.OrbitControls) {
  //     this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement)
  //     Object.assign(this.controls, ORBITCONTROLS)
  //     return this.scene.add(new THREE.AxisHelper(100))
  //   }
  // }

  restart() {
    // Restart the effect without destroying the renderer
    if (this.scene) {
      while (this.scene.children.length) {
        this.scene.remove(this.scene.children[0])
      }
    }
    if (typeof this.onRestart === "function") {
      this.onRestart()
    }
    this.init()
  }

  init() {
    if (typeof this.onInit === "function") {
      this.onInit()
    }
    // this.setupControls()
  }

  destroy() {
    if (typeof this.onDestroy === "function") {
      this.onDestroy()
    }
    const rm = window.removeEventListener
    rm('touchstart', this.windowTouchWrapper)
    rm('touchmove', this.windowTouchWrapper)
    rm('scroll', this.windowMouseMoveWrapper)
    rm('mousemove', this.windowMouseMoveWrapper)
    rm('deviceorientation', this.windowGyroWrapper)
    rm('resize', this.resize)
    window.cancelAnimationFrame(this.req)

    const scene = this.scene
    if (scene && scene.children) {
      clearThree(scene)
    }
    if (this.renderer) {
      if (this.renderer.domElement) {
        this.el.removeChild(this.renderer.domElement)
      }
      this.renderer = null
      this.scene = null
    }

    if (VANTA.current === this) {
      VANTA.current = null
    }
  }
}

exports.default = VANTA.VantaBase


},
"src/helpers.js": function(module, exports, require) {
Number.prototype.clamp = function(min, max) { return Math.min(Math.max(this, min), max) }

// # module.exports = helpers

function mobileCheck(){
  if (typeof navigator !== 'undefined') {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 600
  }
  return null
}
const sample = items => items[Math.floor(Math.random()*items.length)]

function rn(start,end) {
  if (start == null) start = 0
  if (end == null) end = 1
  return start + (Math.random() * (end - start))
}

function ri(start,end) {
  if (start == null) start = 0
  if (end == null) end = 1
  return Math.floor(start + (Math.random() * ((end - start) + 1)))
}

const q = sel => document.querySelector(sel)

const color2Hex = (color) => {
  if (typeof color == 'number'){
    return '#' +  ('00000' + color.toString(16)).slice(-6)
  } else return color
}

const color2Rgb = (color, alpha=1) => {
  const hex = color2Hex(color)
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  const obj = result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
  } : null
  return 'rgba('+ obj.r +','+ obj.g +','+ obj.b +','+ alpha +')'
}

const getBrightness = (threeColor) => {
  return (0.299 * threeColor.r) + (0.587 * threeColor.g) + (0.114 * threeColor.b);
}

// Independently implemented resource cleanup for this distribution.
// Uses an iterative traversal and de-duplicates disposable resources.
function clearThree(root) {
  const nodes = [root];
  const resources = new Set();
  for (let cursor = 0; cursor < nodes.length; cursor += 1) {
    const node = nodes[cursor];
    if (!node) continue;
    nodes.push(...(node.children || []));
    if (node.geometry) resources.add(node.geometry);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      resources.add(material);
      for (const resource of Object.values(material)) {
        if (resource && resource.isTexture) resources.add(resource);
      }
    }
  }
  for (const resource of resources) {
    if (typeof resource.dispose === 'function') resource.dispose();
  }
  for (let index = nodes.length - 1; index > 0; index -= 1) {
    const node = nodes[index];
    if (node && node.parent) node.parent.remove(node);
  }
}

exports.mobileCheck = mobileCheck;
exports.sample = sample;
exports.rn = rn;
exports.ri = ri;
exports.q = q;
exports.color2Hex = color2Hex;
exports.color2Rgb = color2Rgb;
exports.getBrightness = getBrightness;
exports.clearThree = clearThree;

}
  };
  const cache = Object.create(null);
  function require(id) {
    if (!cache[id]) {
      const module = { exports: {} };
      cache[id] = module;
      modules[id](module, module.exports, require);
    }
    return cache[id].exports;
  }
  require("src/vanta.dots.js");
})();
