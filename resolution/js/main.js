class ImageProcessor {
    constructor() {
        this.originalImage = null;
        this.maxRes = 512; // Cap processing resolution to maintain interactivity
    }

    /**
     * Loads an image file onto a hidden canvas and returns its data.
     */
    loadImage(file, callback) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Scale down if necessary
                if (width > this.maxRes || height > this.maxRes) {
                    if (width > height) {
                        height = Math.round((height / width) * this.maxRes);
                        width = this.maxRes;
                    } else {
                        width = Math.round((width / height) * this.maxRes);
                        height = this.maxRes;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                this.originalImage = {
                    width: width,
                    height: height,
                    imageData: ctx.getImageData(0, 0, width, height),
                    canvas: canvas
                };
                callback(this.originalImage);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    /**
     * Applies a 2D spatial convolution kernel to the image data.
     */
    convolve(kernel, kernelSize) {
        if (!this.originalImage) return null;

        const width = this.originalImage.width;
        const height = this.originalImage.height;
        const srcData = this.originalImage.imageData.data;

        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = width;
        outputCanvas.height = height;
        const ctx = outputCanvas.getContext('2d');
        const outputImageData = ctx.createImageData(width, height);
        const dstData = outputImageData.data;

        const half = Math.floor(kernelSize / 2);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dstOff = (y * width + x) * 4;
                let r = 0, g = 0, b = 0;

                for (let cy = 0; cy < kernelSize; cy++) {
                    for (let cx = 0; cx < kernelSize; cx++) {
                        const scy = y + cy - half;
                        const scx = x + cx - half;

                        // Clamp to edge
                        const cY = Math.min(Math.max(scy, 0), height - 1);
                        const cX = Math.min(Math.max(scx, 0), width - 1);

                        const srcOff = (cY * width + cX) * 4;
                        const wt = kernel[cy * kernelSize + cx];

                        r += srcData[srcOff] * wt;
                        g += srcData[srcOff + 1] * wt;
                        b += srcData[srcOff + 2] * wt;
                    }
                }

                dstData[dstOff] = r;
                dstData[dstOff + 1] = g;
                dstData[dstOff + 2] = b;
                dstData[dstOff + 3] = 255; // Alpha opaque
            }
        }

        return outputImageData;
    }

    /**
     * Simulates sensor pixelation.
     * Downsamples the blurred image by a given factor, then nearest-neighbor upscales it back.
     */
    pixelate(imageData, pixelSizeMicrons, systemSimulatedFOV) {
        const width = imageData.width;
        const height = imageData.height;

        // Calculate how many logical sensor pixels fit across the width
        const totalMicrons = systemSimulatedFOV; // The physical width the image represents
        const numSensorPixelsWidth = totalMicrons / pixelSizeMicrons;

        // Block size in simulation image pixels
        let blockSize = Math.max(1, Math.round(width / numSensorPixelsWidth));

        if (blockSize <= 1) {
            return imageData; // No visible pixelation
        }

        const srcData = imageData.data;
        const outputImageData = new ImageData(width, height);
        const dstData = outputImageData.data;

        for (let y = 0; y < height; y += blockSize) {
            for (let x = 0; x < width; x += blockSize) {

                // Average color within the block
                let r = 0, g = 0, b = 0, count = 0;

                for (let by = 0; by < blockSize; by++) {
                    for (let bx = 0; bx < blockSize; bx++) {
                        let cy = y + by;
                        let cx = x + bx;
                        if (cy < height && cx < width) {
                            let off = (cy * width + cx) * 4;
                            r += srcData[off];
                            g += srcData[off + 1];
                            b += srcData[off + 2];
                            count++;
                        }
                    }
                }

                r = Math.round(r / count);
                g = Math.round(g / count);
                b = Math.round(b / count);

                // Write averaged color back to the block
                for (let by = 0; by < blockSize; by++) {
                    for (let bx = 0; bx < blockSize; bx++) {
                        let cy = y + by;
                        let cx = x + bx;
                        if (cy < height && cx < width) {
                            let off = (cy * width + cx) * 4;
                            dstData[off] = r;
                            dstData[off + 1] = g;
                            dstData[off + 2] = b;
                            dstData[off + 3] = 255;
                        }
                    }
                }
            }
        }
        return outputImageData;
    }
}

class ResolutionDemo {
    constructor() {
        this.processor = new ImageProcessor();
        this.systemFOV = 20.0; // The virtual image represents 20 micrometers across

        // UI Elements
        this.elements = {
            upload: document.getElementById('image-upload'),
            wavelength: document.getElementById('wavelength'),
            wavelengthVal: document.getElementById('wavelength-val'),
            na: document.getElementById('na'),
            naVal: document.getElementById('na-val'),
            apodizationType: document.getElementById('apodization-type'),
            epsilon: document.getElementById('epsilon'),
            epsilonVal: document.getElementById('epsilon-val'),
            sigma: document.getElementById('sigma'),
            sigmaVal: document.getElementById('sigma-val'),
            pixelSize: document.getElementById('pixel-size'),
            pixelSizeVal: document.getElementById('pixel-size-val'),
            simulateBtn: document.getElementById('simulate-btn'),

            // Containers
            annularControls: document.getElementById('annular-controls'),
            gaussianControls: document.getElementById('gaussian-controls'),

            // Results
            resRayleigh: document.getElementById('res-rayleigh'),
            resFwhm: document.getElementById('res-fwhm'),

            // Canvases
            origCanvas: document.getElementById('original-canvas'),
            psfCanvas: document.getElementById('psf-canvas'),
            simCanvas: document.getElementById('simulated-canvas')
        };

        this.bindEvents();
        this.drawDefaultState();
    }

    bindEvents() {
        // Sliders updates
        this.elements.wavelength.addEventListener('input', (e) => {
            this.elements.wavelengthVal.innerText = `${e.target.value} nm`;
        });

        this.elements.na.addEventListener('input', (e) => {
            this.elements.naVal.innerText = e.target.value;
        });

        this.elements.pixelSize.addEventListener('input', (e) => {
            this.elements.pixelSizeVal.innerHTML = `${e.target.value} &mu;m`;
        });

        this.elements.epsilon.addEventListener('input', (e) => {
            this.elements.epsilonVal.innerText = e.target.value;
        });

        this.elements.sigma.addEventListener('input', (e) => {
            this.elements.sigmaVal.innerText = e.target.value;
        });

        // Apodization toggle
        this.elements.apodizationType.addEventListener('change', (e) => {
            this.elements.annularControls.style.display = 'none';
            this.elements.gaussianControls.style.display = 'none';
            if (e.target.value === 'annular') {
                this.elements.annularControls.style.display = 'block';
            } else if (e.target.value === 'gaussian') {
                this.elements.gaussianControls.style.display = 'block';
            }
        });

        // File upload
        this.elements.upload.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.processor.loadImage(e.target.files[0], (imgObj) => {
                    this.drawOriginalImage(imgObj);
                });
            }
        });

        // Simulate
        this.elements.simulateBtn.addEventListener('click', () => {
            this.simulate();
        });
    }

    drawDefaultState() {
        // Draw some placeholder content on the original canvas
        const ctx = this.elements.origCanvas.getContext('2d');
        this.elements.origCanvas.width = 256;
        this.elements.origCanvas.height = 256;
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#fff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Please upload an image', 128, 128);
    }

    drawOriginalImage(imgObj) {
        this.elements.origCanvas.width = imgObj.width;
        this.elements.origCanvas.height = imgObj.height;
        const ctx = this.elements.origCanvas.getContext('2d');
        ctx.drawImage(imgObj.canvas, 0, 0);
    }

    renderPSFCanvas(kernel, size) {
        // Scale kernel up for visualization
        const visSize = 256;
        this.elements.psfCanvas.width = visSize;
        this.elements.psfCanvas.height = visSize;
        const ctx = this.elements.psfCanvas.getContext('2d');
        const imgData = ctx.createImageData(visSize, visSize);

        // Find max value in kernel to normalize visualization
        let maxVal = 0;
        for (let i = 0; i < kernel.length; i++) {
            if (kernel[i] > maxVal) maxVal = kernel[i];
        }

        // Nearest neighbor scaling to draw the small kernel into the larger canvas
        for (let y = 0; y < visSize; y++) {
            for (let x = 0; x < visSize; x++) {
                let ky = Math.floor((y / visSize) * size);
                let kx = Math.floor((x / visSize) * size);
                let val = kernel[ky * size + kx];

                // Gamma correction for better visual contrast on weak side-lobes
                let v = Math.pow(val / maxVal, 0.5) * 255;

                let off = (y * visSize + x) * 4;
                // Use a colormap-like approach: strong=white, weak=dark blue
                imgData.data[off] = v;     // R
                imgData.data[off + 1] = v; // G
                imgData.data[off + 2] = v > 0 ? 255 * Math.pow(val/maxVal, 0.2) : 0; // B
                imgData.data[off + 3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }

    simulate() {
        if (!this.processor.originalImage) {
            alert("Please upload an image first.");
            return;
        }

        const btn = this.elements.simulateBtn;
        btn.innerText = "Simulating...";
        btn.disabled = true;

        // Use setTimeout to allow UI to update to "Simulating..."
        setTimeout(() => {
            // 1. Gather Parameters
            const lambda_nm = parseFloat(this.elements.wavelength.value);
            const lambda_um = lambda_nm / 1000.0;
            const NA = parseFloat(this.elements.na.value);
            const type = this.elements.apodizationType.value;
            const params = {
                epsilon: parseFloat(this.elements.epsilon.value),
                sigma: parseFloat(this.elements.sigma.value)
            };
            const pixelSize_um = parseFloat(this.elements.pixelSize.value);

            // 2. Compute Rayleigh Limit (d = 0.61 * lambda / NA)
            const rayleigh = 0.61 * lambda_um / NA;
            this.elements.resRayleigh.innerText = rayleigh.toFixed(3);

            // 3. Generate Kernel
            // Map image pixels to physical size
            const physicalPixelSize = this.systemFOV / this.processor.originalImage.width;

            // Determine kernel size in pixels based on the physical size of the PSF (pad to ensure we capture lobes)
            // A kernel capturing roughly 4 times the Rayleigh limit radius should be sufficient
            let requiredPhysicalRadius = rayleigh * 4.0;
            let kernelRadiusPixels = Math.ceil(requiredPhysicalRadius / physicalPixelSize);

            // Hard cap to avoid browser hang
            if (kernelRadiusPixels > 30) kernelRadiusPixels = 30;

            let kernelSize = kernelRadiusPixels * 2 + 1; // Must be odd

            const kernel = MathUtils.generatePSFKernel(kernelSize, physicalPixelSize, lambda_um, NA, type, params);

            // FWHM estimation (roughly related to rayleigh limit, we'll just display rayleigh * ~0.84 for Airy disk)
            // A more exact FWHM would require analyzing the specific kernel generated.
            this.elements.resFwhm.innerText = (rayleigh * 0.84).toFixed(3);

            // 4. Render PSF Visualization
            this.renderPSFCanvas(kernel, kernelSize);

            // 5. Apply Optical Convolution (Blur)
            const blurredImageData = this.processor.convolve(kernel, kernelSize);

            // 6. Apply Sensor Pixelation
            const finalImageData = this.processor.pixelate(blurredImageData, pixelSize_um, this.systemFOV);

            // 7. Render Result
            this.elements.simCanvas.width = finalImageData.width;
            this.elements.simCanvas.height = finalImageData.height;
            const ctx = this.elements.simCanvas.getContext('2d');
            ctx.putImageData(finalImageData, 0, 0);

            // Restore UI
            btn.innerText = "Simulate / Recalculate";
            btn.disabled = false;
        }, 50);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    console.log("Resolution demo initialized");
    window.demo = new ResolutionDemo();
});