/*
 * MIT License
 * Copyright (c) 2026 background pack contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
(function (global) {
  "use strict";

  var vertexSource = "#version 300 es\n" +
    "void main() {\n" +
    "  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));\n" +
    "  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);\n" +
    "}\n";

  var fragmentPrefix = "#version 300 es\n" +
    "precision highp float;\nprecision highp int;\n" +
    "uniform vec3 iResolution;\nuniform float iTime;\n" +
    "uniform vec4 iMouse;\nuniform int iFrame;\n" +
    "out vec4 backgroundOutput;\n";

  function finiteNumber(value, fallback, min, max) {
    value = Number(value);
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  }

  /**
   * Render a Shadertoy-style mainImage source into a canvas with WebGL2.
   * Give the canvas explicit CSS dimensions, e.g. width:100%; height:100%.
   * options: resolutionScale (0.1..1, default 0.6), speed (0..10, default 0.5),
   * fps (1..60, default 30), paused (default false).
   * No mouse handlers are installed: text controls above the canvas stay usable.
   * The host should call pause()/resume() for reduced motion and hidden pages.
   * Compile/link failures throw Error objects containing the WebGL driver's log.
   */
  function createShaderBackground(canvas, source, options) {
    options = options || {};
    if (!canvas || typeof canvas.getContext !== "function") {
      throw new TypeError("createShaderBackground requires an HTML canvas element.");
    }
    if (typeof source !== "string" || !source.trim()) {
      throw new TypeError("createShaderBackground requires a shader source string.");
    }

    var gl = canvas.getContext("webgl2", {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false,
      powerPreference: "low-power"
    });
    if (!gl) throw new Error("This background requires WebGL2, which is unavailable in this browser or device.");

    var scale = finiteNumber(options.resolutionScale, 0.6, 0.1, 1);
    var speed = finiteNumber(options.speed, 0.5, 0, 10);
    var fps = finiteNumber(options.fps, 30, 1, 60);
    var resources = null;
    var frame = 0;
    var elapsed = 0;
    var lastTime = performance.now();
    var lastRender = -Infinity;
    var raf = 0;
    var paused = !!options.paused;
    var destroyed = false;
    var contextLost = false;
    var observer = null;

    function compile(type, text, label) {
      var shader = gl.createShader(type);
      if (!shader) throw new Error("Unable to create the " + label + " shader.");
      gl.shaderSource(shader, text);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        var log = gl.getShaderInfoLog(shader) || "No compiler log was supplied.";
        gl.deleteShader(shader);
        throw new Error(label + " shader compilation failed:\n" + log);
      }
      return shader;
    }

    function createResources() {
      var vertex = null, fragment = null, program = null, vao = null;
      try {
        vertex = compile(gl.VERTEX_SHADER, vertexSource, "Vertex");
        fragment = compile(gl.FRAGMENT_SHADER, fragmentPrefix + source +
          "\nvoid main() { mainImage(backgroundOutput, gl_FragCoord.xy); }\n", "Fragment");
        program = gl.createProgram();
        if (!program) throw new Error("Unable to create the background shader program.");
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          throw new Error("Background shader linking failed:\n" +
            (gl.getProgramInfoLog(program) || "No linker log was supplied."));
        }
        vao = gl.createVertexArray();
        if (!vao) throw new Error("Unable to create the background vertex array.");
        return {
          program: program, vao: vao,
          resolution: gl.getUniformLocation(program, "iResolution"),
          time: gl.getUniformLocation(program, "iTime"),
          mouse: gl.getUniformLocation(program, "iMouse"),
          frame: gl.getUniformLocation(program, "iFrame")
        };
      } catch (error) {
        if (vao) gl.deleteVertexArray(vao);
        if (program) gl.deleteProgram(program);
        throw error;
      } finally {
        if (vertex) gl.deleteShader(vertex);
        if (fragment) gl.deleteShader(fragment);
      }
    }

    function releaseResources() {
      if (!resources) return;
      gl.deleteVertexArray(resources.vao);
      gl.deleteProgram(resources.program);
      resources = null;
    }

    function draw() {
      if (destroyed || contextLost || !resources) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.useProgram(resources.program);
      gl.bindVertexArray(resources.vao);
      gl.uniform3f(resources.resolution, canvas.width, canvas.height, 1);
      gl.uniform1f(resources.time, elapsed);
      gl.uniform4f(resources.mouse, 0, 0, 0, 0);
      // iFrame must be an int. Topologica's ZERO_TRICK loop uses it as an int.
      gl.uniform1i(resources.frame, frame);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
      frame = (frame + 1) & 0x7fffffff;
    }

    function resize() {
      if (destroyed || contextLost) return;
      var rect = canvas.getBoundingClientRect();
      var dpr = Math.min(1, global.devicePixelRatio || 1);
      var maxViewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
      var maxSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
      var width = Math.max(1, Math.min(maxSize, maxViewport[0], Math.round(rect.width * dpr * scale)));
      var height = Math.max(1, Math.min(maxSize, maxViewport[1], Math.round(rect.height * dpr * scale)));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        draw();
      }
    }

    function updateTime(now) {
      elapsed += Math.max(0, now - lastTime) * 0.001 * speed;
      lastTime = now;
    }

    function tick(now) {
      raf = 0;
      if (destroyed || paused || contextLost) return;
      var interval = 1000 / fps;
      if (now - lastRender >= interval - 0.25) {
        updateTime(now);
        draw();
        lastRender = now;
      }
      raf = global.requestAnimationFrame(tick);
    }

    function pause() {
      if (destroyed || paused) return;
      if (!contextLost) updateTime(performance.now());
      paused = true;
      if (raf) global.cancelAnimationFrame(raf);
      raf = 0;
    }

    function resume() {
      if (destroyed) return;
      paused = false;
      if (contextLost || raf) return;
      lastTime = performance.now();
      lastRender = -Infinity;
      raf = global.requestAnimationFrame(tick);
    }

    function onContextLost(event) {
      event.preventDefault();
      contextLost = true;
      if (raf) global.cancelAnimationFrame(raf);
      raf = 0;
      resources = null;
    }

    function onContextRestored() {
      if (destroyed) return;
      contextLost = false;
      try {
        resources = createResources();
        resize();
        draw();
        if (!paused) resume();
      } catch (error) {
        pause();
        canvas.dispatchEvent(new CustomEvent("background-error", { detail: error }));
      }
    }

    function destroy() {
      if (destroyed) return;
      if (raf) global.cancelAnimationFrame(raf);
      raf = 0;
      destroyed = true;
      if (observer) observer.disconnect();
      global.removeEventListener("resize", resize);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      releaseResources();
    }

    resources = createResources();
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    global.addEventListener("resize", resize);
    if (typeof ResizeObserver === "function") {
      observer = new ResizeObserver(resize);
      observer.observe(canvas);
    }
    resize();
    draw();
    if (!paused) resume();

    return {
      pause: pause,
      resume: resume,
      resize: resize,
      destroy: destroy,
      setSpeed: function (value) {
        if (destroyed) return;
        if (!paused && !contextLost) updateTime(performance.now());
        speed = finiteNumber(value, speed, 0, 10);
      },
      setResolutionScale: function (value) {
        if (destroyed) return;
        scale = finiteNumber(value, scale, 0.1, 1);
        resize();
      },
      get paused() { return paused; },
      get destroyed() { return destroyed; },
      get contextLost() { return contextLost; }
    };
  }

  global.createShaderBackground = createShaderBackground;
})(window);
