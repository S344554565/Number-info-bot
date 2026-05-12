const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync('uploads')) {
            fs.mkdirSync('uploads');
        }
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/plain') {
            cb(null, true);
        } else {
            cb(new Error('Only .txt files allowed'), false);
        }
    }
});

// Store active intervals
let activeIntervals = new Map();
let isRunning = false;
let currentTaskId = null;

// Facebook Graph API endpoint (Note: Requires valid access token)
const FACEBOOK_GRAPH_API = 'https://graph.facebook.com/v18.0';

// Function to send message via Facebook API
async function sendFacebookMessage(accessToken, threadId, message) {
    try {
        const response = await axios.post(
            `${FACEBOOK_GRAPH_API}/me/messages`,
            {
                recipient: { id: threadId },
                message: { text: message },
                messaging_type: 'RESPONSE'
            },
            {
                params: { access_token: accessToken }
            }
        );
        return { success: true, data: response.data };
    } catch (error) {
        console.error('Facebook API Error:', error.response?.data || error.message);
        return { success: false, error: error.response?.data || error.message };
    }
}

// Alternative endpoint for pages (if using page access token)
async function sendMessageViaPage(pageId, accessToken, threadId, message) {
    try {
        const response = await axios.post(
            `${FACEBOOK_GRAPH_API}/${pageId}/messages`,
            {
                recipient: { id: threadId },
                message: { text: message }
            },
            {
                params: { access_token: accessToken }
            }
        );
        return { success: true, data: response.data };
    } catch (error) {
        return { success: false, error: error.response?.data || error.message };
    }
}

// Upload endpoint
app.post('/api/upload', upload.single('messageFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    const messages = fs.readFileSync(filePath, 'utf-8')
        .split('\n')
        .filter(line => line.trim().length > 0);
    
    res.json({ 
        success: true, 
        filename: req.file.filename,
        messageCount: messages.length,
        messages: messages 
    });
});

// Start messaging task
app.post('/api/start', async (req, res) => {
    if (isRunning) {
        return res.status(400).json({ error: 'Task already running' });
    }

    const { tokenType, accessToken, threadId, haterName, timeInterval, messages } = req.body;
    
    if (!accessToken || !threadId || !messages || messages.length === 0) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const intervalMs = (parseFloat(timeInterval) || 1) * 1000;
    let messageIndex = 0;
    
    isRunning = true;
    currentTaskId = Date.now().toString();
    
    const sendNextMessage = async () => {
        if (!isRunning) return;
        
        if (messageIndex >= messages.length) {
            console.log('All messages sent!');
            isRunning = false;
            activeIntervals.delete(currentTaskId);
            return;
        }
        
        let currentMessage = messages[messageIndex];
        if (haterName && haterName.trim()) {
            currentMessage = currentMessage.replace(/\[HATER\]/g, haterName);
        }
        
        console.log(`Sending message ${messageIndex + 1}/${messages.length}: ${currentMessage}`);
        
        let result;
        if (tokenType === 'Single') {
            result = await sendFacebookMessage(accessToken, threadId, currentMessage);
        } else {
            // For multi-token, you would implement token rotation here
            result = await sendFacebookMessage(accessToken, threadId, currentMessage);
        }
        
        if (result.success) {
            console.log(`✓ Message ${messageIndex + 1} sent successfully`);
        } else {
            console.error(`✗ Failed to send message ${messageIndex + 1}:`, result.error);
        }
        
        messageIndex++;
        
        // Schedule next message
        const timeoutId = setTimeout(sendNextMessage, intervalMs);
        activeIntervals.set(currentTaskId, timeoutId);
    };
    
    sendNextMessage();
    
    res.json({ 
        success: true, 
        message: 'Task started successfully',
        taskId: currentTaskId,
        totalMessages: messages.length,
        intervalSeconds: timeInterval
    });
});

// Stop messaging task
app.post('/api/stop', (req, res) => {
    if (!isRunning) {
        return res.status(400).json({ error: 'No task is currently running' });
    }
    
    isRunning = false;
    
    // Clear all intervals
    for (const [taskId, timeoutId] of activeIntervals.entries()) {
        clearTimeout(timeoutId);
        activeIntervals.delete(taskId);
    }
    
    res.json({ success: true, message: 'Task stopped successfully' });
});

// Get status
app.get('/api/status', (req, res) => {
    res.json({ isRunning });
});

app.listen(PORT, () => {
    console.log(`🚀 Hacker Messenger running on http://localhost:${PORT}`);
    console.log(`⚜️ MR SURAJ ⚜️`);
});
