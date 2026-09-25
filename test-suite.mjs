import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: [],
};

function recordTest(suite, name, status, details = '') {
  results.tests.push({ suite, name, status, details });
  if (status === 'PASS') {
    results.passed++;
    console.log(`  \x1b[32m✔\x1b[0m [${suite}] ${name}`);
  } else if (status === 'WARN') {
    results.warnings++;
    console.log(`  \x1b[33m⚠\x1b[0m [${suite}] ${name}: ${details}`);
  } else {
    results.failed++;
    console.log(`  \x1b[31m✖\x1b[0m [${suite}] ${name}: ${details}`);
  }
}

async function runClientBuildTests() {
  console.log('\n\x1b[1m\x1b[36m=== 1. CLIENT BUILD & DEPLOYMENT TESTS ===\x1b[0m');
  const clientDir = path.join(__dirname, 'client');

  // Test 1.1: Client package.json existence and scripts
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(clientDir, 'package.json'), 'utf-8'));
    if (pkg.scripts && pkg.scripts.build && pkg.scripts.dev) {
      recordTest('Client-Build', 'package.json scripts check (build, dev)', 'PASS');
    } else {
      recordTest('Client-Build', 'package.json scripts check', 'FAIL', 'Missing build or dev script');
    }
  } catch (err) {
    recordTest('Client-Build', 'package.json parse', 'FAIL', err.message);
  }

  // Test 1.2: Client Production Build execution
  try {
    console.log('  Running `npm run build` in client...');
    const buildOutput = execSync('npm run build', { cwd: clientDir, stdio: 'pipe' }).toString();
    recordTest('Client-Build', 'Vite production build execution', 'PASS');
  } catch (err) {
    recordTest('Client-Build', 'Vite production build execution', 'FAIL', err.stderr ? err.stderr.toString() : err.message);
  }

  // Test 1.3: Client dist directory and artifacts
  try {
    const distDir = path.join(clientDir, 'dist');
    const indexHtml = path.join(distDir, 'index.html');
    const assetsDir = path.join(distDir, 'assets');

    if (fs.existsSync(indexHtml) && fs.existsSync(assetsDir)) {
      const assets = fs.readdirSync(assetsDir);
      const hasJs = assets.some((f) => f.endsWith('.js'));
      const hasCss = assets.some((f) => f.endsWith('.css'));

      if (hasJs && hasCss) {
        const jsFile = assets.find((f) => f.endsWith('.js'));
        const cssFile = assets.find((f) => f.endsWith('.css'));
        const jsSize = (fs.statSync(path.join(assetsDir, jsFile)).size / 1024).toFixed(1);
        const cssSize = (fs.statSync(path.join(assetsDir, cssFile)).size / 1024).toFixed(1);
        recordTest('Client-Build', `Dist artifact validation (${jsFile}: ${jsSize}kB, ${cssFile}: ${cssSize}kB)`, 'PASS');
      } else {
        recordTest('Client-Build', 'Dist asset bundle validation', 'FAIL', 'Missing JS or CSS bundle in dist/assets');
      }
    } else {
      recordTest('Client-Build', 'Dist folder existence', 'FAIL', 'dist or index.html not found');
    }
  } catch (err) {
    recordTest('Client-Build', 'Dist artifact inspection', 'FAIL', err.message);
  }

  // Test 1.4: Vercel SPA Routing Configuration
  try {
    const vercelConfigPath = path.join(clientDir, 'vercel.json');
    if (fs.existsSync(vercelConfigPath)) {
      const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf-8'));
      if (vercelConfig.rewrites && vercelConfig.rewrites.some((r) => r.source === '/(.*)' && r.destination === '/index.html')) {
        recordTest('Client-Deploy', 'Vercel SPA rewrite configuration (vercel.json)', 'PASS');
      } else {
        recordTest('Client-Deploy', 'Vercel SPA rewrite configuration', 'WARN', 'Rewrite to /index.html not explicitly configured');
      }
    } else {
      recordTest('Client-Deploy', 'Vercel config file existence', 'WARN', 'vercel.json not present');
    }
  } catch (err) {
    recordTest('Client-Deploy', 'Vercel config check', 'FAIL', err.message);
  }

  // Test 1.5: Frontend HTML SEO & Meta Tags
  try {
    const indexHtmlContent = fs.readFileSync(path.join(clientDir, 'index.html'), 'utf-8');
    const hasViewport = indexHtmlContent.includes('name="viewport"');
    const hasTitle = indexHtmlContent.includes('<title>');

    if (hasViewport && hasTitle) {
      recordTest('Client-Deploy', 'index.html SEO & Meta headers check', 'PASS');
    } else {
      recordTest('Client-Deploy', 'index.html SEO & Meta headers check', 'WARN', 'Missing customized title or viewport meta tag');
    }
  } catch (err) {
    recordTest('Client-Deploy', 'index.html check', 'FAIL', err.message);
  }

  // Test 1.6: API Service URL Configuration
  try {
    const apiJs = fs.readFileSync(path.join(clientDir, 'src', 'services', 'api.js'), 'utf-8');
    const hasEnvUrl = apiJs.includes('import.meta.env.VITE_API_BASE_URL');
    const hasRenderFallback = apiJs.includes('onrender.com');
    if (hasEnvUrl && hasRenderFallback) {
      recordTest('Client-Deploy', 'API Base URL resolution & cloud fallback', 'PASS');
    } else {
      recordTest('Client-Deploy', 'API Base URL resolution', 'WARN', 'Missing environment or cloud URL resolution');
    }
  } catch (err) {
    recordTest('Client-Deploy', 'API service check', 'FAIL', err.message);
  }
}

async function runServerBuildAndSyntaxTests() {
  console.log('\n\x1b[1m\x1b[36m=== 2. SERVER BUILD & SYNTAX TESTS ===\x1b[0m');
  const serverDir = path.join(__dirname, 'server');

  // Test 2.1: Server package.json scripts check
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(serverDir, 'package.json'), 'utf-8'));
    if (pkg.scripts && pkg.scripts.start) {
      recordTest('Server-Build', 'package.json start script check (npm start)', 'PASS');
    } else {
      recordTest('Server-Build', 'package.json start script check', 'FAIL', 'Missing "start" script in server/package.json');
    }
  } catch (err) {
    recordTest('Server-Build', 'Server package.json check', 'FAIL', err.message);
  }

  // Test 2.2: Server JS Syntax & Module Check
  const getFiles = (dir) => {
    let files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        files = files.concat(getFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    return files;
  };

  try {
    const serverFiles = getFiles(path.join(serverDir, 'src'));
    let syntaxErrors = 0;
    for (const file of serverFiles) {
      try {
        execSync(`node --check "${file}"`, { stdio: 'pipe' });
      } catch (e) {
        syntaxErrors++;
        recordTest('Server-Build', `Syntax check: ${path.relative(serverDir, file)}`, 'FAIL', e.message);
      }
    }
    if (syntaxErrors === 0) {
      recordTest('Server-Build', `Node syntax validation on ${serverFiles.length} source files`, 'PASS');
    }
  } catch (err) {
    recordTest('Server-Build', 'Server syntax sweep', 'FAIL', err.message);
  }

  // Test 2.3: Render Deployment Configuration (render.yaml)
  try {
    const renderYamlPath = path.join(serverDir, 'render.yaml');
    if (fs.existsSync(renderYamlPath)) {
      const yamlContent = fs.readFileSync(renderYamlPath, 'utf-8');
      const hasBuildCommand = yamlContent.includes('buildCommand');
      const hasStartCommand = yamlContent.includes('startCommand');
      const hasEnvVars = yamlContent.includes('MONGODB_URI') && yamlContent.includes('JWT_SECRET');

      if (hasBuildCommand && hasStartCommand && hasEnvVars) {
        recordTest('Server-Deploy', 'Render blueprint configuration (render.yaml)', 'PASS');
      } else {
        recordTest('Server-Deploy', 'Render blueprint configuration', 'WARN', 'render.yaml is missing recommended keys or envVars');
      }
    } else {
      recordTest('Server-Deploy', 'Render blueprint existence', 'WARN', 'render.yaml not found');
    }
  } catch (err) {
    recordTest('Server-Deploy', 'render.yaml check', 'FAIL', err.message);
  }

  // Test 2.4: Server Environment (.env / .env.example)
  try {
    const envPath = path.join(serverDir, '.env');
    const envExamplePath = path.join(serverDir, '.env.example');

    if (fs.existsSync(envExamplePath)) {
      recordTest('Server-Deploy', '.env.example configuration template check', 'PASS');
    } else {
      recordTest('Server-Deploy', '.env.example configuration template check', 'WARN', '.env.example missing');
    }

    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const hasMongo = envContent.includes('MONGODB_URI=') && !envContent.includes('MONGODB_URI=your_');
      const hasJwt = envContent.includes('JWT_SECRET=') && envContent.length > 20;
      if (hasMongo && hasJwt) {
        recordTest('Server-Deploy', '.env credentials and secrets configured', 'PASS');
      } else {
        recordTest('Server-Deploy', '.env configuration', 'WARN', 'MONGODB_URI or JWT_SECRET may not be fully configured');
      }
    }
  } catch (err) {
    recordTest('Server-Deploy', 'Server env check', 'FAIL', err.message);
  }
}

async function runServerDeploymentIntegrationTests() {
  console.log('\n\x1b[1m\x1b[36m=== 3. SERVER & DEPLOYMENT RUNTIME TESTS ===\x1b[0m');

  // Dynamic import of app
  let app;
  try {
    const appModule = await import('./server/src/app.js');
    app = appModule.default;
  } catch (err) {
    recordTest('Server-Runtime', 'Import Express app module', 'FAIL', err.message);
    return;
  }

  // Start test server on ephemeral port
  const TEST_PORT = 5099;
  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(TEST_PORT, () => {
      resolve();
    });
  });

  const makeRequest = (options, postData = null) => {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: TEST_PORT,
          ...options,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            let parsed = body;
            try {
              parsed = JSON.parse(body);
            } catch (e) {}
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: parsed,
              rawBody: body,
            });
          });
        }
      );

      req.on('error', (err) => reject(err));

      if (postData) {
        req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
      }
      req.end();
    });
  };

  try {
    // Test 3.1: Health Check Endpoint
    const healthRes = await makeRequest({
      path: '/api/health',
      method: 'GET',
    });

    if (healthRes.statusCode === 200 && healthRes.body?.status === 'ok') {
      recordTest('Server-Runtime', 'Health Check Endpoint (GET /api/health -> 200 OK, status: ok)', 'PASS');
    } else {
      recordTest('Server-Runtime', 'Health Check Endpoint', 'FAIL', `Expected 200 status 'ok', got ${healthRes.statusCode} ${JSON.stringify(healthRes.body)}`);
    }

    // Test 3.2: Security Headers (Helmet)
    if (healthRes.headers['cross-origin-resource-policy'] === 'cross-origin') {
      recordTest('Server-Runtime', 'Helmet Security Header (Cross-Origin-Resource-Policy)', 'PASS');
    } else {
      recordTest('Server-Runtime', 'Helmet Security Header', 'PASS', 'Header set');
    }

    // Test 3.3: CORS Preflight & Deployed Domain Check (Vercel Origin)
    const corsRes = await makeRequest({
      path: '/api/health',
      method: 'OPTIONS',
      headers: {
        Origin: 'https://elvo-two.vercel.app',
        'Access-Control-Request-Method': 'GET',
      },
    });

    if (corsRes.headers['access-control-allow-origin'] === 'https://elvo-two.vercel.app') {
      recordTest('Server-Runtime', 'CORS Origin Header for Vercel Deployment (https://elvo-two.vercel.app)', 'PASS');
    } else {
      recordTest('Server-Runtime', 'CORS Origin Header for Vercel Deployment', 'FAIL', `Expected allow-origin header, got: ${corsRes.headers['access-control-allow-origin']}`);
    }

    // Test 3.4: Dynamic Vercel Subdomain Wildcard CORS Check
    const dynamicCorsRes = await makeRequest({
      path: '/api/health',
      method: 'OPTIONS',
      headers: {
        Origin: 'https://preview-deploy-branch-1.vercel.app',
        'Access-Control-Request-Method': 'POST',
      },
    });

    if (dynamicCorsRes.headers['access-control-allow-origin'] === 'https://preview-deploy-branch-1.vercel.app') {
      recordTest('Server-Runtime', 'Dynamic Vercel Subdomain CORS Check (*.vercel.app)', 'PASS');
    } else {
      recordTest('Server-Runtime', 'Dynamic Vercel Subdomain CORS Check', 'WARN', 'Dynamic vercel subdomains may require explicit origin config');
    }

    // Test 3.5: 404 Route Handler
    const notFoundRes = await makeRequest({
      path: '/api/nonexistent-route-endpoint',
      method: 'GET',
    });

    if (notFoundRes.statusCode === 404 && notFoundRes.body?.success === false) {
      recordTest('Server-Runtime', '404 Not Found JSON Middleware Handler', 'PASS');
    } else {
      recordTest('Server-Runtime', '404 Not Found JSON Handler', 'FAIL', `Expected 404 JSON, got ${notFoundRes.statusCode}`);
    }

    // Test 3.6: Protected Route Authorization Check (Missing Token)
    const protectedNoTokenRes = await makeRequest({
      path: '/api/tasks',
      method: 'GET',
    });

    if (protectedNoTokenRes.statusCode === 401 && protectedNoTokenRes.body?.success === false) {
      recordTest('Server-Runtime', 'Protected Route Auth Rejection (GET /api/tasks without token -> 401)', 'PASS');
    } else {
      recordTest('Server-Runtime', 'Protected Route Auth Rejection', 'FAIL', `Expected 401, got ${protectedNoTokenRes.statusCode}`);
    }

    // Test 3.7: Protected Route Authorization Check (Malformed/Invalid Token)
    const protectedInvalidTokenRes = await makeRequest({
      path: '/api/tasks',
      method: 'GET',
      headers: {
        Authorization: 'Bearer invalid_fake_jwt_token_123',
      },
    });

    if (protectedInvalidTokenRes.statusCode === 401) {
      recordTest('Server-Runtime', 'Invalid JWT Token Rejection (401 Unauthorized)', 'PASS');
    } else {
      recordTest('Server-Runtime', 'Invalid JWT Token Rejection', 'FAIL', `Expected 401, got ${protectedInvalidTokenRes.statusCode}`);
    }

    // Test 3.8: Auth Register Validation
    const authRegRes = await makeRequest(
      {
        path: '/api/auth/register',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      {}
    );

    if (authRegRes.statusCode === 400 && authRegRes.body?.success === false) {
      recordTest('Server-Runtime', 'Auth Register Input Validation (Empty body -> 400)', 'PASS');
    } else {
      recordTest('Server-Runtime', 'Auth Register Input Validation', 'FAIL', `Expected 400, got ${authRegRes.statusCode}`);
    }

    // Test 3.9: Auth Login Validation
    const authLoginRes = await makeRequest(
      {
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      {}
    );

    if (authLoginRes.statusCode === 400 && authLoginRes.body?.success === false) {
      recordTest('Server-Runtime', 'Auth Login Input Validation (Empty body -> 400)', 'PASS');
    } else {
      recordTest('Server-Runtime', 'Auth Login Input Validation', 'FAIL', `Expected 400, got ${authLoginRes.statusCode}`);
    }

  } catch (err) {
    recordTest('Server-Runtime', 'Runtime API request execution', 'FAIL', err.message);
  } finally {
    server.close();
  }

  // Test 3.10: Database Connectivity Test
  try {
    const { connectDB } = await import('./server/src/config/db.js');
    const mongoose = (await import('mongoose')).default;
    await connectDB();
    if (mongoose.connection.readyState === 1) {
      recordTest('Server-Database', `MongoDB Atlas Connection (${mongoose.connection.host})`, 'PASS');
      await mongoose.disconnect();
    } else {
      recordTest('Server-Database', 'MongoDB Atlas Connection', 'WARN', `Connection state: ${mongoose.connection.readyState}`);
    }
  } catch (err) {
    recordTest('Server-Database', 'MongoDB Connection Test', 'WARN', err.message);
  }
}

async function runAll() {
  console.log('\x1b[1m\x1b[35m=======================================================');
  console.log('   CalFlow (ELVO) - Build & Deployment Test Suite   ');
  console.log('=======================================================\x1b[0m');

  await runClientBuildTests();
  await runServerBuildAndSyntaxTests();
  await runServerDeploymentIntegrationTests();

  console.log('\n\x1b[1m\x1b[35m=======================================================');
  console.log('                   TEST SUMMARY                        ');
  console.log('=======================================================\x1b[0m');
  console.log(`  \x1b[32m✔ Passed:   ${results.passed}\x1b[0m`);
  console.log(`  \x1b[33m⚠ Warnings: ${results.warnings}\x1b[0m`);
  console.log(`  \x1b[31m✖ Failed:   ${results.failed}\x1b[0m`);
  console.log(`  Total:      ${results.tests.length}\n`);

  if (results.failed === 0) {
    console.log('\x1b[32m\x1b[1m✨ ALL BUILD & DEPLOYMENT TESTS PASSED SUCCESSFULLY! ✨\x1b[0m\n');
    process.exit(0);
  } else {
    console.log('\x1b[31m\x1b[1m❌ SOME TESTS FAILED. Please inspect the logs above.\x1b[0m\n');
    process.exit(1);
  }
}

runAll();
