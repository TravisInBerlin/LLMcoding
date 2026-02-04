/**
 * ImageEditor - Core image manipulation functionality
 * Handles all canvas-based image operations
 */

export class ImageEditor {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    /**
     * Convert an Image element to a canvas for manipulation
     */
    imageToCanvas(img) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return canvas;
    }

    /**
     * Apply all adjustments and filters to an image
     */
    applyAdjustments(sourceCanvas, adjustments, filter = 'none') {
        const canvas = document.createElement('canvas');
        canvas.width = sourceCanvas.width;
        canvas.height = sourceCanvas.height;
        const ctx = canvas.getContext('2d');

        // Draw original image
        ctx.drawImage(sourceCanvas, 0, 0);

        // Get image data for pixel manipulation
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Apply adjustments pixel by pixel
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            // Exposure (applied first as it affects the base values)
            if (adjustments.exposure !== 0) {
                const factor = 1 + adjustments.exposure / 100;
                r *= factor;
                g *= factor;
                b *= factor;
            }

            // Brightness
            if (adjustments.brightness !== 0) {
                const adjustment = adjustments.brightness * 2.55;
                r += adjustment;
                g += adjustment;
                b += adjustment;
            }

            // Contrast
            if (adjustments.contrast !== 0) {
                const factor = (259 * (adjustments.contrast + 255)) / (255 * (259 - adjustments.contrast));
                r = factor * (r - 128) + 128;
                g = factor * (g - 128) + 128;
                b = factor * (b - 128) + 128;
            }

            // Temperature (warm/cool)
            if (adjustments.temperature !== 0) {
                const temp = adjustments.temperature * 0.5;
                r += temp;
                b -= temp;
            }

            // Highlights (affect bright areas more)
            if (adjustments.highlights !== 0) {
                const luminance = (r + g + b) / 3;
                const highlightFactor = Math.max(0, (luminance - 128) / 127);
                const adjustment = adjustments.highlights * highlightFactor * 0.5;
                r += adjustment;
                g += adjustment;
                b += adjustment;
            }

            // Shadows (affect dark areas more)
            if (adjustments.shadows !== 0) {
                const luminance = (r + g + b) / 3;
                const shadowFactor = Math.max(0, (128 - luminance) / 128);
                const adjustment = adjustments.shadows * shadowFactor * 0.5;
                r += adjustment;
                g += adjustment;
                b += adjustment;
            }

            // Saturation
            if (adjustments.saturation !== 0) {
                const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
                const factor = 1 + adjustments.saturation / 100;
                r = gray + factor * (r - gray);
                g = gray + factor * (g - gray);
                b = gray + factor * (b - gray);
            }

            // Clamp values
            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
        }

        // Apply sharpness using convolution (simplified unsharp mask)
        if (adjustments.sharpness > 0) {
            this.applySharpness(imageData, adjustments.sharpness / 100);
        }

        ctx.putImageData(imageData, 0, 0);

        // Apply filter
        if (filter !== 'none') {
            this.applyFilter(ctx, canvas.width, canvas.height, filter);
        }

        return canvas;
    }

    /**
     * Apply sharpness using unsharp mask technique
     */
    applySharpness(imageData, amount) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        // Create a copy of the original data
        const original = new Uint8ClampedArray(data);

        // Simple 3x3 sharpen kernel
        const kernel = [
            0, -amount, 0,
            -amount, 1 + 4 * amount, -amount,
            0, -amount, 0
        ];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                            sum += original[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
                        }
                    }
                    const idx = (y * width + x) * 4 + c;
                    data[idx] = Math.max(0, Math.min(255, sum));
                }
            }
        }
    }

    /**
     * Apply a preset filter to the canvas
     */
    applyFilter(ctx, width, height, filter) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        switch (filter) {
            case 'vintage':
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = Math.min(255, data[i] * 1.1 + 20);     // R
                    data[i + 1] = Math.min(255, data[i + 1] * 0.9);  // G
                    data[i + 2] = Math.min(255, data[i + 2] * 0.8);  // B
                }
                break;

            case 'bw':
                for (let i = 0; i < data.length; i += 4) {
                    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                    data[i] = data[i + 1] = data[i + 2] = gray;
                }
                break;

            case 'sepia':
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
                    data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
                    data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
                }
                break;

            case 'vibrant':
                for (let i = 0; i < data.length; i += 4) {
                    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    data[i] = Math.min(255, gray + (data[i] - gray) * 1.5);
                    data[i + 1] = Math.min(255, gray + (data[i + 1] - gray) * 1.5);
                    data[i + 2] = Math.min(255, gray + (data[i + 2] - gray) * 1.5);
                }
                break;

            case 'warm':
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = Math.min(255, data[i] * 1.1);      // More red
                    data[i + 1] = Math.min(255, data[i + 1] * 1.05); // Slightly more green
                    data[i + 2] = Math.max(0, data[i + 2] * 0.9);  // Less blue
                }
                break;

            case 'cool':
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = Math.max(0, data[i] * 0.9);        // Less red
                    data[i + 1] = Math.min(255, data[i + 1] * 1.05); // Slightly more green
                    data[i + 2] = Math.min(255, data[i + 2] * 1.1);  // More blue
                }
                break;

            case 'dramatic':
                for (let i = 0; i < data.length; i += 4) {
                    // High contrast + slight desaturation
                    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                    const factor = 1.3;
                    data[i] = Math.max(0, Math.min(255, factor * (data[i] * 0.9 + gray * 0.1 - 128) + 128));
                    data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] * 0.9 + gray * 0.1 - 128) + 128));
                    data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] * 0.9 + gray * 0.1 - 128) + 128));
                }
                break;

            case 'fade':
                for (let i = 0; i < data.length; i += 4) {
                    // Lifted blacks, reduced contrast
                    data[i] = Math.min(255, data[i] * 0.85 + 30);
                    data[i + 1] = Math.min(255, data[i + 1] * 0.85 + 30);
                    data[i + 2] = Math.min(255, data[i + 2] * 0.85 + 30);
                }
                break;

            case 'noir':
                for (let i = 0; i < data.length; i += 4) {
                    // B&W with high contrast and crushed blacks
                    let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                    gray = Math.max(0, Math.min(255, 1.4 * (gray - 128) + 128));
                    if (gray < 40) gray *= 0.5;
                    data[i] = data[i + 1] = data[i + 2] = gray;
                }
                break;
        }

        ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Rotate the canvas by degrees
     */
    rotate(sourceCanvas, degrees) {
        const radians = degrees * Math.PI / 180;
        const sin = Math.abs(Math.sin(radians));
        const cos = Math.abs(Math.cos(radians));

        const newWidth = sourceCanvas.width * cos + sourceCanvas.height * sin;
        const newHeight = sourceCanvas.width * sin + sourceCanvas.height * cos;

        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');

        ctx.translate(newWidth / 2, newHeight / 2);
        ctx.rotate(radians);
        ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);

        return canvas;
    }

    /**
     * Flip the canvas horizontally or vertically
     */
    flip(sourceCanvas, direction) {
        const canvas = document.createElement('canvas');
        canvas.width = sourceCanvas.width;
        canvas.height = sourceCanvas.height;
        const ctx = canvas.getContext('2d');

        if (direction === 'horizontal') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        } else {
            ctx.translate(0, canvas.height);
            ctx.scale(1, -1);
        }

        ctx.drawImage(sourceCanvas, 0, 0);
        return canvas;
    }

    /**
     * Crop the canvas to specified dimensions
     */
    crop(sourceCanvas, x, y, width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(
            sourceCanvas,
            Math.round(x), Math.round(y), Math.round(width), Math.round(height),
            0, 0, canvas.width, canvas.height
        );

        return canvas;
    }
}
