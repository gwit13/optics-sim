// optics.js

class Ray {
    constructor(z, y, u) {
        this.z = z; // Axial position
        this.y = y; // Height
        this.u = u; // Angle (slope)
        this.path = [{z: z, y: y}]; // Store the path for rendering
        this.active = true; // Still propagating?
    }

    propagate(newZ) {
        if (!this.active) return;
        
        const d = newZ - this.z;
        this.y += this.u * d;
        this.z = newZ;
        this.path.push({z: this.z, y: this.y});
    }

    refract(f) {
        if (!this.active) return;
        // Thin lens equation: slope changes by -y/f
        this.u -= this.y / f;
    }

    stop() {
        this.active = false;
    }
}

class Lens {
    constructor(f, z, h) {
        this.f = parseFloat(f); // Focal length
        this.z = parseFloat(z); // Position
        this.h = parseFloat(h); // Height (radius of aperture)
        this.id = Math.random().toString(36).substr(2, 9);
    }
}

class OpticalSystem {
    constructor() {
        this.lenses = [];
    }

    addLens(f, z, h = 50) {
        const lens = new Lens(f, z, h);
        this.lenses.push(lens);
        this.sortLenses();
        return lens;
    }

    removeLens(id) {
        this.lenses = this.lenses.filter(l => l.id !== id);
    }

    sortLenses() {
        this.lenses.sort((a, b) => a.z - b.z);
    }

    // Trace a single ray through the entire system
    traceRay(ray) {
        // Sort lenses just in case
        this.sortLenses();

        // Propagate to each lens in order
        for (const lens of this.lenses) {
            // If ray starts after this lens, skip it
            if (ray.z > lens.z + 1e-9) continue;

            // Propagate to lens position
            ray.propagate(lens.z);

            // Check if ray hits the lens aperture
            if (Math.abs(ray.y) > lens.h) {
                ray.stop();
                break;
            }

            // Refract
            ray.refract(lens.f);
        }

        // Propagate a bit further to visualize the output
        if (ray.active) {
            // Default extension if no image is found or just to show path
            // We'll let the renderer decide or just push it far out
            // For now, push it out by 1000 units or until it hits axis?
            // Let's just push it a fixed distance for visualization
            const lastLensZ = this.lenses.length > 0 ? this.lenses[this.lenses.length-1].z : ray.z;
            ray.propagate(lastLensZ + 1000); 
        }
    }

    // Calculate System Matrix (ABCD) from first lens to last lens
    calculateSystemMatrix() {
        if (this.lenses.length === 0) return null;

        // Identity matrix
        let A = 1, B = 0, C = 0, D = 1;

        // Iterate through lenses
        for (let i = 0; i < this.lenses.length; i++) {
            const lens = this.lenses[i];
            
            // Transfer from previous element
            if (i > 0) {
                const d = lens.z - this.lenses[i-1].z;
                // Multiply by Translation Matrix: [1 d; 0 1]
                const newA = A + d * C;
                const newB = B + d * D;
                const newC = C;
                const newD = D;
                A = newA; B = newB; C = newC; D = newD;
            }

            // Multiply by Refraction Matrix: [1 0; -1/f 1]
            const power = -1 / lens.f;
            const newC_ref = power * A + C;
            const newD_ref = power * B + D;
            // A and B remain unchanged by refraction matrix left-multiplication rows
            // Wait: [[1, 0], [P, 1]] * [[A, B], [C, D]]
            // Top row: 1*A + 0*C = A. 1*B + 0*D = B. Correct.
            // Bottom row: P*A + 1*C. P*B + 1*D. Correct.
            C = newC_ref; D = newD_ref;
        }

        return { A, B, C, D };
    }

    calculateCardinalPoints() {
        const matrix = this.calculateSystemMatrix();
        if (!matrix) return null;
        
        const { A, B, C, D } = matrix;
        
        // System Power = -C
        const power = -C;
        
        // Effective Focal Length (EFL) = 1 / Power
        const efl = (Math.abs(power) < 1e-10) ? Infinity : 1 / power;

        const firstLensZ = this.lenses[0].z;
        const lastLensZ = this.lenses[this.lenses.length - 1].z;

        // Front Principal Plane (H) relative to First Lens
        // d_H = (D - 1) / C
        const dH = (Math.abs(C) < 1e-10) ? 0 : (D - 1) / C;
        const H = firstLensZ + dH;

        // Back Principal Plane (H') relative to Last Lens
        // d_H' = (1 - A) / C
        const dH_prime = (Math.abs(C) < 1e-10) ? 0 : (1 - A) / C;
        const H_prime = lastLensZ + dH_prime;

        // Back Focal Length (BFL)
        // F' position = H' + EFL.
        const F_prime = H_prime + efl;
        const bfl = F_prime - lastLensZ;

        return { efl, bfl, H, H_prime, F_prime };
    }

    // Calculate Image position for a given Object Z
    calculateImage(objectZ) {
        if (this.lenses.length === 0) return null;

        const matrix = this.calculateSystemMatrix();
        if (!matrix) return null;
        
        const firstLensZ = this.lenses[0].z;
        const lastLensZ = this.lenses[this.lenses.length - 1].z;
        const d_o = firstLensZ - objectZ; // Distance from object to first lens
        
        const { A, B, C, D } = matrix;
        
        const numerator = A * d_o + B;
        const denominator = C * d_o + D;
        
        // If denominator is 0, image is at infinity
        if (Math.abs(denominator) < 1e-10) {
            return {
                z: Infinity,
                mag: Infinity,
                isVirtual: false
            };
        }
        
        const d_i = -numerator / denominator;
        const imageZ = lastLensZ + d_i;
        
        // Magnification m
        // For finite conjugates: m = 1 / (C * d_o + D) ?
        // Let's derive m from matrix M_total.
        // M_total = [[m, 0], [?, 1/m]] for conjugate planes.
        // M_total top-left element is A_total.
        // A_total = A + d_i * C.
        const mag = A + d_i * C;
        
        return {
            z: imageZ,
            mag: mag,
            isVirtual: d_i < 0
        };
    }
}
