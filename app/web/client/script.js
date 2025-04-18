import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js'; // Use CDN for simplicity

// --- Global Variables ---
let ws;
let currentAiMessageElement = null;
let thinkingIndicatorElement = null;

// Configure marked with sanitization (IMPORTANT!)
marked.use({ sanitize: true });

// --- Wait for DOMContentLoaded before initializing UI and listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // --- Get DOM Elements --- 
    const messageList = document.getElementById('message-list');
    const messageListWrapper = document.getElementById('message-list-wrapper');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const resetButton = document.getElementById('reset-button');
    const statusIndicator = document.getElementById('status-indicator');
    const connectServerButton = document.getElementById('connect-server-button');
    const modal = document.getElementById('connect-server-modal');
    const closeModalButton = modal?.querySelector('.close-button');
    const connectServerForm = document.getElementById('connect-server-form');
    const serverTypeSelect = document.getElementById('server-type');
    const stdioOptionsDiv = document.getElementById('stdio-options');
    const sseOptionsDiv = document.getElementById('sse-options');

    // --- Check if critical elements exist ---
    if (!messageList || !messageListWrapper || !messageInput || !sendButton || !resetButton || !statusIndicator || !connectServerButton || !modal || !connectServerForm || !serverTypeSelect || !stdioOptionsDiv || !sseOptionsDiv) {
        console.error("Initialization failed: One or more required DOM elements not found.");
        // Display error to user if possible
        if (messageList) {
             const errorElement = document.createElement('div');
             errorElement.classList.add('message', 'system-error'); // Use existing class
             errorElement.textContent = '[System: Critical UI elements failed to load. Please refresh.]';
             messageList.appendChild(errorElement);
        }
        return; // Stop further execution
    }

    // --- Helper Functions (Defined inside DOMContentLoaded) ---

    function scrollToBottom() {
       messageListWrapper.scrollTop = messageListWrapper.scrollHeight;
    }

    function displaySystemMessage(text, type = 'info') {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `system-${type}`);
        messageElement.textContent = `[System: ${text}]`;
        messageList.appendChild(messageElement);
        scrollToBottom();
    }
    
    function appendMessage(content, type = 'status', isStreaming = false, isHtml = false) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', type);
        
        if (isHtml) {
            messageElement.innerHTML = content; 
        } else {
            messageElement.textContent = content;
        }

        if (isStreaming) {
            messageElement.classList.add('streaming');
        }
        messageList.appendChild(messageElement);
        // Scroll handled by caller (handleWebSocketMessage or sendMessage)
        return messageElement; 
    }

    function appendExpandableMessage(headerHtml, contentHtml, type) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', type);
        messageElement.innerHTML = headerHtml + contentHtml; 

        messageElement.addEventListener('click', () => {
            messageElement.classList.toggle('expanded');
        });

        messageList.appendChild(messageElement);
        // Scroll handled by caller (handleWebSocketMessage)
        return messageElement;
    }

    function showThinkingIndicator() {
        let shouldScroll = isScrolledToBottom();
        if (!thinkingIndicatorElement) {
            thinkingIndicatorElement = document.createElement('div');
            thinkingIndicatorElement.classList.add('message', 'ai', 'thinking');
            const innerSpan = document.createElement('span'); 
            thinkingIndicatorElement.appendChild(innerSpan);
            thinkingIndicatorElement.setAttribute('role', 'status');
            thinkingIndicatorElement.setAttribute('aria-live', 'polite');
            messageList.appendChild(thinkingIndicatorElement);
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

    function isScrolledToBottom() {
        const threshold = 5; 
        return messageListWrapper.scrollHeight - messageListWrapper.scrollTop - messageListWrapper.clientHeight <= threshold;
    }

    function adjustTextareaHeight() {
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
    }

    function sendMessage() {
        const messageText = messageInput.value.trim();
        if (messageText && ws && ws.readyState === WebSocket.OPEN) {
            appendMessage(messageText, 'user'); 
            scrollToBottom(); 
            ws.send(JSON.stringify({ type: 'message', content: messageText }));
            messageInput.value = '';
            adjustTextareaHeight(); // Adjust height after clearing
            messageInput.focus();
        } else if (!ws || ws.readyState !== WebSocket.OPEN) {
            displaySystemMessage('Cannot send message: Not connected to server.', 'error');
        }
    }

    function resetConversation() {
        if (ws && ws.readyState === WebSocket.OPEN) {
            console.log('Sending reset request...');
            ws.send(JSON.stringify({ type: 'reset' }));
            // UI clear is handled by 'conversationReset' event from server
        } else {
            displaySystemMessage('Cannot reset: Not connected to server.', 'error');
        }
    }

    // --- WebSocket Handling (Needs access to DOM helpers defined above) ---
    function handleWebSocketMessage(message) {
        removeThinkingIndicator();
        let shouldScroll = isScrolledToBottom();

        switch (message.event) {
            case 'thinking':
                showThinkingIndicator();
                break;
            case 'chunk': {
                if (!currentAiMessageElement) {
                    currentAiMessageElement = appendMessage('', 'ai', true, true);
                }
                if (currentAiMessageElement) {
                   let currentHtml = currentAiMessageElement.innerHTML || '';
                   // Basic handling for chunks, might need refinement for complex markdown
                   currentAiMessageElement.innerHTML = currentHtml + message.data.text.replace(/\n/g, '<br>');
                }
                break;
            }
            case 'response': {
                 let finalHtmlContent = '';
                 try {
                     finalHtmlContent = marked.parse(message.data.text || '');
                 } catch(e) {
                     console.error("Markdown parsing error:", e);
                     finalHtmlContent = escapeHtml(message.data.text || '').replace(/\n/g, '<br>');
                 }

                 if (currentAiMessageElement) {
                    currentAiMessageElement.innerHTML = finalHtmlContent;
                    currentAiMessageElement.classList.remove('streaming');
                    currentAiMessageElement = null;
                } else {
                    appendMessage(finalHtmlContent, 'ai', false, true);
                }
                break;
            }
            case 'toolCall': {
                const argsString = JSON.stringify(message.data.args, null, 2);
                const headerHtml = `<strong>Tool Call:</strong> ${escapeHtml(message.data.toolName)}`;
                const contentHtml = `<pre><code>${escapeHtml(argsString)}</code></pre>`;
                appendExpandableMessage(headerHtml, contentHtml, 'tool-call');
                currentAiMessageElement = null;
                break;
            }
            case 'toolResult': {
                let resultString;
                try {
                    resultString = JSON.stringify(message.data.result, null, 2);
                } catch {
                    resultString = String(message.data.result);
                }
                const headerHtml = `<strong>Tool Result:</strong> ${escapeHtml(message.data.toolName)}`;
                const contentHtml = `<pre><code>${escapeHtml(resultString)}</code></pre>`;
                appendExpandableMessage(headerHtml, contentHtml, 'tool-result');
                currentAiMessageElement = null;
                break;
            }
            case 'error': {
                displaySystemMessage(`Error: ${message.data.message}`, 'error');
                currentAiMessageElement = null;
                break;
            }
            case 'conversationReset': {
                messageList.innerHTML = '';
                displaySystemMessage('Conversation history cleared.', 'status');
                currentAiMessageElement = null;
                shouldScroll = true;
                break;
            }
            default: {
                console.warn('Received unknown event type:', message.event);
                break;
            }
        }
        if (shouldScroll) {
            scrollToBottom();
        }
    }

    function connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}`;

        console.log(`Attempting to connect WebSocket to: ${wsUrl}`);
        statusIndicator.className = 'connecting';
        statusIndicator.setAttribute('data-tooltip', 'Connecting...');

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('WebSocket connection established');
            statusIndicator.className = 'connected';
            statusIndicator.setAttribute('data-tooltip', 'Connected');
            messageInput.disabled = false;
            sendButton.disabled = false;
            resetButton.disabled = false;
        };

        ws.onmessage = (event) => {
            console.log('WebSocket message received:', event.data);
            try {
                const message = JSON.parse(event.data);
                handleWebSocketMessage(message); // Call helper defined above
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
                displaySystemMessage('Received invalid data from server.', 'error');
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            statusIndicator.className = 'error';
            statusIndicator.setAttribute('data-tooltip', 'Connection Error');
            displaySystemMessage('WebSocket connection error. Please try refreshing.', 'error');
            messageInput.disabled = true;
            sendButton.disabled = true;
            resetButton.disabled = true;
        };

        ws.onclose = (event) => {
            console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
            const reasonText = event.reason || 'Trying to reconnect...';
            statusIndicator.className = 'error';
            statusIndicator.setAttribute('data-tooltip', `Disconnected: ${reasonText}`);
            messageInput.disabled = true;
            sendButton.disabled = true;
            resetButton.disabled = true;
            setTimeout(connectWebSocket, 5000); // Attempt reconnect
        };
    }

    // --- Attach Event Listeners ---
    sendButton.addEventListener('click', sendMessage);
    resetButton.addEventListener('click', resetConversation);

    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });
    messageInput.addEventListener('input', adjustTextareaHeight);

    // Connect Server Modal Listeners
    connectServerButton.addEventListener('click', () => {
        modal.style.display = 'block';
    });

    if (closeModalButton) {
        closeModalButton.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    serverTypeSelect.addEventListener('change', (event) => {
        const selectedType = event.target.value;
        stdioOptionsDiv.style.display = selectedType === 'stdio' ? 'block' : 'none';
        sseOptionsDiv.style.display = selectedType === 'sse' ? 'block' : 'none';
    });
    // eslint-disable-next-line no-undef
    serverTypeSelect.dispatchEvent(new Event('change')); // Set initial visibility

    connectServerForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission behavior

        const serverNameInput = document.getElementById('server-name');
        const serverCommandInput = document.getElementById('server-command');
        const serverArgsInput = document.getElementById('server-args');
        const serverUrlInput = document.getElementById('server-url');

        const serverName = serverNameInput ? serverNameInput.value.trim() : '';
        const serverType = serverTypeSelect.value;

        if (!serverName) {
            displaySystemMessage('Server Name is required.', 'error');
            return;
        }

        let config = { type: serverType };
        let isValid = true;

        if (serverType === 'stdio') {
            const command = serverCommandInput ? serverCommandInput.value.trim() : '';
            const argsString = serverArgsInput ? serverArgsInput.value.trim() : '';
            if (!command) {
                displaySystemMessage('Command is required for stdio server type.', 'error');
                isValid = false;
            }
            config.command = command;
            config.args = argsString ? argsString.split(',').map(arg => arg.trim()) : [];
        } else if (serverType === 'sse') {
            const url = serverUrlInput ? serverUrlInput.value.trim() : '';
            if (!url) {
                displaySystemMessage('URL is required for sse server type.', 'error');
                isValid = false;
            }
            try {
                new URL(url); // eslint-disable-line no-undef
            } catch (_) { // eslint-disable-line no-unused-vars
                displaySystemMessage('Invalid URL format.', 'error');
                isValid = false;
            }
            config.url = url;
        }

        if (!isValid) return;

        displaySystemMessage(`Attempting to connect to server '${serverName}'...`, 'info');
        modal.style.display = 'none';

        try {
            const response = await fetch('/api/connect-server', { // eslint-disable-line no-undef
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: serverName, config: config }),
            });

            if (response.ok) {
                const result = await response.json();
                displaySystemMessage(`Successfully connected to server '${result.name}'.`, 'success');
                connectServerForm.reset();
            } else {
                const errorData = await response.json();
                displaySystemMessage(`Error connecting to server: ${errorData.error || response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('Failed to send connect server request:', error);
            displaySystemMessage(`Failed to send connection request: ${error.message}`, 'error');
        }
    });

    // --- Initial UI State Setup ---
    messageInput.disabled = true;
    sendButton.disabled = true;
    resetButton.disabled = true;
    adjustTextareaHeight(); // Adjust initial height
    connectWebSocket(); // Start WebSocket connection

}); // End of DOMContentLoaded

// --- Non-DOM Helper functions (Can stay global) ---
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }