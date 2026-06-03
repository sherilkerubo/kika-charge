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

const server = http.createServer((req, res) => {
    console.log(`[Request] ${req.method} ${req.url}`);

    // Parse URL path
    let filePath = req.url === '/' ? './index.html' : '.' + req.url;
    
    // Resolve absolute path safely
    const resolvedPath = path.resolve(filePath);
    const workspaceRoot = path.resolve(__dirname);
    
    // Prevent directory traversal attacks (ensure files are served from workspace directory)
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
                // Add header to support service worker testing locally
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
