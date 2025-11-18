const { spawn, exec } = require('child_process');
const net = require('net');
const http = require('http');

// Importamos fs y path para manipular el login.html
const fs = require('fs');
const path = require('path');

function checkPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => { srv.close?.(); resolve(false); });
    srv.once('listening', () => { srv.close(() => resolve(true)); });
    srv.listen(port, '0.0.0.0');
  });
}

async function pickPort(candidates) {
  for (const p of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await checkPortFree(p);
    if (ok) return p;
  }
  throw new Error('No free ports found in range');
}

function waitForUrl(url, timeout = 10000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, (res) => {
        resolve(true);
      }).on('error', () => {
        if (Date.now() - start > timeout) return reject(new Error('timeout'));
        setTimeout(check, 300);
      });
    };
    check();
  });
}

async function main() {
  try {
  const staticPort = await pickPort([8080, 8081, 8082, 8083]);

    console.log('\n[START] INICIANDO LOGIN PREDETERMINADO...');
  console.log(`Using static server port: ${staticPort}`);
    
    // Nota: no se inyecta automáticamente la configuración de la API en los archivos HTML
    // para evitar sobrescribir configuraciones de producción. Configure la URL del backend
    // mediante variables de entorno en el despliegue (ej. Vercel) o usando `vercel dev`
    // cuando sea estrictamente necesario para desarrollo.

    // This simplified starter only launches a static server for preview.

  // Start static server via npx http-server, serving the src/pages folder so URLs match the project layout
  // Preferir binario local en node_modules/.bin
  const path = require('path');
  const binName = process.platform === 'win32' ? 'http-server.cmd' : 'http-server';
  const localBin = path.join(__dirname, 'node_modules', '.bin', binName);
    const fs = require('fs');
    const hasLocal = fs.existsSync(localBin);
    let staticSrv;
    // Serve the project root (cwd=__dirname) so all folders under src/ are reachable
    if (process.platform === 'win32') {
      if (hasLocal) {
        // Execute the local .cmd via cmd.exe /c to avoid spawn EINVAL
  staticSrv = spawn('cmd.exe', ['/c', localBin, 'src', '-c-1', '-p', String(staticPort)], { stdio: 'inherit', cwd: __dirname });
      } else {
        // fallback to npx.cmd
  staticSrv = spawn('cmd.exe', ['/c', 'npx.cmd', 'http-server', 'src', '-c-1', '-p', String(staticPort)], { stdio: 'inherit', cwd: __dirname });
      }
    } else {
      const staticCmd = hasLocal ? localBin : 'npx';
  const staticArgs = hasLocal ? ['src','-c-1','-p', String(staticPort)] : ['http-server','src','-c-1','-p', String(staticPort)];
      staticSrv = spawn(staticCmd, staticArgs, { shell: false, stdio: 'inherit', cwd: __dirname });
    }

    staticSrv.on('exit', (code) => {
      console.log(`http-server exited with ${code}`);
    });

    // Wait until static server serves the login page
  const url = `http://127.0.0.1:${staticPort}/pages/login.html`;
    console.log(`Waiting for ${url} ...`);
    await waitForUrl(url, 10000).catch(() => { /* continue even if timeout */ });

    // Open browser
    const openUrl = url;
  console.log('\n[OK] Servidor iniciado! Abriendo navegador en: ' + openUrl);
  console.log('Frontend: http://localhost:' + staticPort);
  console.log('\nPresiona Ctrl+C para detener el servidor\n');
    
    if (process.platform === 'win32') {
      exec(`start "" "${openUrl}"`);
    } else if (process.platform === 'darwin') {
      exec(`open "${openUrl}"`);
    } else {
      exec(`xdg-open "${openUrl}"`);
    }

    // Clean up on exit
    const cleanup = () => {
      try { staticSrv.kill(); } catch (e) {}
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

  } catch (err) {
    console.error('Failed to start services:', err);
    process.exit(1);
  }
}

// injectApiConfig removed - configuration should be set in deployment environment

main();
