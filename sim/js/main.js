// main.js

const canvas = document.getElementById('optics-canvas');
const system = new OpticalSystem();
const renderer = new Renderer(canvas, system);

// State
const state = {
    object: {
        mode: 'point', // 'point' or 'infinity'
        z: -200,
        y: 0,
        angle: 0 // for infinity mode
    },
    rayCount: 10,
    rays: []
};

// --- Initialization ---

function init() {
    // Add default lenses
    system.addLens(100, 0, 50);
    system.addLens(100, 150, 50);
    
    // Initial Render
    update();
    renderLensList();
    
    // Event Listeners
    setupUI();
    setupCanvasInteractions();
}

// --- Core Logic ---

function update() {
    // 1. Generate Rays
    state.rays = generateRays();
    
    // 2. Trace Rays
    state.rays.forEach(ray => system.traceRay(ray));
    
    // 3. Calculate Results
    const results = system.calculateCardinalPoints();
    const imageInfo = system.calculateImage(state.object.z);
    
    // 4. Update UI Results
    updateResultsPanel(results, imageInfo);
    
    // 5. Draw
    draw(imageInfo);
}

function generateRays() {
    const rays = [];
    const count = state.rayCount;
    
    // Find First Lens to target
    if (system.lenses.length === 0) return [];
    
    const firstLens = system.lenses[0]; // Lenses are sorted in traceRay, but let's assume valid order here or sort
    system.sortLenses();
    
    if (state.object.mode === 'point') {
        const zObj = state.object.z;
        const yObj = state.object.y;
        
        // Target the first lens aperture
        // We want to fill the aperture [-h, h]
        // Slope u = (y_lens - y_obj) / (z_lens - z_obj)
        
        const zDist = firstLens.z - zObj;
        // Avoid division by zero if object is exactly at lens (unlikely)
        if (Math.abs(zDist) < 1e-6) return [];
        
        const h = firstLens.h * 0.95; // 95% of aperture to avoid edge issues
        const uMin = (-h - yObj) / zDist;
        const uMax = (h - yObj) / zDist;
        
        for (let i = 0; i < count; i++) {
            const t = count > 1 ? i / (count - 1) : 0.5;
            const u = uMin + (uMax - uMin) * t;
            rays.push(new Ray(zObj, yObj, u));
        }
        
    } else {
        // Infinity Mode
        // Parallel rays
        const angleRad = state.object.angle * (Math.PI / 180);
        const u = Math.tan(angleRad);
        
        // Start rays from left of the screen or left of first lens
        const startZ = firstLens.z - 200; // Arbitrary start
        
        const h = firstLens.h * 0.95;
        for (let i = 0; i < count; i++) {
            const t = count > 1 ? i / (count - 1) : 0.5;
            const y = -h + (2 * h) * t;
            // Adjust y so that at the lens plane it hits the target y
            // y_lens = y_start + u * (z_lens - z_start)
            // We want y_lens to be uniformly distributed
            // So y_start = y_lens - u * dist
            const targetY = -h + (2 * h) * t;
            const startY = targetY - u * (firstLens.z - startZ);
            
            rays.push(new Ray(startZ, startY, u));
        }
    }
    
    return rays;
}

function draw(imageInfo) {
    renderer.draw(); // Grid, Axis, Lenses, Principal Planes
    renderer.drawRays(state.rays);
    
    if (state.object.mode === 'point') {
        renderer.drawObjectPoint(state.object.z, state.object.y);
    }
    
    if (imageInfo && Math.abs(imageInfo.z) < 1e5) {
        renderer.drawImagePoint(imageInfo.z, imageInfo.mag);
    }
}

function updateResultsPanel(results, imageInfo) {
    if (!results) return;
    
    const set = (id, val) => document.getElementById(id).textContent = val;
    const fmt = (n) => n.toFixed(2);
    
    set('res-efl', fmt(results.efl));
    set('res-bfl', fmt(results.bfl));
    
    set('res-mag', imageInfo ? fmt(imageInfo.mag) : '--');
    set('res-img-z', imageInfo ? (Math.abs(imageInfo.z) > 10000 ? 'Inf' : fmt(imageInfo.z)) : '--');
    
    const ppList = document.getElementById('res-pp');
    ppList.innerHTML = `
        <li>H: ${fmt(results.H)}</li>
        <li>H': ${fmt(results.H_prime)}</li>
    `;
}

// --- UI Interaction ---

function setupUI() {
    // Object Controls
    document.getElementById('object-mode').addEventListener('change', (e) => {
        state.object.mode = e.target.value;
        document.getElementById('point-controls').style.display = state.object.mode === 'point' ? 'block' : 'none';
        document.getElementById('infinity-controls').style.display = state.object.mode === 'infinity' ? 'block' : 'none';
        update();
    });
    
    document.getElementById('object-z').addEventListener('input', (e) => {
        state.object.z = parseFloat(e.target.value);
        update();
    });
    document.getElementById('object-y').addEventListener('input', (e) => {
        state.object.y = parseFloat(e.target.value);
        update();
    });
    document.getElementById('object-angle').addEventListener('input', (e) => {
        state.object.angle = parseFloat(e.target.value);
        update();
    });
    
    // Ray Count
    const raySlider = document.getElementById('ray-count');
    raySlider.addEventListener('input', (e) => {
        state.rayCount = parseInt(e.target.value);
        document.getElementById('ray-count-val').textContent = state.rayCount;
        update();
    });
    
    // Lens Controls
    document.getElementById('add-lens-btn').addEventListener('click', () => {
        if (system.lenses.length >= 5) return alert("Max 5 lenses");
        const lastLens = system.lenses[system.lenses.length - 1];
        const newZ = lastLens ? lastLens.z + 50 : 0;
        system.addLens(100, newZ);
        renderLensList();
        update();
    });
}

function renderLensList() {
    const list = document.getElementById('lens-list');
    list.innerHTML = '';
    
    system.lenses.forEach((lens, index) => {
        const item = document.createElement('div');
        item.className = 'lens-item';
        item.innerHTML = `
            <h4>Lens ${index + 1} <button class="remove-lens" data-id="${lens.id}">x</button></h4>
            <label>f: <input type="number" class="lens-f" data-id="${lens.id}" value="${lens.f}"></label>
            <label>z: <input type="number" class="lens-z" data-id="${lens.id}" value="${lens.z}"></label>
        `;
        list.appendChild(item);
    });
    
    // Bind events
    list.querySelectorAll('.remove-lens').forEach(btn => {
        btn.addEventListener('click', (e) => {
            system.removeLens(e.target.dataset.id);
            renderLensList();
            update();
        });
    });
    
    list.querySelectorAll('.lens-f').forEach(inp => {
        inp.addEventListener('input', (e) => {
            const l = system.lenses.find(l => l.id === e.target.dataset.id);
            if (l) {
                l.f = parseFloat(e.target.value);
                update();
            }
        });
    });
    
    list.querySelectorAll('.lens-z').forEach(inp => {
        inp.addEventListener('input', (e) => {
            const l = system.lenses.find(l => l.id === e.target.dataset.id);
            if (l) {
                l.z = parseFloat(e.target.value);
                system.sortLenses(); // Order might change
                update();
            }
        });
    });
}

function updateLensInputs() {
    // Called when dragging lenses to update the text inputs
    const inputsF = document.querySelectorAll('.lens-f');
    const inputsZ = document.querySelectorAll('.lens-z');
    
    // This is a bit inefficient (searching all), but N is small
    inputsZ.forEach(inp => {
        const l = system.lenses.find(l => l.id === inp.dataset.id);
        if (l && document.activeElement !== inp) {
            inp.value = l.z.toFixed(1);
        }
    });
    
    // Update Object inputs too
    const objZ = document.getElementById('object-z');
    const objY = document.getElementById('object-y');
    if (document.activeElement !== objZ) objZ.value = state.object.z.toFixed(1);
    if (document.activeElement !== objY) objY.value = state.object.y.toFixed(1);
}

// --- Canvas Interactions (Drag & Drop) ---

function setupCanvasInteractions() {
    let isDragging = false;
    let dragTarget = null; // { type: 'lens'|'object', obj: reference }
    let lastMouse = { x: 0, y: 0 };
    
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldPos = renderer.fromCanvas(mouseX, mouseY);
        
        // Check hit with Lenses (Zone around lens plane)
        const hitThreshold = 10 / renderer.scale; // 10 pixels wide
        
        // Check Object
        if (state.object.mode === 'point') {
            const distZ = Math.abs(worldPos.z - state.object.z);
            const distY = Math.abs(worldPos.y - state.object.y);
            // Circle hit test
            if (distZ * distZ + distY * distY < (10 / renderer.scale) ** 2) {
                isDragging = true;
                dragTarget = { type: 'object' };
                lastMouse = { x: mouseX, y: mouseY };
                return;
            }
        }
        
        // Check Lenses
        for (const lens of system.lenses) {
            if (Math.abs(worldPos.z - lens.z) < hitThreshold && Math.abs(worldPos.y) < lens.h + 5) {
                isDragging = true;
                dragTarget = { type: 'lens', obj: lens };
                lastMouse = { x: mouseX, y: mouseY };
                return;
            }
        }
        
        // Else Pan (Moving the Viewport)
        isDragging = true;
        dragTarget = { type: 'view' };
        lastMouse = { x: mouseX, y: mouseY };
    });
    
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const dx = mouseX - lastMouse.x;
        const dy = mouseY - lastMouse.y;
        
        if (dragTarget.type === 'view') {
            renderer.offsetX += dx;
            renderer.offsetY += dy;
        } else if (dragTarget.type === 'object') {
            const dWorldZ = dx / renderer.scale;
            const dWorldY = -dy / renderer.scale;
            state.object.z += dWorldZ;
            state.object.y += dWorldY;
            updateLensInputs();
        } else if (dragTarget.type === 'lens') {
            const dWorldZ = dx / renderer.scale;
            dragTarget.obj.z += dWorldZ;
            system.sortLenses(); // Keep them sorted
            updateLensInputs();
        }
        
        lastMouse = { x: mouseX, y: mouseY };
        
        if (dragTarget.type === 'view') {
            renderer.draw(); // Just redraw, no recalc needed
            // Actually draw() calls drawRays which needs state.rays which might be stale if we didn't update().
            // But panning doesn't change physics.
            // But draw() in main.js calls generateRays/trace... no wait, `update()` does.
            // `draw()` in main.js calls renderer.draw().
            // Let's just call `draw(null)` or `renderer.draw()` and re-draw rays.
            // To be safe, let's just call `update()`. It's fast enough.
            update(); 
        } else {
            update();
        }
    });
    
    window.addEventListener('mouseup', () => {
        isDragging = false;
        dragTarget = null;
    });
    
    // Zoom
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomSpeed = 0.1;
        if (e.deltaY < 0) {
            renderer.scale *= (1 + zoomSpeed);
        } else {
            renderer.scale *= (1 - zoomSpeed);
        }
        update();
    });
}

// Start
init();
