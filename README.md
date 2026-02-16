# Interactive Optics Lab

## Overview
The **Interactive Optics Lab** is a web-based simulation tool for visualizing and analyzing optical systems composed of thin lenses. It uses Ray Transfer Matrix (ABCD) analysis to compute system properties such as effective focal length, principal planes, and image formation.

## Usage Instructions

### Getting Started
Open `sim/index.html` in a web browser to launch the simulation.

### Controls

#### Object Configuration
The object represents the source of light rays entering the system.
- **Mode Selection**: Choose between:
  - **Point Source**: A single point emitting rays.
    - **Position (Z)**: Axial position along the optical axis.
    - **Height (Y)**: Vertical distance from the optical axis.
  - **Infinity (Parallel)**: Represents an object at infinity, producing parallel rays.
    - **Angle (deg)**: Angle of incidence for the parallel rays.

#### Lens Management
- **Add Lens**: Click the `+` button next to "Lenses" in the sidebar to add a new lens.
- **Remove Lens**: Click the `x` button next to a specific lens in the list.
- **Edit Properties**:
  - **f (Focal Length)**: Enter a value in the input field. Positive for converging, negative for diverging.
  - **z (Position)**: Enter the axial position of the lens.

#### Viewport Interaction
- **Pan**: Click and drag on the empty background to move the view.
- **Zoom**: Use the scroll wheel to zoom in and out.
- **Drag Elements**:
  - **Lenses**: Click and drag a lens horizontally to change its Z position.
  - **Object (Point Mode)**: Click and drag the object point (blue dot) to move it freely in Z and Y.

#### Visualization
- **Ray Count**: Adjust the slider to change the number of rays traced through the system.

## Technical Details & Calculations

The simulation uses **Ray Transfer Matrix (ABCD Matrix)** analysis to model the optical system.

### The ABCD Matrix
An optical system is represented by a $2 \times 2$ matrix $M$ that relates the ray height $y$ and angle $u$ (slope) at the output plane to the input plane:

$$
\begin{pmatrix} y_{out} \\ u_{out} \end{pmatrix} = \begin{pmatrix} A & B \\ C & D \end{pmatrix} \begin{pmatrix} y_{in} \\ u_{in} \end{pmatrix}
$$

The system matrix $M_{sys}$ is constructed by multiplying the matrices of individual components in reverse order (from right to left). For a system with $N$ lenses:

$$
M_{sys} = R_N \cdot T_{N-1} \dots R_2 \cdot T_1 \cdot R_1
$$

Where:
- **Refraction Matrix ($R$)** for a thin lens with focal length $f$:
  $$
  R = \begin{pmatrix} 1 & 0 \\ -\frac{1}{f} & 1 \end{pmatrix}
  $$
- **Translation Matrix ($T$)** for a distance $d$ between components:
  $$
  T = \begin{pmatrix} 1 & d \\ 0 & 1 \end{pmatrix}
  $$

### Calculated Properties

#### Cardinal Points
- **System Power ($P$)**: $P = -C$
- **Effective Focal Length (EFL)**: $f_{eff} = \frac{1}{P} = -\frac{1}{C}$
- **Front Principal Plane ($H$)**: Distance from the **first lens** surface.
  $$
  d_H = \frac{D - 1}{C}
  $$
  Position $z_H = z_{first} + d_H$.
- **Back Principal Plane ($H'$)**: Distance from the **last lens** surface.
  $$
  d_{H'} = \frac{1 - A}{C}
  $$
  Position $z_{H'} = z_{last} + d_{H'}$.
- **Back Focal Length (BFL)**: Distance from the **last lens** to the back focal point.
  $$
  BFL = z_{H'} + f_{eff} - z_{last}
  $$

#### Image Formation
For an object at distance $d_o$ from the first lens ($d_o = z_{first} - z_{object}$):

- **Image Distance ($d_i$)**: Distance from the **last lens** to the image plane.
  $$
  d_i = -\frac{A d_o + B}{C d_o + D}
  $$
  Image Position $z_{image} = z_{last} + d_i$.

- **Magnification ($m$)**:
  $$
  m = \frac{1}{C d_o + D}
  $$
  (Note: In the code, this is calculated as $m = A + d_i C$, which is mathematically equivalent).

- **Infinite Object**:
  If the object is at infinity, the image forms at the back focal plane ($d_i = -A/C$).
