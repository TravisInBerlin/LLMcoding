/**
 * Filters - Preset filter definitions
 * Contains filter configurations for quick application
 */

export class Filters {
    constructor() {
        this.presets = {
            none: {
                name: 'Original',
                adjustments: {}
            },
            vintage: {
                name: 'Vintage',
                adjustments: {
                    saturation: -20,
                    contrast: 10,
                    temperature: 20
                }
            },
            bw: {
                name: 'Black & White',
                adjustments: {
                    saturation: -100,
                    contrast: 10
                }
            },
            sepia: {
                name: 'Sepia',
                adjustments: {
                    saturation: -50,
                    temperature: 40
                }
            },
            vibrant: {
                name: 'Vibrant',
                adjustments: {
                    saturation: 40,
                    contrast: 15
                }
            },
            warm: {
                name: 'Warm',
                adjustments: {
                    temperature: 30,
                    saturation: 10
                }
            },
            cool: {
                name: 'Cool',
                adjustments: {
                    temperature: -30,
                    saturation: 5
                }
            },
            dramatic: {
                name: 'Dramatic',
                adjustments: {
                    contrast: 40,
                    saturation: -10,
                    shadows: -20
                }
            },
            fade: {
                name: 'Fade',
                adjustments: {
                    contrast: -20,
                    brightness: 10,
                    saturation: -15
                }
            },
            noir: {
                name: 'Noir',
                adjustments: {
                    saturation: -100,
                    contrast: 50,
                    shadows: -30
                }
            }
        };
    }

    /**
     * Get a filter preset by name
     */
    get(name) {
        return this.presets[name] || this.presets.none;
    }

    /**
     * Get all available filter names
     */
    getAll() {
        return Object.keys(this.presets);
    }

    /**
     * Apply filter adjustments to existing adjustments
     */
    applyToAdjustments(filterName, currentAdjustments) {
        const filter = this.get(filterName);
        return {
            ...currentAdjustments,
            ...filter.adjustments
        };
    }
}
