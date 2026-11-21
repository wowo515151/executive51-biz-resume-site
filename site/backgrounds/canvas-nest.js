/*!
The MIT License (MIT)

Copyright (c) 2015 Hust.cc

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

Background pack adaptation, 2026-11-21:
Original CanvasNest renderer retained. Removed bundled size-sensor dependency
and replaced it with native ResizeObserver; converted module to browser global;
added pause/resume, corrected point color syntax and isolated mouse listeners.
This is a modified source copy. New support code uses the same MIT terms.
*/
(function(){
'use strict';
/**
 * Created by hustcc on 18/6/23.
 * Contract: i@hust.cc
 */


class CanvasNest {

  static version = '2.0.4-background';

  constructor(el, config) {
    this.el = el;

    this.c = {
      zIndex: -1,           // z-index
      opacity: 0.5,         // opacity
      color: '0,0,0',       // color of lines
      pointColor: '0,0,0',  // color of points
      count: 99,            // count
      ...config,
    };

    this.canvas = this.newCanvas();
    this.context = this.canvas.getContext('2d');

    this.points = this.randomPoints();
    this.current = {
      x: null, // 当前鼠标x
      y: null, // 当前鼠标y
      max: 20000 // 圈半径的平方
    };
    this.all = this.points.concat([this.current]);

    this.paused = false;
    this.destroyed = false;
    this.bindEvent();

    this.requestFrame(this.drawCanvas);
  }

  bindEvent() {
    this.resizeObserver = new ResizeObserver(() => {
      this.canvas.width = this.el.clientWidth;
      this.canvas.height = this.el.clientHeight;
      // Draw one still frame after a paused resize; resizing clears Canvas pixels.
      if (this.paused && !this.destroyed) this.drawCanvas();
    });
    this.resizeObserver.observe(this.el);
    this.mouseMove = event => {
      const rect = this.el.getBoundingClientRect();
      this.current.x = event.clientX - rect.left;
      this.current.y = event.clientY - rect.top;
    };
    this.mouseOut = () => { this.current.x = this.current.y = null; };
    window.addEventListener('mousemove', this.mouseMove, {passive:true});
    window.addEventListener('mouseout', this.mouseOut, {passive:true});
  }

  randomPoints = () => {
    return Array.from({length:this.c.count}).map(() => ({
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      xa: 2 * Math.random() - 1, // 随机运动返现
      ya: 2 * Math.random() - 1,
      max: 6000 // 沾附距离
    }));
  };

  newCanvas() {
    if (getComputedStyle(this.el).position === 'static') {
      this.el.style.position = 'relative'
    }
    const canvas = document.createElement('canvas'); // 画布
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:' + this.c.zIndex + ';opacity:' + this.c.opacity;

    canvas.width = this.el.clientWidth;
    canvas.height = this.el.clientHeight;

    this.el.appendChild(canvas);
    return canvas;
  }

  requestFrame(func) {
    if (!this.paused && !this.destroyed) this.tid = requestAnimationFrame(() => func.call(this));
  }

  drawCanvas() {
    const context = this.context;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const current = this.current;
    const points = this.points;
    const all = this.all;

    context.clearRect(0, 0, width, height);
    // 随机的线条和当前位置联合数组
    let e, i, d, x_dist, y_dist, dist; // 临时节点
    // 遍历处理每一个点
    points.forEach((r, idx) => {
      r.x += r.xa;
      r.y += r.ya; // 移动
      r.xa *= r.x > width || r.x < 0 ? -1 : 1;
      r.ya *= r.y > height || r.y < 0 ? -1 : 1; // 碰到边界，反向反弹
      context.fillStyle = `rgb(${this.c.pointColor})`;
      context.fillRect(r.x - 0.5, r.y - 0.5, 1, 1); // 绘制一个宽高为1的点
      // 从下一个点开始
      for (i = idx + 1; i < all.length; i ++) {
        e = all[i];
        // 当前点存在
        if (null !== e.x && null !== e.y) {
          x_dist = r.x - e.x; // x轴距离 l
          y_dist = r.y - e.y; // y轴距离 n
          dist = x_dist * x_dist + y_dist * y_dist; // 总距离, m

          dist < e.max && (e === current && dist >= e.max / 2 && (r.x -= 0.03 * x_dist, r.y -= 0.03 * y_dist), // 靠近的时候加速
            d = (e.max - dist) / e.max,
            context.beginPath(),
            context.lineWidth = d / 2,
            context.strokeStyle = `rgba(${this.c.color},${d + 0.2})`,
            context.moveTo(r.x, r.y),
            context.lineTo(e.x, e.y),
            context.stroke());
        }
      }
    });
    this.requestFrame(this.drawCanvas);
  }

  pause() {
    this.paused = true;
    cancelAnimationFrame(this.tid);
  }

  resume() {
    if (!this.paused || this.destroyed) return;
    this.paused = false;
    this.requestFrame(this.drawCanvas);
  }

  destroy() {
    this.pause();
    this.destroyed = true;
    this.resizeObserver.disconnect();
    window.removeEventListener('mousemove', this.mouseMove);
    window.removeEventListener('mouseout', this.mouseOut);
    this.canvas.remove();
  }
}
window.CanvasNest = CanvasNest;
})();
