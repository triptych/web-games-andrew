// Text rendering engine with typewriter effect (DOM-based)

import { CONFIG } from './config.js';

export class TextEngine {
    constructor() {
        this.textBuffer = document.getElementById('text-buffer');
        this.textDisplay = document.getElementById('text-display');
        this.buffer = []; // Array of text line objects
        this.maxLines = CONFIG.MAX_BUFFER_LINES;
        
        // Typewriter effect state
        this.currentlyTyping = false;
        this.typewriterQueue = [];
        this.currentText = '';
        this.currentIndex = 0;
        this.lastTypeTime = 0;
        this.canSkip = false;
        this.currentLine = null;
    }

    /**
     * Add text to buffer with optional typewriter effect
     * @param {string} text - Text to display
     * @param {object} options - Display options (color, style, instant)
     */
    print(text, options = {}) {
        const colorClass = this.getColorClass(options.color || CONFIG.COLORS.TEXT_PRIMARY);
        const instant = options.instant || !CONFIG.TYPEWRITER_ENABLED;
        
        // Word wrap text to fit terminal width
        const lines = this.wordWrap(text, CONFIG.MAX_LINE_WIDTH);
        
        if (instant) {
            // Add all lines immediately
            lines.forEach(line => {
                this.addLineToBuffer(line, colorClass);
            });
            this.scrollToBottom();
        } else {
            // Queue for typewriter effect
            this.typewriterQueue.push({
                lines,
                colorClass,
                lineIndex: 0
            });
            
            if (!this.currentlyTyping) {
                this.startTypewriter();
            }
        }
    }

    /**
     * Convert RGB color array to CSS class
     */
    getColorClass(colorArray) {
        const [r, g, b] = colorArray;
        if (r === 255 && g === 0 && b === 0) return 'text-error';
        if (r === 128 && g === 128 && b === 128) return 'text-system';
        if (r === 255 && g === 255 && b === 0) return 'text-highlighted';
        if (r === 0 && g === 200 && b === 0) return 'text-secondary';
        return 'text-primary';
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
     * Print NPC dialogue (cyan, typewriter effect)
     */
    printNPC(text) {
        const lines = this.wordWrap(text, CONFIG.MAX_LINE_WIDTH);
        lines.forEach(line => {
            this.addLineToBuffer(line, 'text-npc');
        });
        this.scrollToBottom();
    }

    /**
     * Print NPC name header (bright cyan, instant)
     */
    printNPCName(text) {
        this.addLineToBuffer('', 'text-npc');
        this.addLineToBuffer(text, 'text-npc-name');
        this.scrollToBottom();
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
    addLineToBuffer(text, colorClass) {
        const lineElement = document.createElement('div');
        lineElement.className = `text-line ${colorClass}`;
        lineElement.textContent = text;
        this.textBuffer.appendChild(lineElement);

        this.buffer.push({
            text,
            colorClass,
            timestamp: Date.now(),
            element: lineElement
        });

        // Trim buffer if too large
        if (this.buffer.length > this.maxLines) {
            const removed = this.buffer.shift();
            if (removed.element && removed.element.parentNode) {
                removed.element.parentNode.removeChild(removed.element);
            }
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
            
            // Create a new line element for typing
            this.currentLine = document.createElement('div');
            this.currentLine.className = `text-line ${current.colorClass} typing-cursor`;
            this.textBuffer.appendChild(this.currentLine);
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

            // Update the current line
            if (this.currentLine) {
                this.currentLine.textContent = this.currentText.substring(0, this.currentIndex);
            }

            // Check if current line is complete
            if (this.currentIndex >= this.currentText.length) {
                // Remove typing cursor
                if (this.currentLine) {
                    this.currentLine.classList.remove('typing-cursor');
                }
                
                this.scrollToBottom();
                
                // Move to next line
                current.lineIndex++;
                
                if (current.lineIndex < current.lines.length) {
                    // Start next line
                    this.currentText = current.lines[current.lineIndex];
                    this.currentIndex = 0;
                    
                    // Create new line element
                    this.currentLine = document.createElement('div');
                    this.currentLine.className = `text-line ${current.colorClass} typing-cursor`;
                    this.textBuffer.appendChild(this.currentLine);
                } else {
                    // All lines done, remove from queue
                    this.typewriterQueue.shift();
                    
                    if (this.typewriterQueue.length > 0) {
                        this.startTypewriter();
                    } else {
                        this.currentlyTyping = false;
                        this.currentText = '';
                        this.currentIndex = 0;
                        this.currentLine = null;
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

        // Remove current typing line
        if (this.currentLine && this.currentLine.parentNode) {
            this.currentLine.parentNode.removeChild(this.currentLine);
        }

        // Complete all queued text instantly
        while (this.typewriterQueue.length > 0) {
            const current = this.typewriterQueue.shift();
            for (let i = current.lineIndex; i < current.lines.length; i++) {
                this.addLineToBuffer(current.lines[i], current.colorClass);
            }
        }

        this.currentlyTyping = false;
        this.currentText = '';
        this.currentIndex = 0;
        this.currentLine = null;
        this.scrollToBottom();
    }

    /**
     * Clear the text buffer
     */
    clear() {
        this.textBuffer.innerHTML = '';
        this.buffer = [];
        this.typewriterQueue = [];
        this.currentlyTyping = false;
        this.currentText = '';
        this.currentIndex = 0;
        this.currentLine = null;
    }

    /**
     * Scroll to bottom of buffer
     */
    scrollToBottom() {
        this.textDisplay.scrollTop = this.textDisplay.scrollHeight;
    }
}
