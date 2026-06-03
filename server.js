// Kika-Charge Lightweight Dev Server (Zero-Dependency Node.js)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Simple data storage arrays
const registeredDrivers = [];
const registeredHosts = [];

const server = http.createServer((req, res) => {
    console.log(`[Request] ${req.method} ${req.url}`);

    // API ENDPOINT: REGISTER DRIVER
    if (req.method === 'POST' && req.url === '/api/register-driver') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const newDriver = {
                    id: `rider_${Date.now().toString().slice(-4)}`,
                    name: data.name,
                    phone: data.phone,
                    vehicle: data.vehicle,
                    walletBalance: 0.00,
                    batteryPct: 100
                };
                registeredDrivers.push(newDriver);
                console.log('[Database] Driver Added:', newDriver);
                
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, driver: newDriver }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Invalid JSON Request Payload');
            }
        });
        return;
    }

    // API ENDPOINT: REGISTER HOST
    if (req.method === 'POST' && req.url === '/api/register-host') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const newHost = {
                    id: `host_${Date.now().toString().slice(-4)}`,
                    name: data.name,
                    landmark: data.landmark,
                    location: data.location,
                    earnings: 0.00,
                    payoutBalance: 0.00
                };
                registeredHosts.push(newHost);
                console.log('[Database] Host Added:', newHost);
                
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, host: newHost }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Invalid JSON Request Payload');
            }
        });
        return;
    }

    // Parse URL path
    let filePath = req.url === '/' ? './index.html' : '.' + req.url;
    
    // Resolve absolute path safely
    const resolvedPath = path.resolve(filePath);
    const workspaceRoot = path.resolve(__dirname);
    
    // Prevent directory traversal attacks
    if (!resolvedPath.startsWith(workspaceRoot)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden: Directory Traversal Blocked');
        return;
    }

    const extname = path.extname(resolvedPath);
    let contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(resolvedPath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`500 Internal Server Error: ${error.code}`);
            }
        } else {
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Service-Worker-Allowed': '/' 
            });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`⚡ Kika-Charge Local Development Server Booted Successfully ⚡`);
    console.log(`👉 Access URL: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
});