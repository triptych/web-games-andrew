// Text rendering engine with typewriter effect

import { CONFIG } from './config.js';

export class TextEngine {
    constructor(k) {
        this.k = k;
        this.buffer = []; // Array of text line objects
        this.maxLines = CONFIG.MAX_BUFFER_LINES;
        this.scrollOffset = 0;
        
        // Typewriter effect state
        this.currentlyTyping = false;
        this.typewriterQueue = [];
        this.currentText = '';
        this.currentIndex = 0;
        this.lastTypeTime = 0;
        this.canSkip = false;
    }

    /**
     * Add text to buffer with optional typewriter effect
     * @param {string} text - Text to display
     * @param {object} options - Display options (color, style, instant)
     */
    print(text, options = {}) {
        const color = options.color || CONFIG.COLORS.TEXT_PRIMARY;
        const instant = options.instant || !CONFIG.TYPEWRITER_ENABLED;
        
        // Word wrap text to fit terminal width
        const lines = this.wordWrap(text, CONFIG.MAX_LINE_WIDTH);
        
        if (instant) {
            // Add all lines immediately
            lines.forEach(line => {
                this.addLineToBuffer(line, color);
            });
            this.scrollToBottom();
        } else {
            // Queue for typewriter effect
            this.typewriterQueue.push({
                lines,
                color,
                lineIndex: 0
            });
            
            if (!this.currentlyTyping) {
                this.startTypewriter();
            }
        }
    }

    /**
     * Print text with specific color
     */
    printColored(text, colorName, instant = false) {
        const color = CONFIG.COLORS[colorName] || CONFIG.COLORS.TEXT_PRIMARY;
        this.print(text, { color, instant });
    }

    /**
     * Print error message
     */
    printError(text) {
        this.printColored(text, 'TEXT_ERROR', true);
    }

    /**
     * Print system message
     */
    printSystem(text) {
        this.printColored(text, 'TEXT_SYSTEM', true);
    }

    /**
     * Word wrap text to specified width
     */
    wordWrap(text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            if (testLine.length <= maxWidth) {
                currentLine = testLine;
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                }
                currentLine = word;
            }
        });

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines.length > 0 ? lines : [''];
    }

    /**
     * Add a line to the text buffer
     */
    addLineToBuffer(text, color) {
        this.buffer.push({
            text,
            color,
            timestamp: Date.now()
        });

        // Trim buffer if too large
        if (this.buffer.length > this.maxLines) {
            this.buffer.shift();
        }
    }

    /**
     * Start typewriter effect for queued text
     */
    startTypewriter() {
        if (this.typewriterQueue.length === 0) {
            this.currentlyTyping = false;
            return;
        }

        this.currentlyTyping = true;
        this.canSkip = true;
        const current = this.typewriterQueue[0];
        
        if (current.lineIndex < current.lines.length) {
            this.currentText = current.lines[current.lineIndex];
            this.currentIndex = 0;
            this.lastTypeTime = Date.now();
        }
    }

    /**
     * Update typewriter effect
     */
    updateTypewriter() {
        if (!this.currentlyTyping || this.typewriterQueue.length === 0) {
            return;
        }

        const current = this.typewriterQueue[0];
        const now = Date.now();
        const timeSinceLastChar = now - this.lastTypeTime;

        // Check if it's time to show next character
        let speed = CONFIG.TYPEWRITER_SPEED;
        
        // Add pause on punctuation
        if (this.currentIndex > 0) {
            const lastChar = this.currentText[this.currentIndex - 1];
            if ('.!?'.includes(lastChar)) {
                speed += CONFIG.PAUSE_ON_PUNCTUATION;
            }
        }

        if (timeSinceLastChar >= speed) {
            this.currentIndex++;
            this.lastTypeTime = now;

            // Check if current line is complete
            if (this.currentIndex >= this.currentText.length) {
                // Add completed line to buffer
                this.addLineToBuffer(this.currentText, current.color);
                this.scrollToBottom();
                
                // Move to next line
                current.lineIndex++;
                
                if (current.lineIndex < current.lines.length) {
                    // Start next line
                    this.currentText = current.lines[current.lineIndex];
                    this.currentIndex = 0;
                } else {
                    // All lines done, remove from queue
                    this.typewriterQueue.shift();
                    
                    if (this.typewriterQueue.length > 0) {
                        this.startTypewriter();
                    } else {
                        this.currentlyTyping = false;
                        this.currentText = '';
                        this.currentIndex = 0;
                    }
                }
            }
        }
    }

    /**
     * Skip current typewriter animation
     */
    skipTypewriter() {
        if (!this.canSkip || !this.currentlyTyping) {
            return;
        }

        // Complete all queued text instantly
        while (this.typewriterQueue.length > 0) {
            const current = this.typewriterQueue.shift();
            for (let i = current.lineIndex; i < current.lines.length; i++) {
                this.addLineToBuffer(current.lines[i], current.color);
            }
        }

        this.currentlyTyping = false;
        this.currentText = '';
        this.currentIndex = 0;
        this.scrollToBottom();
    }

    /**
     * Clear the text buffer
     */
    clear() {
        this.buffer = [];
        this.scrollOffset = 0;
        this.typewriterQueue = [];
        this.currentlyTyping = false;
        this.currentText = '';
        this.currentIndex = 0;
    }

    /**
     * Scroll text buffer
     */
    scroll(direction) {
        const maxScroll = Math.max(0, this.buffer.length - this.getVisibleLines());
        this.scrollOffset = Math.max(0, Math.min(maxScroll, 
            this.scrollOffset + direction * CONFIG.UI.SCROLL_SPEED));
    }

    /**
     * Scroll to bottom of buffer
     */
    scrollToBottom() {
        const maxScroll = Math.max(0, this.buffer.length - this.getVisibleLines());
        this.scrollOffset = maxScroll;
    }

    /**
     * Get number of visible lines that fit on screen
     */
    getVisibleLines() {
        const availableHeight = CONFIG.SCREEN_HEIGHT - 
            CONFIG.UI.STATUS_BAR_HEIGHT - 
            CONFIG.UI.INPUT_HEIGHT - 
            (CONFIG.UI.PADDING * 3);
        return Math.floor(availableHeight / CONFIG.LINE_HEIGHT);
    }

    /**
     * Render text buffer to screen
     */
    render() {
        const startY = CONFIG.UI.STATUS_BAR_HEIGHT + CONFIG.UI.PADDING;
        const visibleLines = this.getVisibleLines();
        const startLine = Math.floor(this.scrollOffset);
        const endLine = Math.min(this.buffer.length, startLine + visibleLines);

        // Render buffered lines
        for (let i = startLine; i < endLine; i++) {
            const line = this.buffer[i];
            const y = startY + ((i - startLine) * CONFIG.LINE_HEIGHT);
            
            this.k.drawText({
                text: line.text,
                pos: this.k.vec2(CONFIG.UI.PADDING, y),
                size: CONFIG.FONT_SIZE,
                color: this.k.rgb(...line.color),
                font: 'monospace'
            });
        }

        // Render currently typing line (if any)
        if (this.currentlyTyping && this.currentText) {
            const displayText = this.currentText.substring(0, this.currentIndex);
            const y = startY + ((endLine - startLine) * CONFIG.LINE_HEIGHT);
            
            this.k.drawText({
                text: displayText,
                pos: this.k.vec2(CONFIG.UI.PADDING, y),
                size: CONFIG.FONT_SIZE,
                color: this.k.rgb(...this.typewriterQueue[0].color),
                font: 'monospace'
            });
        }
    }
}
