/**
 * HistoryManager - Undo/Redo functionality
 * Manages a stack of image states for history navigation
 */

export class HistoryManager {
    constructor(maxSize = 20) {
        this.states = [];
        this.currentIndex = -1;
        this.maxSize = maxSize;
    }

    /**
     * Push a new state to history
     * Removes any redo states when pushing new state
     */
    push(state) {
        // Remove any states after current index (redo states)
        this.states = this.states.slice(0, this.currentIndex + 1);

        // Add new state
        this.states.push(state);
        this.currentIndex++;

        // Limit history size
        if (this.states.length > this.maxSize) {
            this.states.shift();
            this.currentIndex--;
        }
    }

    /**
     * Go back one state
     */
    undo() {
        if (!this.canUndo()) return null;

        this.currentIndex--;
        return this.states[this.currentIndex];
    }

    /**
     * Go forward one state
     */
    redo() {
        if (!this.canRedo()) return null;

        this.currentIndex++;
        return this.states[this.currentIndex];
    }

    /**
     * Check if undo is available
     */
    canUndo() {
        return this.currentIndex > 0;
    }

    /**
     * Check if redo is available
     */
    canRedo() {
        return this.currentIndex < this.states.length - 1;
    }

    /**
     * Get current state
     */
    getCurrent() {
        if (this.currentIndex < 0) return null;
        return this.states[this.currentIndex];
    }

    /**
     * Clear all history
     */
    clear() {
        this.states = [];
        this.currentIndex = -1;
    }

    /**
     * Get history info for debugging
     */
    getInfo() {
        return {
            total: this.states.length,
            current: this.currentIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        };
    }
}
