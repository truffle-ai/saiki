import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js'; // Use CDN for simplicity

const messageList = document.getElementById('message-list');
const messageListWrapper = document.getElementById('message-list-wrapper'); // Get the wrapper
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const resetButton = document.getElementById('reset-button');
const statusIndicator = document.getElementById('status-indicator'); // NEW

let ws;
let currentAiMessageElement = null;
let thinkingIndicatorElement = null;

// Configure marked with sanitization (IMPORTANT!)
marked.use({ sanitize: true }); // Deprecated but simple way for basic cases
// For more robust sanitization, consider DOMPurify: 
// import DOMPurify from 'dompurify';
// marked.use({ sanitizer: (dirty) => DOMPurify.sanitize(dirty) }); 

function connectWebSocket() {
    // Determine WebSocket protocol based on window location protocol
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}`;
    
    console.log(`Attempting to connect WebSocket to: ${wsUrl}`);
    // Update status indicator
    statusIndicator.className = 'connecting'; 
    statusIndicator.setAttribute('data-tooltip', 'Connecting...');

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket connection established');
        // Update status indicator
        statusIndicator.className = 'connected'; 
        statusIndicator.setAttribute('data-tooltip', 'Connected');
        // Enable input once connected
        messageInput.disabled = false;
        sendButton.disabled = false;
        resetButton.disabled = false;
    };

    ws.onmessage = (event) => {
        console.log('WebSocket message received:', event.data);
        try {
            const message = JSON.parse(event.data);
            handleWebSocketMessage(message);
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
            appendMessage('Received invalid data from server.', 'error');
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        // Update status indicator
        statusIndicator.className = 'error'; 
        statusIndicator.setAttribute('data-tooltip', 'Connection Error');
        appendMessage('WebSocket connection error. Please try refreshing.', 'error');
        // Disable input on error
        messageInput.disabled = true;
        sendButton.disabled = true;
        resetButton.disabled = true;
    };

    ws.onclose = (event) => {
        console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
        const reasonText = event.reason || 'Trying to reconnect...';
        // Update status indicator
        statusIndicator.className = 'error'; // Show error state on close
        statusIndicator.setAttribute('data-tooltip', `Disconnected: ${reasonText}`);
        // Disable input on close
        messageInput.disabled = true;
        sendButton.disabled = true;
        resetButton.disabled = true;
        // Attempt to reconnect after a delay
        setTimeout(connectWebSocket, 5000); 
    };
}

function handleWebSocketMessage(message) {
    removeThinkingIndicator(); // Remove thinking indicator on any new message
    let shouldScroll = isScrolledToBottom(); // Check scroll before adding new content

    switch (message.event) {
        case 'thinking':
            showThinkingIndicator();
            break;
        case 'chunk': { // Restore original chunk handling (simple version)
            if (!currentAiMessageElement) {
                currentAiMessageElement = appendMessage('', 'ai', true, true); // Create new streaming element, mark as HTML
            }
            // Append raw text for streaming, parse markdown only on final response for simplicity
            // Or, parse markdown chunk by chunk (more complex)
            let currentHtml = currentAiMessageElement.innerHTML || '';
            // Basic newline handling for chunks, but keep it as HTML
            currentAiMessageElement.innerHTML = currentHtml + message.data.text.replace(/\n/g, '<br>'); 
            break;
        }
        case 'response': { // Restore response handling with marked
             let finalHtmlContent = '';
             try {
                 // Use marked.parse() to convert markdown to HTML
                 finalHtmlContent = marked.parse(message.data.text || '');
             } catch(e) {
                 console.error("Markdown parsing error:", e);
                 // Fallback to plain text with breaks if parsing fails
                 finalHtmlContent = escapeHtml(message.data.text || '').replace(/\n/g, '<br>'); 
             }
             
             if (currentAiMessageElement) {
                // Final update to the streaming element with parsed HTML
                currentAiMessageElement.innerHTML = finalHtmlContent;
                currentAiMessageElement.classList.remove('streaming'); 
                currentAiMessageElement = null; 
            } else {
                // If no streaming occurred, just append the final response as HTML
                appendMessage(finalHtmlContent, 'ai', false, true); // Pass flag indicating HTML content
            }
            break;
        }
        case 'toolCall': { // Modified tool call handling for expand/collapse
            const argsString = JSON.stringify(message.data.args, null, 2);
            // Create only the header part initially
            const headerHtml = `<strong>Tool Call:</strong> ${escapeHtml(message.data.toolName)}`;
            const contentHtml = `<pre><code>${escapeHtml(argsString)}</code></pre>`;
            appendExpandableMessage(headerHtml, contentHtml, 'tool-call');
            currentAiMessageElement = null;
            break;
        }
        case 'toolResult': { // Modified tool result handling for expand/collapse
            let resultString;
            try {
                resultString = JSON.stringify(message.data.result, null, 2);
            } catch {
                resultString = String(message.data.result);
            }
            // Create only the header part initially
            const headerHtml = `<strong>Tool Result:</strong> ${escapeHtml(message.data.toolName)}`;
            const contentHtml = `<pre><code>${escapeHtml(resultString)}</code></pre>`;
            appendExpandableMessage(headerHtml, contentHtml, 'tool-result');
            currentAiMessageElement = null;
            break;
        }
        case 'error': {
            appendMessage(`Error: ${message.data.message}`, 'error');
            currentAiMessageElement = null; // Reset streaming on error
            break;
        }
        case 'conversationReset': {
            messageList.innerHTML = ''; // Clear the chat
            appendMessage('Conversation history cleared.', 'status');
            currentAiMessageElement = null; // Reset streaming state
            shouldScroll = true; // Force scroll after clearing
            break;
        }
        default: {
            console.warn('Received unknown event type:', message.event);
            break;
        }
    }
    // Scroll only if user was already at the bottom or after reset
    if (shouldScroll) {
        scrollToBottom();
    }
}

// Restore appendMessage to handle HTML content flag
function appendMessage(content, type = 'status', isStreaming = false, isHtml = false) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', type);
    
    if (isHtml) {
        messageElement.innerHTML = content; // Set innerHTML for parsed markdown/formatted HTML
    } else {
        messageElement.textContent = content; // Set textContent for plain text
    }

    if (isStreaming) {
        messageElement.classList.add('streaming');
    }
    messageList.appendChild(messageElement);
    // Scroll is handled in handleWebSocketMessage
    // scrollToBottom(); 
    return messageElement; 
}

// New function for expandable messages
function appendExpandableMessage(headerHtml, contentHtml, type) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', type);
    messageElement.innerHTML = headerHtml + contentHtml; // Add both header and hidden content

    // Add click listener to the message element itself for toggling
    messageElement.addEventListener('click', () => {
        messageElement.classList.toggle('expanded');
    });

    messageList.appendChild(messageElement);
    // Scroll is handled in handleWebSocketMessage
    // scrollToBottom(); 
    return messageElement;
}

// HTML escaping function - Keep this
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

function showThinkingIndicator() {
    let shouldScroll = isScrolledToBottom();
    if (!thinkingIndicatorElement) {
        // Create the outer div
        thinkingIndicatorElement = document.createElement('div');
        thinkingIndicatorElement.classList.add('message', 'ai', 'thinking');
        
        // Create an inner span required by the CSS animation
        const innerSpan = document.createElement('span'); 
        thinkingIndicatorElement.appendChild(innerSpan); // Append the span
        
        // Add ARIA roles for accessibility
        thinkingIndicatorElement.setAttribute('role', 'status');
        thinkingIndicatorElement.setAttribute('aria-live', 'polite');
        
        messageList.appendChild(thinkingIndicatorElement);
        // Scroll only if user was already at the bottom
        if (shouldScroll) {
            scrollToBottom();
        }
    }
}

function removeThinkingIndicator() {
    if (thinkingIndicatorElement) {
        thinkingIndicatorElement.remove();
        thinkingIndicatorElement = null;
    }
}

function sendMessage() {
    const messageText = messageInput.value.trim();
    if (messageText && ws && ws.readyState === WebSocket.OPEN) {
        appendMessage(messageText, 'user'); // Append user message
        // Scroll immediately after user sends message
        scrollToBottom(); 
        ws.send(JSON.stringify({ type: 'message', content: messageText }));
        messageInput.value = '';
        messageInput.style.height = 'auto'; // Reset height after sending
        messageInput.focus();
    } else if (!ws || ws.readyState !== WebSocket.OPEN) {
        appendMessage('Not connected to server.', 'error');
    }
}

function resetConversation() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('Sending reset request...');
        ws.send(JSON.stringify({ type: 'reset' }));
        // UI clear will happen upon receiving 'conversationReset' event from server
    } else {
        appendMessage('Not connected to server.', 'error');
    }
}

function scrollToBottom() {
    messageListWrapper.scrollTop = messageListWrapper.scrollHeight;
}

// Function to check if user is scrolled to the bottom
function isScrolledToBottom() {
    const threshold = 5; // Allow a few pixels tolerance
    return messageListWrapper.scrollHeight - messageListWrapper.scrollTop - messageListWrapper.clientHeight <= threshold;
}

// Adjust textarea height dynamically
function adjustTextareaHeight() {
    messageInput.style.height = 'auto'; // Reset height
    messageInput.style.height = messageInput.scrollHeight + 'px'; // Set to content height
}

// Event Listeners
sendButton.addEventListener('click', sendMessage);
resetButton.addEventListener('click', resetConversation);

messageInput.addEventListener('keypress', (event) => {
    // Send on Enter, but allow Shift+Enter for newline
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // Prevent default newline behavior
        sendMessage();
    }
});

messageInput.addEventListener('input', adjustTextareaHeight);

// Initial setup
messageInput.disabled = true; // Disable input until connected
sendButton.disabled = true;
resetButton.disabled = true;
connectWebSocket(); // Start WebSocket connection
adjustTextareaHeight(); // Adjust initial height 