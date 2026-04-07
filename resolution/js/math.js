// Math utilities for optics calculations
const MathUtils = {
    /**
     * Zeroth-order Bessel function of the first kind, J0(x)
     * Using polynomial approximation from Abramowitz and Stegun.
     */
    j0: function(x) {
        let ax = Math.abs(x);
        if (ax < 3.0) {
            let y = x * x / 9.0;
            return 1.0 + y * (-2.2499997 + y * (1.2656208 + y * (-0.3163866 + y * (0.0444479 + y * (-0.0039444 + y * 0.0002100)))));
        } else {
            let y = 3.0 / ax;
            let f0 = 0.79788456 + y * (-0.00000077 + y * (-0.00552740 + y * (-0.00009512 + y * (0.00137237 + y * (-0.00072805 + y * 0.00014476)))));
            let theta0 = x - 0.78539816 + y * (-0.04166397 + y * (-0.00003954 + y * (0.00262573 + y * (-0.00054125 + y * (-0.00029333 + y * 0.00013558)))));
            return Math.sqrt(1.0 / ax) * f0 * Math.cos(theta0);
        }
    },

    /**
     * First-order Bessel function of the first kind, J1(x)
     */
    j1: function(x) {
        let ax = Math.abs(x);
        let y, ans1, ans2;
        if (ax < 3.0) {
            y = x * x / 9.0;
            ans1 = x * (0.5 + y * (-0.56249985 + y * (0.21093573 + y * (-0.03954289 + y * (0.00443319 + y * (-0.00031761 + y * 0.00001109))))));
            return ans1;
        } else {
            y = 3.0 / ax;
            let f1 = 0.79788456 + y * (0.00000156 + y * (0.01659667 + y * (0.00017105 + y * (-0.00249511 + y * (0.00113653 + y * (-0.00020033))))));
            let theta1 = ax - 2.35619449 + y * (0.12499612 + y * (0.00005650 + y * (-0.00637879 + y * (0.00074348 + y * (0.00079824 + y * (-0.00029166))))));
            ans2 = Math.sqrt(1.0 / ax) * f1 * Math.cos(theta1);
            return x < 0.0 ? -ans2 : ans2;
        }
    },

    /**
     * Calculates the intensity of the Point Spread Function (PSF) at a given radial distance.
     * @param {number} r - Radial distance in the image plane (e.g. in micrometers)
     * @param {number} lambda - Wavelength (e.g. in micrometers)
     * @param {number} NA - Numerical Aperture
     * @param {string} type - 'uniform', 'annular', or 'gaussian'
     * @param {object} params - { epsilon: obstruction ratio, sigma: beam width }
     * @returns {number} Normalized intensity [0, 1]
     */
    calculatePSFIntensity: function(r, lambda, NA, type, params) {
        // Spatial frequency max
        let k = (2 * Math.PI) / lambda;
        let v = k * NA * r; // Optical coordinate

        if (v === 0) return 1.0; // Peak intensity at center

        let intensity = 0;

        if (type === 'uniform') {
            // Airy disk: I(v) = (2 * J1(v) / v)^2
            let val = 2 * this.j1(v) / v;
            intensity = val * val;
        } else if (type === 'annular') {
            // Annular aperture with obstruction ratio epsilon (0 < e < 1)
            let e = params.epsilon || 0.5;
            let val = (2 * (this.j1(v) - e * this.j1(e * v))) / ((1 - e * e) * v);
            intensity = val * val;
        } else if (type === 'gaussian') {
            // Gaussian pupil: Numerical Hankel transform required for accurate arbitrary sigma,
            // but we can approximate or use a discrete numerical integration.
            // For a Gaussian pupil P(rho) = exp(-rho^2 / sigma^2) where rho is normalized radius [0,1]

            let sigma = params.sigma || 0.5;

            // Numerical integration (Simpson's rule or basic sum) over the pupil radius rho
            let sum = 0;
            let steps = 100;
            let drho = 1.0 / steps;

            for (let i = 0; i < steps; i++) {
                let rho = (i + 0.5) * drho;
                let pupil = Math.exp(-(rho * rho) / (sigma * sigma));
                sum += rho * pupil * this.j0(v * rho);
            }
            sum *= drho;

            // Normalize by center intensity (v=0)
            let sum0 = 0;
            for (let i = 0; i < steps; i++) {
                let rho = (i + 0.5) * drho;
                let pupil = Math.exp(-(rho * rho) / (sigma * sigma));
                sum0 += rho * pupil; // J0(0) = 1
            }
            sum0 *= drho;

            let val = sum / sum0;
            intensity = val * val;
        }

        return intensity;
    },

    /**
     * Generates a 2D spatial kernel representing the PSF.
     * @param {number} size - Dimension of the kernel (size x size), should be odd.
     * @param {number} physicalPixelSize - Real world size of one kernel pixel in micrometers.
     * @param {number} lambda - Wavelength in micrometers.
     * @param {number} NA - Numerical aperture.
     * @param {string} type - Apodization type.
     * @param {object} params - Apodization params.
     * @returns {Float32Array} 1D array of length size*size containing normalized kernel values.
     */
    generatePSFKernel: function(size, physicalPixelSize, lambda, NA, type, params) {
        let kernel = new Float32Array(size * size);
        let center = Math.floor(size / 2);
        let sum = 0;

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // Radial distance in pixels from center
                let dx = x - center;
                let dy = y - center;
                let r_pixels = Math.sqrt(dx * dx + dy * dy);

                // Radial distance in physical units (micrometers)
                let r_physical = r_pixels * physicalPixelSize;

                let intensity = this.calculatePSFIntensity(r_physical, lambda, NA, type, params);
                kernel[y * size + x] = intensity;
                sum += intensity;
            }
        }

        // Normalize kernel so it sums to 1 (energy conservation)
        if (sum > 0) {
            for (let i = 0; i < kernel.length; i++) {
                kernel[i] /= sum;
            }
        }

        return kernel;
    }
};
