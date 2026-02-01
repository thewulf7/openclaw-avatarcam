const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const http = require('http');

const PORT = 8000;

function startServer() {
    const app = express();
    app.use(cors());
    app.use(bodyParser.json({ limit: '50mb' })); // Allow large audio payloads

    const server = http.createServer(app);
    const wss = new WebSocketServer({ server, path: '/ws' });

    // --- WebSocket Logic ---
    const connections = new Set();

    wss.on('connection', (ws) => {
        console.log('[API] New WebSocket connection');
        connections.add(ws);

        ws.on('message', (message) => {
            // Relay Logic: Broadcast incoming message to all OTHER clients
            // This allows the OpenClaw Agent to send {type: 'reaction'} or {type: 'audio'} 
            // and have it delivered to the Renderer.
            try {
                // Determine if binary or text. 
                // If binary (raw audio), we might wrap it?
                // For now assuming JSON text messages as per request.
                const msgStr = message.toString();
                // Parsing just to log type, or just pure relay?
                // Pure relay is faster:
                for (const client of connections) {
                    if (client !== ws && client.readyState === 1) {
                         client.send(msgStr);
                    }
                }
            } catch (e) {
                console.error('[API] Relay Error:', e);
            }
        });

        ws.on('close', () => {
            console.log('[API] WebSocket disconnected');
            connections.delete(ws);
        });
        
        ws.on('error', (err) => console.error('[API] WS Error:', err));
    });

    function broadcast(message) {
        const data = JSON.stringify(message);
        for (const client of connections) {
            if (client.readyState === 1) { // OPEN
                client.send(data);
            }
        }
    }

    // --- HTTP Endpoints ---

    app.post('/speak', (req, res) => {
        const { type, data } = req.body;
        if (type !== 'speak') {
            return res.status(400).json({ error: 'Invalid request type' });
        }
        
        console.log(`[API] Broadcasting audio chunk: ${data ? data.length : 0} chars`);
        broadcast({
            type: 'audio_chunk',
            data: data
        });
        
        res.json({ status: 'sent', length: data ? data.length : 0 });
    });

    app.post('/reaction', (req, res) => {
        const { type, name } = req.body;
        if (type !== 'reaction') {
            return res.status(400).json({ error: 'Invalid request type' });
        }

        console.log(`[API] Triggering reaction: ${name}`);
        broadcast(req.body); // Pass through the whole body
        res.json({ status: 'triggered', reaction: name });
    });

    app.post('/set_avatar', (req, res) => {
        const { path } = req.body;
        console.log(`[API] Setting avatar to: ${path}`);
        broadcast({ type: 'set_avatar', path: path }); // Pass through
        res.json({ status: 'avatar_set', path: path });
    });

    app.post('/set_background', (req, res) => {
        const { path, color } = req.body; // Expect 'path' (image) or 'color' (hex)
        console.log(`[API] Setting background: ${path || color}`);
        broadcast({ type: 'set_background', path, color }); 
        res.json({ status: 'background_set', path, color });
    });

    app.post('/generate_video', (req, res) => {
        const { audio_data, output_path, avatar, background } = req.body; 
        if (!audio_data || !output_path) {
             return res.status(400).json({ error: 'Missing audio_data or output_path' });
        }
        
        console.log(`[API] Video Gen Request -> ${output_path}`);
        broadcast({ 
            type: 'generate_video', 
            audio_data, 
            output_path,
            avatar,
            background
        });
        
        res.json({ status: 'generation_started', output_path });
    });

    app.get('/', (req, res) => {
        res.send('OpenClaw Avatar API (Node.js) is running.');
    });

    // --- Start ---
    server.listen(PORT, '127.0.0.1', () => {
        console.log(`[API] Server listening on http://127.0.0.1:${PORT}`);
    });

    return server;
}

module.exports = { startServer };
