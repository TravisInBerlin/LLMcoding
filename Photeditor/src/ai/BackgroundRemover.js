/**
 * BackgroundRemover - AI-powered background removal
 * Uses @imgly/background-removal for browser-based processing
 */

import { removeBackground } from '@imgly/background-removal';

export class BackgroundRemover {
    constructor() {
        this.isProcessing = false;
        this.config = {
            debug: false,
            proxyToWorker: true,
            model: 'medium', // 'small', 'medium', 'large'
        };
    }

    /**
     * Remove background from an image blob
     * @param {Blob} imageBlob - The input image as a Blob
     * @returns {Promise<Blob>} - The processed image with transparent background
     */
    async remove(imageBlob) {
        if (this.isProcessing) {
            throw new Error('Background removal already in progress');
        }

        this.isProcessing = true;

        try {
            console.log('Starting background removal...');

            const result = await removeBackground(imageBlob, this.config);

            console.log('Background removal complete');
            return result;
        } catch (error) {
            console.error('Background removal failed:', error);
            throw error;
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Remove background from an image URL
     * @param {string} imageUrl - The URL of the image
     * @returns {Promise<Blob>} - The processed image with transparent background
     */
    async removeFromUrl(imageUrl) {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        return this.remove(blob);
    }

    /**
     * Remove background from a File object
     * @param {File} file - The input file
     * @returns {Promise<Blob>} - The processed image with transparent background
     */
    async removeFromFile(file) {
        return this.remove(file);
    }

    /**
     * Check if background removal is currently processing
     */
    get busy() {
        return this.isProcessing;
    }

    /**
     * Set the model quality
     * @param {'small' | 'medium' | 'large'} quality
     */
    setQuality(quality) {
        this.config.model = quality;
    }
}
