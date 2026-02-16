// render.js

class Renderer {
    constructor(canvas, system) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.system = system;
        
        // Viewport State
        this.scale = 2.0; // Pixels per unit
        this.offsetX = canvas.width / 2;
        this.offsetY = canvas.height / 2;
        
        // Mouse State
        this.isDragging = false;
        this.dragTarget = null; // 'lens', 'object', 'view'
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Resize observer
        window.addEventListener('resize', () => this.resize());
        this.resize();
    }

    resize() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        
        // re-center canvas on optical axis
        this.offsetX = this.canvas.width / 2;
        this.offsetY = this.canvas.height / 2;
        this.draw();
    }

    // Coordinate Transforms
    toCanvas(z, y) {
        return {
            x: this.offsetX + z * this.scale,
            y: this.offsetY - y * this.scale
        };
    }

    fromCanvas(x, y) {
        return {
            z: (x - this.offsetX) / this.scale,
            y: (this.offsetY - y) / this.scale
        };
    }

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        // Draw Grid
        this.drawGrid();

        // Draw Optical Axis
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, this.offsetY);
        ctx.lineTo(w, this.offsetY);
        ctx.stroke();

        // Draw Lenses
        for (const lens of this.system.lenses) {
            this.drawLens(lens);
        }

        // Draw Principal Planes
        this.drawPrincipalPlanes();
        
        // Draw Rays (Must be traced first in main loop)
        // We assume rays are passed in or stored in system?
        // Actually, main.js will control ray generation and tracing.
        // Let's allow passing rays to draw method or have a property.
    }

    drawGrid() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        const gridSize = 50 * this.scale; // Every 50 units
        const subGridSize = 10 * this.scale; // Every 10 units

        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;

        // Vertical lines
        const startX = (this.offsetX % subGridSize) - subGridSize;
        for (let x = startX; x < w; x += subGridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }

        // Horizontal lines
        const startY = (this.offsetY % subGridSize) - subGridSize;
        for (let y = startY; y < h; y += subGridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
    }

    drawLens(lens) {
        const ctx = this.ctx;
        const center = this.toCanvas(lens.z, 0);
        const top = this.toCanvas(lens.z, lens.h);
        const bottom = this.toCanvas(lens.z, -lens.h);

        ctx.strokeStyle = '#0af';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(bottom.x, bottom.y);
        ctx.stroke();

        // Draw Arrowheads for convex/concave
        const arrowSize = 10;
        ctx.beginPath();
        if (lens.f > 0) {
            // Convex (arrows pointing out)
            ctx.moveTo(top.x - arrowSize, top.y + arrowSize);
            ctx.lineTo(top.x, top.y);
            ctx.lineTo(top.x + arrowSize, top.y + arrowSize);

            ctx.moveTo(bottom.x - arrowSize, bottom.y - arrowSize);
            ctx.lineTo(bottom.x, bottom.y);
            ctx.lineTo(bottom.x + arrowSize, bottom.y - arrowSize);
        } else {
            // Concave (arrows pointing in)
            ctx.moveTo(top.x - arrowSize, top.y);
            ctx.lineTo(top.x, top.y + arrowSize);
            ctx.lineTo(top.x + arrowSize, top.y);

            ctx.moveTo(bottom.x - arrowSize, bottom.y);
            ctx.lineTo(bottom.x, bottom.y - arrowSize);
            ctx.lineTo(bottom.x + arrowSize, bottom.y);
        }
        ctx.stroke();

        // Label
        ctx.fillStyle = '#0af';
        ctx.font = '12px monospace';
        ctx.fillText(`f=${lens.f}`, center.x + 5, bottom.y + 15);
    }

    drawRays(rays) {
        const ctx = this.ctx;
        ctx.lineWidth = 1;
        
        for (const ray of rays) {
            if (ray.path.length < 2) continue;

            // Determine color based on start Y (Marginal vs Chief)
            // Or just a uniform color with transparency
            ctx.strokeStyle = 'rgba(255, 255, 100, 0.5)';
            
            ctx.beginPath();
            const start = this.toCanvas(ray.path[0].z, ray.path[0].y);
            ctx.moveTo(start.x, start.y);

            for (let i = 1; i < ray.path.length; i++) {
                const p = this.toCanvas(ray.path[i].z, ray.path[i].y);
                ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        }
    }

    drawObjectPoint(z, y) {
        const ctx = this.ctx;
        const p = this.toCanvas(z, y);

        ctx.fillStyle = '#f00';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = '#fff';
        ctx.font = '12px monospace';
        ctx.fillText("Obj", p.x + 8, p.y + 3);

        // Draw Object Arrow (Up)
        this.drawArrow(p.x, p.y, 40, true, '#f00');
    }

    drawImagePoint(z, mag, y = 0) {
        // If z is infinite, don't draw
        if (!isFinite(z)) return;

        // Image plane marker
        const ctx = this.ctx;
        const pAxis = this.toCanvas(z, 0); // On axis

        ctx.strokeStyle = '#f0f'; // Magenta
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pAxis.x, 0);
        ctx.lineTo(pAxis.x, this.canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#f0f';
        ctx.fillText("Img", pAxis.x + 5, this.offsetY - 10);

        // Draw Image Point and Arrow
        if (mag !== null && isFinite(mag)) {
            const p = this.toCanvas(z, y);

            ctx.fillStyle = '#f0f';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();

            // Arrow Direction: Up if mag > 0, Down if mag < 0
            const pointsUp = mag > 0;
            this.drawArrow(p.x, p.y, 40, pointsUp, '#f0f');
        }
    }

    drawArrow(x, y, length, pointsUp, color) {
        const ctx = this.ctx;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;

        const halfLen = length / 2;
        // In canvas Y, smaller is higher.
        // pointsUp means arrow points to smaller Y.

        // Let's center the arrow at (x,y)
        // If pointsUp: Top is y - halfLen, Bottom is y + halfLen
        // If pointsDown: Top is y - halfLen, Bottom is y + halfLen (but arrow head at bottom)

        const topY = y - halfLen;
        const bottomY = y + halfLen;

        ctx.beginPath();
        ctx.moveTo(x, topY);
        ctx.lineTo(x, bottomY);
        ctx.stroke();

        // Arrow Head
        const headSize = 8;
        ctx.beginPath();
        if (pointsUp) {
            // Head at topY
            ctx.moveTo(x - headSize/2, topY + headSize);
            ctx.lineTo(x, topY);
            ctx.lineTo(x + headSize/2, topY + headSize);
            ctx.closePath();
        } else {
            // Head at bottomY
            ctx.moveTo(x - headSize/2, bottomY - headSize);
            ctx.lineTo(x, bottomY);
            ctx.lineTo(x + headSize/2, bottomY - headSize);
            ctx.closePath();
        }
        ctx.fill();
    }

    drawPrincipalPlanes() {
        const points = this.system.calculateCardinalPoints();
        if (!points) return;
        
        const { H, H_prime } = points;
        const ctx = this.ctx;

        // H (Front Principal Plane)
        const pH = this.toCanvas(H, 0);
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(pH.x, 0);
        ctx.lineTo(pH.x, this.canvas.height);
        ctx.stroke();
        ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.fillText("H", pH.x + 2, 20);

        // H' (Back Principal Plane)
        const pHp = this.toCanvas(H_prime, 0);
        ctx.beginPath();
        ctx.moveTo(pHp.x, 0);
        ctx.lineTo(pHp.x, this.canvas.height);
        ctx.stroke();
        ctx.fillText("H'", pHp.x + 2, 20);

        ctx.setLineDash([]);
    }
}
