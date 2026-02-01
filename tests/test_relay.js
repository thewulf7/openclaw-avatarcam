const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8000/ws');

ws.on('open', () => {
    console.log('Connected to Avatar API');
    
    // Send a reaction
    console.log('Sending Smile Reaction...');
    ws.send(JSON.stringify({
        type: 'reaction',
        name: 'smile'
    }));
    
    // Send a dummy audio chunk (text representation for test)
    console.log('Sending Dummy Audio...');
    ws.send(JSON.stringify({
        type: 'audio_chunk',
        data: 'UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=' // Tiny header-only wav
    }));

    setTimeout(() => {
        console.log('Test Complete. Closing.');
        ws.close();
    }, 1000);
});

ws.on('error', (e) => {
    console.error('Connection Error:', e);
});
