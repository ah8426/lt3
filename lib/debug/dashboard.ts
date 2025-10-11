import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { parse } from 'url';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logger, LT3Logger } from './logger';
import { lt3Profiler } from './profiler';
import { lt3Tracing } from './tracing';

/**
 * Real-time Debug Dashboard for Law Transcribed
 * Provides live monitoring of performance, logs, and system metrics
 */
export class LT3DebugDashboard {
  private server: any = null;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private metricsInterval: NodeJS.Timeout | null = null;
  private port: number;
  private host: string;

  constructor(port = 9231, host = 'localhost') {
    this.port = port;
    this.host = host;
  }

  /**
   * Start the debug dashboard server
   */
  async start(): Promise<void> {
    try {
      // Create HTTP server
      this.server = createServer((req, res) => {
        const parsedUrl = parse(req.url || '', true);
        const pathname = parsedUrl.pathname;

        // Serve dashboard HTML
        if (pathname === '/' || pathname === '/dashboard') {
          this.serveHTML(res, 'dashboard.html');
        } else if (pathname === '/api/metrics') {
          this.serveMetrics(res);
        } else if (pathname === '/api/logs') {
          this.serveLogs(res);
        } else if (pathname === '/api/profiles') {
          this.serveProfiles(res);
        } else if (pathname === '/api/health') {
          this.serveHealth(res);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      // Create WebSocket server
      this.wss = new WebSocketServer({ server: this.server });

      this.wss.on('connection', (ws) => {
        this.clients.add(ws);
        logger.debug('Dashboard client connected', { clientCount: this.clients.size });

        // Send initial data
        this.sendToClient(ws, {
          type: 'welcome',
          data: {
            service: 'law-transcribed',
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV,
            uptime: process.uptime(),
          },
        });

        ws.on('close', () => {
          this.clients.delete(ws);
          logger.debug('Dashboard client disconnected', { clientCount: this.clients.size });
        });

        ws.on('message', (message) => {
          try {
            const command = JSON.parse(message.toString());
            this.handleCommand(ws, command);
          } catch (error) {
            logger.error('Invalid dashboard command', { error: (error as Error).message });
          }
        });
      });

      // Start metrics broadcasting
      this.startMetricsBroadcast();

      // Start server
      this.server.listen(this.port, this.host, () => {
        logger.info(`Debug dashboard started at http://${this.host}:${this.port}`, {
          port: this.port,
          host: this.host,
        });
      });
    } catch (error) {
      logger.error('Failed to start debug dashboard', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Stop the debug dashboard
   */
  async stop(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.wss) {
      this.wss.close();
    }

    if (this.server) {
      this.server.close();
    }

    logger.info('Debug dashboard stopped');
  }

  /**
   * Serve HTML files
   */
  private serveHTML(res: any, filename: string): void {
    try {
      const htmlPath = join(__dirname, 'dashboard-static', filename);
      const html = readFileSync(htmlPath, 'utf8');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (error) {
      // Serve embedded HTML if file doesn't exist
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(this.getEmbeddedHTML());
    }
  }

  /**
   * Serve current metrics
   */
  private serveMetrics(res: any): void {
    const metrics = this.getCurrentMetrics();

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(metrics, null, 2));
  }

  /**
   * Serve recent logs
   */
  private serveLogs(res: any): void {
    // This would integrate with your logging system
    const logs = this.getRecentLogs();

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(logs, null, 2));
  }

  /**
   * Serve available profiles
   */
  private serveProfiles(res: any): void {
    const profiles = this.getAvailableProfiles();

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(profiles, null, 2));
  }

  /**
   * Serve health status
   */
  private serveHealth(res: any): void {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: process.env.npm_package_version || '1.0.0',
    };

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(health, null, 2));
  }

  /**
   * Handle dashboard commands
   */
  private handleCommand(ws: WebSocket, command: any): void {
    switch (command.type) {
      case 'startCPUProfile':
        this.handleStartCPUProfile(ws, command.data);
        break;
      case 'stopCPUProfile':
        this.handleStopCPUProfile(ws, command.data);
        break;
      case 'takeHeapSnapshot':
        this.handleTakeHeapSnapshot(ws);
        break;
      case 'exportMetrics':
        this.handleExportMetrics(ws);
        break;
      case 'clearLogs':
        this.handleClearLogs(ws);
        break;
      default:
        logger.warn('Unknown dashboard command', { command: command.type });
    }
  }

  /**
   * Handle start CPU profile command
   */
  private async handleStartCPUProfile(ws: WebSocket, data: any): Promise<void> {
    try {
      const profileId = lt3Profiler.startCPUProfile(data.id || 'dashboard', data.options);

      this.sendToClient(ws, {
        type: 'cpuProfileStarted',
        data: { profileId },
      });

      logger.info('CPU profile started from dashboard', { profileId });
    } catch (error) {
      this.sendToClient(ws, {
        type: 'error',
        data: { message: (error as Error).message },
      });
    }
  }

  /**
   * Handle stop CPU profile command
   */
  private async handleStopCPUProfile(ws: WebSocket, data: any): Promise<void> {
    try {
      const result = await lt3Profiler.stopCPUProfile(data.profileId);

      this.sendToClient(ws, {
        type: 'cpuProfileStopped',
        data: result,
      });

      logger.info('CPU profile stopped from dashboard', { result });
    } catch (error) {
      this.sendToClient(ws, {
        type: 'error',
        data: { message: (error as Error).message },
      });
    }
  }

  /**
   * Handle take heap snapshot command
   */
  private async handleTakeHeapSnapshot(ws: WebSocket): Promise<void> {
    try {
      const result = await lt3Profiler.takeHeapSnapshot('dashboard');

      this.sendToClient(ws, {
        type: 'heapSnapshotTaken',
        data: result,
      });

      logger.info('Heap snapshot taken from dashboard', { result });
    } catch (error) {
      this.sendToClient(ws, {
        type: 'error',
        data: { message: (error as Error).message },
      });
    }
  }

  /**
   * Handle export metrics command
   */
  private handleExportMetrics(ws: WebSocket): void {
    try {
      const filePath = lt3Profiler.exportMetrics();

      this.sendToClient(ws, {
        type: 'metricsExported',
        data: { filePath },
      });

      logger.info('Metrics exported from dashboard', { filePath });
    } catch (error) {
      this.sendToClient(ws, {
        type: 'error',
        data: { message: (error as Error).message },
      });
    }
  }

  /**
   * Handle clear logs command
   */
  private handleClearLogs(ws: WebSocket): void {
    // Implementation would depend on your logging setup
    this.sendToClient(ws, {
      type: 'logsCleared',
      data: { timestamp: Date.now() },
    });
  }

  /**
   * Start broadcasting metrics to connected clients
   */
  private startMetricsBroadcast(): void {
    this.metricsInterval = setInterval(() => {
      if (this.clients.size > 0) {
        const metrics = this.getCurrentMetrics();

        this.broadcast({
          type: 'metrics',
          data: metrics,
        });
      }
    }, 5000); // Every 5 seconds
  }

  /**
   * Get current system metrics
   */
  private getCurrentMetrics(): any {
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();

    return {
      timestamp: Date.now(),
      memory: {
        rss: Math.round(memory.rss / 1024 / 1024),
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        external: Math.round(memory.external / 1024 / 1024),
      },
      cpu: {
        user: cpu.user,
        system: cpu.system,
      },
      uptime: process.uptime(),
      traceId: lt3Tracing.getCurrentTraceId(),
      profiler: lt3Profiler.getMetricsSummary(),
    };
  }

  /**
   * Get recent logs (placeholder - integrate with your logging system)
   */
  private getRecentLogs(): any[] {
    // This would integrate with your actual logging system
    return [
      {
        timestamp: Date.now(),
        level: 'info',
        message: 'Sample log entry',
        component: 'dashboard',
      },
    ];
  }

  /**
   * Get available profiles
   */
  private getAvailableProfiles(): any {
    // This would scan the profiles directory
    return {
      cpu: [],
      heap: [],
      exports: [],
    };
  }

  /**
   * Send message to specific client
   */
  private sendToClient(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: any): void {
    const data = JSON.stringify(message);

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  /**
   * Get embedded HTML for dashboard
   */
  private getEmbeddedHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Law Transcribed - Debug Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            background: #0d1117;
            color: #c9d1d9;
            line-height: 1.6;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header {
            border-bottom: 1px solid #30363d;
            padding-bottom: 20px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .header h1 { color: #58a6ff; font-size: 24px; }
        .status { display: flex; gap: 20px; }
        .status-item {
            background: #21262d;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
        }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .panel {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 20px;
        }
        .panel h3 {
            color: #f0f6fc;
            margin-bottom: 15px;
            font-size: 16px;
            border-bottom: 1px solid #30363d;
            padding-bottom: 8px;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 14px;
        }
        .metric-label { color: #8b949e; }
        .metric-value { color: #f0f6fc; font-weight: bold; }
        .button {
            background: #238636;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            margin-right: 8px;
        }
        .button:hover { background: #2ea043; }
        .button.danger { background: #da3633; }
        .button.danger:hover { background: #f85149; }
        .log-entry {
            padding: 8px;
            border-bottom: 1px solid #21262d;
            font-size: 12px;
            word-break: break-all;
        }
        .log-error { color: #f85149; }
        .log-warn { color: #d29922; }
        .log-info { color: #58a6ff; }
        .log-debug { color: #7c3aed; }
        .chart {
            height: 150px;
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 4px;
            position: relative;
            overflow: hidden;
        }
        .connected { color: #7c3aed; }
        .disconnected { color: #f85149; }
        #logs { max-height: 400px; overflow-y: auto; }
        .actions { margin-bottom: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 Law Transcribed Debug Dashboard</h1>
            <div class="status">
                <div class="status-item">
                    <span id="connection-status" class="disconnected">Disconnected</span>
                </div>
                <div class="status-item">
                    Uptime: <span id="uptime">0s</span>
                </div>
                <div class="status-item">
                    Trace: <span id="trace-id">none</span>
                </div>
            </div>
        </div>

        <div class="grid">
            <div class="panel">
                <h3>📊 System Metrics</h3>
                <div id="system-metrics">
                    <div class="metric">
                        <span class="metric-label">Memory (RSS):</span>
                        <span class="metric-value" id="memory-rss">0 MB</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Heap Used:</span>
                        <span class="metric-value" id="heap-used">0 MB</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Heap Total:</span>
                        <span class="metric-value" id="heap-total">0 MB</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">CPU User:</span>
                        <span class="metric-value" id="cpu-user">0μs</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">CPU System:</span>
                        <span class="metric-value" id="cpu-system">0μs</span>
                    </div>
                </div>
            </div>

            <div class="panel">
                <h3>🔧 Profiling Controls</h3>
                <div class="actions">
                    <button class="button" onclick="startCPUProfile()">Start CPU Profile</button>
                    <button class="button danger" onclick="stopCPUProfile()">Stop CPU Profile</button>
                    <button class="button" onclick="takeHeapSnapshot()">Heap Snapshot</button>
                    <button class="button" onclick="exportMetrics()">Export Metrics</button>
                </div>
                <div id="profile-status">Ready</div>
            </div>
        </div>

        <div class="grid">
            <div class="panel">
                <h3>📈 Memory Usage Chart</h3>
                <canvas id="memory-chart" class="chart" width="400" height="150"></canvas>
            </div>

            <div class="panel">
                <h3>🔄 Performance Summary</h3>
                <div id="performance-summary">
                    <div class="metric">
                        <span class="metric-label">Avg Response Time:</span>
                        <span class="metric-value" id="avg-response">0ms</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Requests/min:</span>
                        <span class="metric-value" id="requests-per-min">0</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Active Connections:</span>
                        <span class="metric-value" id="active-connections">0</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="panel">
            <h3>📝 Debug Logs</h3>
            <div class="actions">
                <button class="button" onclick="clearLogs()">Clear Logs</button>
                <button class="button" onclick="toggleLogLevel()">Toggle Level</button>
            </div>
            <div id="logs"></div>
        </div>
    </div>

    <script>
        let ws = null;
        let currentProfileId = null;
        let memoryData = [];
        let logLevel = 'info';

        // Initialize dashboard
        function init() {
            connectWebSocket();
            setupMemoryChart();
        }

        // WebSocket connection
        function connectWebSocket() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = protocol + '//' + window.location.host + '/';

            ws = new WebSocket(wsUrl);

            ws.onopen = function() {
                document.getElementById('connection-status').textContent = 'Connected';
                document.getElementById('connection-status').className = 'connected';
            };

            ws.onmessage = function(event) {
                const message = JSON.parse(event.data);
                handleMessage(message);
            };

            ws.onclose = function() {
                document.getElementById('connection-status').textContent = 'Disconnected';
                document.getElementById('connection-status').className = 'disconnected';

                // Retry connection after 5 seconds
                setTimeout(connectWebSocket, 5000);
            };

            ws.onerror = function(error) {
                console.error('WebSocket error:', error);
            };
        }

        // Handle WebSocket messages
        function handleMessage(message) {
            switch(message.type) {
                case 'welcome':
                    handleWelcome(message.data);
                    break;
                case 'metrics':
                    updateMetrics(message.data);
                    break;
                case 'cpuProfileStarted':
                    currentProfileId = message.data.profileId;
                    document.getElementById('profile-status').textContent = 'CPU Profile Running...';
                    break;
                case 'cpuProfileStopped':
                    currentProfileId = null;
                    document.getElementById('profile-status').textContent = 'Profile saved: ' + message.data.filePath;
                    break;
                case 'heapSnapshotTaken':
                    document.getElementById('profile-status').textContent = 'Heap snapshot: ' + message.data.filePath;
                    break;
                case 'error':
                    document.getElementById('profile-status').textContent = 'Error: ' + message.data.message;
                    break;
            }
        }

        // Handle welcome message
        function handleWelcome(data) {
            document.getElementById('uptime').textContent = Math.round(data.uptime) + 's';
        }

        // Update system metrics
        function updateMetrics(data) {
            document.getElementById('memory-rss').textContent = data.memory.rss + ' MB';
            document.getElementById('heap-used').textContent = data.memory.heapUsed + ' MB';
            document.getElementById('heap-total').textContent = data.memory.heapTotal + ' MB';
            document.getElementById('cpu-user').textContent = data.cpu.user + 'μs';
            document.getElementById('cpu-system').textContent = data.cpu.system + 'μs';
            document.getElementById('uptime').textContent = Math.round(data.uptime) + 's';

            if (data.traceId) {
                document.getElementById('trace-id').textContent = data.traceId.substring(0, 8);
            }

            // Update memory chart
            updateMemoryChart(data.memory.heapUsed);
        }

        // Memory chart setup
        function setupMemoryChart() {
            const canvas = document.getElementById('memory-chart');
            const ctx = canvas.getContext('2d');

            // Initial empty chart
            ctx.fillStyle = '#0d1117';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Update memory chart
        function updateMemoryChart(heapUsed) {
            memoryData.push(heapUsed);
            if (memoryData.length > 50) {
                memoryData.shift();
            }

            const canvas = document.getElementById('memory-chart');
            const ctx = canvas.getContext('2d');

            // Clear canvas
            ctx.fillStyle = '#0d1117';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (memoryData.length < 2) return;

            // Draw chart
            const max = Math.max(...memoryData);
            const min = Math.min(...memoryData);
            const range = max - min || 1;

            ctx.strokeStyle = '#58a6ff';
            ctx.lineWidth = 2;
            ctx.beginPath();

            for (let i = 0; i < memoryData.length; i++) {
                const x = (i / (memoryData.length - 1)) * canvas.width;
                const y = canvas.height - ((memoryData[i] - min) / range) * canvas.height;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }

            ctx.stroke();
        }

        // Profiling controls
        function startCPUProfile() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'startCPUProfile',
                    data: { id: 'dashboard-' + Date.now() }
                }));
            }
        }

        function stopCPUProfile() {
            if (ws && ws.readyState === WebSocket.OPEN && currentProfileId) {
                ws.send(JSON.stringify({
                    type: 'stopCPUProfile',
                    data: { profileId: currentProfileId }
                }));
            }
        }

        function takeHeapSnapshot() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'takeHeapSnapshot',
                    data: {}
                }));
            }
        }

        function exportMetrics() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'exportMetrics',
                    data: {}
                }));
            }
        }

        function clearLogs() {
            document.getElementById('logs').innerHTML = '';
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'clearLogs',
                    data: {}
                }));
            }
        }

        function toggleLogLevel() {
            const levels = ['debug', 'info', 'warn', 'error'];
            const currentIndex = levels.indexOf(logLevel);
            logLevel = levels[(currentIndex + 1) % levels.length];
            document.getElementById('profile-status').textContent = 'Log level: ' + logLevel;
        }

        // Initialize when page loads
        window.onload = init;
    </script>
</body>
</html>
    `;
  }
}

// Global dashboard instance
export const lt3Dashboard = new LT3DebugDashboard();

// Auto-start dashboard in development
if (process.env.NODE_ENV === 'development' && process.env.ENABLE_DEBUG_DASHBOARD === 'true') {
  lt3Dashboard.start().catch((error) => {
    logger.error('Failed to start debug dashboard', { error: error.message });
  });
}

export default lt3Dashboard;