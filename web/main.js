async function fileToSha256Hex(file) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function buildPowerShellOneLiner({ url, fileName, sha256, args }) {
  // Use a robust single-line PowerShell command that:
  // - downloads with System.Net.Http.HttpClient
  // - saves to %TEMP% or current directory with specified filename
  // - verifies SHA-256 if provided
  // - asks for consent (Y/N)
  // - executes with optional args
  // - cleans up the client
  const ps = [];
  ps.push("$ErrorActionPreference='Stop'");
  ps.push("$u=\"" + url + "\"");
  ps.push("$fn=\"" + fileName + "\"" );
  ps.push("$p=Join-Path $pwd $fn");
  ps.push("$cli=New-Object System.Net.Http.HttpClient");
  ps.push("$resp=$cli.GetAsync($u).Result; if(-not $resp.IsSuccessStatusCode){throw \"HTTP \"+$resp.StatusCode}" );
  ps.push("[IO.File]::WriteAllBytes($p,$resp.Content.ReadAsByteArrayAsync().Result)" );
  if (sha256) {
    ps.push("$h=[BitConverter]::ToString((Get-FileHash -Algorithm SHA256 -Path $p).Hash).Replace('-','').ToLower()" );
    ps.push("if($h -ne '" + sha256 + "'){throw \"SHA256 mismatch\"}" );
  }
  ps.push("$cli.Dispose()" );
  ps.push("$ans=Read-Host 'Run downloaded file now? (Y/N)'");
  ps.push("if($ans -match '^[Yy]'){Start-Process -FilePath $p" + (args ? " -ArgumentList \"" + args + "\"" : "") + " -Wait}" );

  // Wrap in powershell invocation suitable for cmd.exe. Use -EncodedCommand to avoid quoting pitfalls.
  const script = ps.join('; ');
  const bytes = new TextEncoder().encode(script);
  const base64 = btoa(String.fromCharCode(...bytes));
  const cmdLine = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${base64}`;
  return cmdLine;
}

function generate() {
  const url = document.getElementById('fileUrl').value.trim();
  let fileName = document.getElementById('fileName').value.trim();
  const sha256 = document.getElementById('sha256').value.trim().toLowerCase();
  const addArgs = document.getElementById('addArgs').checked;
  const execArgs = document.getElementById('execArgs').value.trim();

  if (!url) {
    alert('Please enter a file URL.');
    return;
  }
  if (!fileName) {
    try {
      const u = new URL(url);
      fileName = u.pathname.split('/').filter(Boolean).pop() || 'download.bin';
    } catch {
      fileName = 'download.bin';
    }
  }

  let args = '';
  if (addArgs && execArgs) {
    args = execArgs.replace(/\"/g, '');
  }

  const cmd = buildPowerShellOneLiner({ url, fileName, sha256, args });
  const out = document.getElementById('output');
  out.textContent = cmd;
  document.getElementById('copyBtn').disabled = !cmd;
}

window.addEventListener('DOMContentLoaded', () => {
  const addArgs = document.getElementById('addArgs');
  const execArgs = document.getElementById('execArgs');
  addArgs.addEventListener('change', () => {
    execArgs.disabled = !addArgs.checked;
    if (!addArgs.checked) execArgs.value = '';
  });

  document.getElementById('genBtn').addEventListener('click', generate);
  document.getElementById('copyBtn').addEventListener('click', async () => {
    const out = document.getElementById('output').textContent;
    if (!out) return;
    try {
      await navigator.clipboard.writeText(out);
      alert('Copied!');
    } catch (e) {
      alert('Copy failed. Select and copy manually.');
    }
  });

  const fileInput = document.getElementById('localFileForHash');
  const shaField = document.getElementById('sha256');
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    shaField.value = 'calculating...';
    try {
      const h = await fileToSha256Hex(f);
      shaField.value = h;
    } catch (e) {
      shaField.value = '';
      alert('Failed to compute hash: ' + e);
    }
  });
});
