// MessageLog.js - Message log system

export class MessageLog {
    constructor(element, maxMessages = 50) {
        this.element = element;
        this.maxMessages = maxMessages;
        this.messages = [];
    }

    add(message, color = '#e0e0e0') {
        const timestamp = new Date().toLocaleTimeString();
        this.messages.push({ text: message, color, timestamp });
        
        // Keep only the most recent messages
        if (this.messages.length > this.maxMessages) {
            this.messages.shift();
        }
        
        this.render();
    }

    render() {
        this.element.innerHTML = '';
        
        // Display messages in reverse order (newest first)
        for (let i = this.messages.length - 1; i >= 0; i--) {
            const msg = this.messages[i];
            const p = document.createElement('p');
            p.textContent = msg.text;
            p.style.color = msg.color;
            this.element.appendChild(p);
        }
        
        // Auto-scroll to top (newest message)
        this.element.scrollTop = 0;
    }

    clear() {
        this.messages = [];
        this.render();
    }
}
