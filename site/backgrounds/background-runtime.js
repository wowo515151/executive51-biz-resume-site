/*
MIT License
Copyright (c) 2026 Background Pack contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
(function () {
  'use strict';
  const vantaSettings = {
    'vanta-net': {color: 0x5ebbe7, backgroundColor: 0x08111e, points: 8, maxDistance: 22, spacing: 18, showDots: true},
    'vanta-waves': {color: 0x135470, waveHeight: 12, waveSpeed: 0.38, shininess: 35, zoom: 0.85},
    'vanta-globe': {color: 0x5eaddc, color2: 0x6889bf, backgroundColor: 0x080f20, points: 7, maxDistance: 20, spacing: 18, size: 0.9},
    'vanta-dots': {color: 0x72b9d8, color2: 0x466780, backgroundColor: 0x071322, size: 2.1, spacing: 30, showLines: false},
    'vanta-rings': {color: 0x74bbc9, backgroundColor: 0x08121f},
    'vanta-halo': {baseColor: 0x052246, color2: 0x6a80be, backgroundColor: 0x06101e, amplitudeFactor: 0.7, size: 1.1, xOffset: 0.15, speed: 0.45}
  };

  function vanta(key, target, options) {
    const name = key.replace('vanta-', '').toUpperCase();
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const instance = window.VANTA[name](Object.assign({
      el: target, mouseControls: false, touchControls: false, gyroControls: false,
      minHeight: 120, minWidth: 120, scale: ratio * 1.35, scaleMobile: ratio * 1.75
    }, vantaSettings[key], options));
    if (!instance.renderer || !target.querySelector('canvas')) {
      throw new Error('This effect needs a working WebGL context.');
    }
    let paused = false;
    let destroyed = false;
    return {
      instance,
      pause() { if (!destroyed) { paused = true; cancelAnimationFrame(instance.req); } },
      resume() {
        if (!destroyed && paused) {
          paused = false; instance.prevNow = performance.now(); instance.animationLoop();
        }
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        const renderer = instance.renderer;
        if (instance.bufferTarget) instance.bufferTarget.dispose();
        if (instance.bufferFeedback) instance.bufferFeedback.dispose();
        instance.destroy();
        renderer.dispose();
        renderer.forceContextLoss();
      }
    };
  }

  function polygonSurface(target) {
    const renderer = new FSS.CanvasRenderer();
    target.appendChild(renderer.element);
    const scene = new FSS.Scene();
    const material = new FSS.Material('#858585', '#cccccc');
    const light1 = new FSS.Light('#123b68', '#6ebae3');
    const light2 = new FSS.Light('#351747', '#9a66b9');
    scene.add(light1); scene.add(light2);
    let geometry, mesh, frame = 0, running = true, destroyed = false, time = 0, previous = 0, lastRender = 0;
    function resize() {
      const width = target.clientWidth || innerWidth;
      const height = target.clientHeight || innerHeight;
      renderer.setSize(width, height);
      if (mesh) scene.remove(mesh);
      geometry = new FSS.Plane(width * 1.3, height * 1.3, 14, 9);
      mesh = new FSS.Mesh(geometry, material); scene.add(mesh);
      geometry.vertices.forEach(vertex => { vertex.anchor = Array.from(vertex.position); });
      draw();
    }
    function draw() {
      geometry.vertices.forEach((vertex, i) => {
        vertex.position[0] = vertex.anchor[0] + 12 * Math.sin(i * .61 + time * .00023);
        vertex.position[1] = vertex.anchor[1] + 9 * Math.cos(i * .41 + time * .00019);
        vertex.position[2] = 38 * Math.sin(i * .7 + time * .0003);
      });
      geometry.dirty = true;
      light1.setPosition(Math.cos(time * .00016) * 300, Math.sin(time * .0002) * 160, 220);
      light2.setPosition(-250, 120, 160);
      renderer.render(scene);
    }
    function tick(now) {
      if (!running) return;
      if (previous) time += Math.min(100, now - previous);
      previous = now;
      if (now - lastRender >= 1000 / 30) { draw(); lastRender = now; }
      frame = requestAnimationFrame(tick);
    }
    resize();
    window.addEventListener('resize', resize);
    frame = requestAnimationFrame(tick);
    return {
      pause() { running = false; cancelAnimationFrame(frame); },
      resume() { if (!running && !destroyed) { running = true; previous = 0; frame = requestAnimationFrame(tick); } },
      destroy() {
        if (destroyed) return;
        destroyed = true; running = false; cancelAnimationFrame(frame);
        window.removeEventListener('resize', resize); renderer.element.remove();
      }
    };
  }

  function start(key, options = {}) {
    const target = options.target || document.getElementById('background');
    const canvas = options.canvas || document.getElementById('effect-canvas');
    if (key.startsWith('vanta-')) return vanta(key, target, options.effectOptions || {});
    if (key === 'particle-constellation') {
      if (!target.id) target.id = 'background';
      particlesJS(target.id, {
        particles: {number: {value: innerWidth < 650 ? 40 : 75, density: {enable: true, value_area: 900}},
          color: {value: '#77c4ed'}, shape: {type: 'circle'}, opacity: {value: .6, random: true},
          size: {value: 2.2, random: true}, line_linked: {enable: true, distance: 170, color: '#5ca7d5', opacity: .35, width: 1},
          move: {enable: true, speed: .6, direction: 'none', random: false, straight: false, out_mode: 'out', bounce: false}},
        interactivity: {detect_on: 'canvas', events: {onhover: {enable: false}, onclick: {enable: false}, resize: true}},
        retina_detect: false
      });
      const instance = window.pJSDom[window.pJSDom.length - 1].pJS;
      return {
        instance,
        pause() { instance.fn.vendors.pause(); },
        resume() { instance.fn.vendors.resume(); },
        destroy() { instance.fn.vendors.destroypJS(); }
      };
    }
    if (key === 'fluid-ink') {
      if (!window.BackgroundFluid) throw new Error('Fluid could not start. WebGL with floating-point render targets is required.');
      return window.BackgroundFluid;
    }
    if (key === 'gradient-drift') {
      const instance = new Granim({
        // This fixed background stays in view. The shared UI owns visibility and
        // reduced-motion pause state, avoiding Granim's delayed first-scroll play.
        element: '#' + canvas.id, direction: 'diagonal', opacity: [1, 1], isPausedWhenNotInView: false,
        states: {'default-state': {gradients: [
          ['#0a1833', '#3b578e'], ['#391b4c', '#1b5c6d'], ['#102f47', '#4a366e']
        ], transitionSpeed: 9000}}
      });
      let destroyed = false;
      return {
        instance,
        pause() { if (!destroyed) instance.pause(); },
        resume() { if (!destroyed) instance.play(); },
        destroy() {
          if (destroyed) return;
          destroyed = true; instance.pause(); instance.destroy();
        }
      };
    }
    if (key === 'canvas-nest') {
      return new CanvasNest(target, {count: innerWidth < 650 ? 80 : 145, color: '100,180,220', pointColor: '160,215,240', opacity: .65, zIndex: 0});
    }
    if (key === 'polygon-surface') return polygonSurface(target);
    if (window.BackgroundShaderSources && window.BackgroundShaderSources[key]) {
      return createShaderBackground(canvas, window.BackgroundShaderSources[key], {
        resolutionScale: innerWidth < 650 ? .42 : .55, fps: 30, speed: key === 'procedural-ocean' ? .5 : .35
      });
    }
    throw new Error('Unknown background: ' + key);
  }
  window.BGPack = {start, vantaSettings};
}());
