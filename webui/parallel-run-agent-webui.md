# Book Writer Assistant - Sync & Session Architecture Summary

## 📌 Conversation Summary
We designed an architecture to connect a local **Node.js/Express web application** with a **visible desktop PowerShell window** running local coding CLI agents (`claude` or `opencode`). 

### Key Milestones Covered:
1. **Initial Concept:** Explored bridging terminal CLI tools into a browser app using WebSockets, weighing the pros/cons of terminal engines like `Xterm.js` versus zero-code solutions like `ttyd`.
2. **Synchronization Focus:** Shifted away from terminal UI visuals to prioritize **bidirectional sync data sharing**. You needed the web dashboard to instantly receive outputs from the CLI session and feed prompt payloads back.
3. **True Window Visibility:** Resolved the restriction where child processes hide the UI by executing an explicit Windows `start powershell.exe` command wrapper. This forces a physical window onto your desktop monitor so you can use both the CLI and web panel simultaneously.
4. **Session Persistence Integration:** Factored in how local agents save states. We introduced a local JSON registry system (`books.json`) mapping a custom book title to its respective persistent unique CLI `--continue <session_id>` flag configuration. Clicking a saved book on your dashboard seamlessly spins up the exact old workspace context without data loss.

---
The web app is functioning as a rich, decoupled frontend UI wrapper for those CLI tools.
Instead of relying on the standard text-only console layout, you are effectively using claude or opencode as a headless "backend engine" to do the heavy lifting (the book writing and structural coding), while your Node.js application serves as a visual control deck.
By structuring it this way, you gain several massive advantages over a standard terminal user:
• Visual Timelines: Instead of scrolling through miles of messy terminal text, your web app can parse the agent's output and organize it visually into clean sections like Chapter Lists, Character Profiles, or Plot Outlines.
• Hybrid Workflows: You can comfortably write prose or view structural timelines in your beautiful web dashboard, but if you ever need to run a quick, manual command, debug something raw, or look at errors, you can glance right over at the physical PowerShell window running beside it.
• No Rigid APIs: You don’t have to pay for individual API token calls or build complex custom logic to handle conversational context. You are simply letting the official, mature CLI tools handle the conversation memory locally on your machine while you customize the way it looks.

## 💻 Complete Code Architecture Component Bundle

Below are the three latest code elements containing the unified sync server, PowerShell runner, and frontend interface tracking logic.

### 1. Express Backend Relay Server (`server.js`)
```javascript
const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());

const BOOKS_JSON_PATH = path.join(__dirname, 'books.json');

// Initialize books.json registry file if not present
if (!fs.existsSync(BOOKS_JSON_PATH)) {
  fs.writeFileSync(BOOKS_JSON_PATH, JSON.stringify([], null, 2));
}

let cliSocket = null; // Channel connection to the visible PowerShell CLI
let webSocket = null; // Channel connection to the browser web dashboard

wss.on('connection', (ws, req) => {
  if (req.url === '/web') {
    webSocket = ws;
    console.log('Web Dashboard client connected.');
    ws.on('message', (message) => {
      // Forward text inputs typed on web app directly to PowerShell agent
      if (cliSocket && cliSocket.readyState === WebSocket.OPEN) {
        cliSocket.send(message.toString());
      }
    });
  } 
  if (req.url === '/cli') {
    cliSocket = ws;
    console.log('Visible PowerShell session connected.');
    ws.on('message', (message) => {
      // Broadcast text outputs arriving from agent session to the web visualization
      if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        webSocket.send(JSON.stringify({ type: 'agent_output', data: message.toString() }));
      }
    });
  }
});

// Endpoint 1: Fetch the saved shelf list for UI rendering
app.get('/api/books', (req, res) => {
  const books = JSON.parse(fs.readFileSync(BOOKS_JSON_PATH, 'utf8'));
  res.json(books);
});

// Endpoint 2: Spin up/continue a targeted agent session
app.post('/api/start-agent', (req, res) => {
  const { agent, title, sessionId, isContinue } = req.body;

  if (!agent || !title) {
    return res.status(400).json({ error: 'Agent choice and Book Title are required.' });
  }

  let finalSessionId = sessionId;
  let agentArgs = '';

  if (isContinue && sessionId) {
    // Inject the persistence load flag configuration matching the agent's expectations
    agentArgs = `--continue ${sessionId}`;
  } else {
    // Generate fresh structural tracking parameters for a new book context
    finalSessionId = `book_sess_${Date.now()}`;
    const books = JSON.parse(fs.readFileSync(BOOKS_JSON_PATH, 'utf8'));
    books.push({ title, sessionId: finalSessionId, agent, createdAt: new Date() });
    fs.writeFileSync(BOOKS_JSON_PATH, JSON.stringify(books, null, 2));
  }

  // Windows command to fire up a completely distinct visible PowerShell terminal window shell
  const startCommand = `start powershell.exe -NoExit -ExecutionPolicy Bypass -Command "$env:AGENT_CMD='${agent}'; $env:AGENT_ARGS='${agentArgs}'; & './run-agent.ps1'"`;
  
  exec(startCommand, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to launch PowerShell window.' });
    res.json({ status: 'launched', sessionId: finalSessionId });
  });
});

server.listen(4000, () => console.log('Book Assistant Relay Server active on port 4000'));
```

### 2. PowerShell Script Module (`run-agent.ps1`)
```powershell
# run-agent.ps1
Clear-Host
Write-Host "Connecting to Book Writer Assistant Relay Server..." -ForegroundColor Cyan

$Client = New-Object System.Net.WebSockets.ClientWebSocket
$CT = New-Object System.Threading.CancellationToken
$ConnectTask = $Client.ConnectAsync("ws://localhost:4000/cli", $CT)
while (-not $ConnectTask.IsCompleted) { Start-Sleep -Milliseconds 10 }

$Executable = $env:AGENT_CMD
$Arguments = $env:AGENT_ARGS

Write-Host "Launching Target Workspace Session: $Executable $Arguments" -ForegroundColor Green

# Ensure target logs are clean for line by line reading pipelines
If (Test-Path ./agent_out.log) { Remove-Item ./agent_out.log }
If (Test-Path ./agent_in.log) { Remove-Item ./agent_in.log }
New-Item ./agent_out.log -ItemType File | Out-Null
New-Item ./agent_in.log -ItemType File | Out-Null

$AgentProcess = Start-Process $Executable -ArgumentList $Arguments -PassThru -NoNewWindow -RedirectStandardOutput ./agent_out.log -RedirectStandardInput ./agent_in.log

# Background Thread Job: Sync incoming prompts from web dashboard to CLI session standard input
$ScriptBlock = {
    param($Client, $AgentProcess)
    $Buffer = New-Object Byte[] 1024
    $ArraySegment = New-Object System.ArraySegment[Byte] -ArgumentList @(,$Buffer)
    
    while ($Client.State -eq "Open") {
        $CT = New-Object System.Threading.CancellationToken
        $ReceiveTask = $Client.ReceiveAsync($ArraySegment, $CT)
        while (-not $ReceiveTask.IsCompleted) { Start-Sleep -Milliseconds 50 }
        
        $Result = $ReceiveTask.Result
        if ($Result.MessageType -eq "Text") {
            $Message = [System.Text.Encoding]::UTF8.GetString($Buffer, 0, $Result.Count)
            Write-Host "`n[Web App Prompt]: $Message" -ForegroundColor Yellow
            $Message | Out-File ./agent_in.log -Append
        }
    }
}
$Job = Start-Job -ScriptBlock $ScriptBlock -ArgumentList $Client, $AgentProcess

# Foreground Main Loop: Keep terminal visible while live streaming strings over local websockets
Get-Content ./agent_out.log -Wait | ForEach-Object {
    $Line = $_
    Write-Host $Line 
    if ($Client.State -eq "Open") {
        $Bytes = [System.Text.Encoding]::UTF8.GetBytes($Line + "`n")
        $ArraySegment = New-Object System.ArraySegment[Byte] -ArgumentList @(,$Bytes)
        $SendTask = $Client.SendAsync($ArraySegment, "Text", true, $CT)
    }
}
```

### 3. Frontend Web Dashboard Layout (`index.html`)
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Book Writer Workspace</title>
</head>
<body>

  <!-- Controls to initialize a completely new book project -->
  <div>
    <h3>Create New Book Project</h3>
    <input type="text" id="newBookTitle" placeholder="Enter New Book Title...">
    <select id="agentSelect">
      <option value="claude">Claude</option>
      <option value="opencode">OpenCode</option>
    </select>
    <button onclick="createNewBook()">Start Fresh Writing Session</button>
  </div>

  <!-- Historical library book shelf items -->
  <div>
    <h3>Your Saved Books (Click Title to Continue Editing)</h3>
    <ul id="bookList"></ul>
  </div>

  <!-- Workspace visualization panel -->
  <div>
    <h3>Live Sync Output Visualization Log</h3>
    <div id="outputLog" style="background:#f4f4f4; padding:15px; border-radius:4px; min-height:200px; white-space:pre-wrap;"></div>
  </div>

  <script>
    // Handle persistent relay pipeline initialization
    const ws = new WebSocket('ws://localhost:4000/web');
    const logContainer = document.getElementById('outputLog');

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'agent_output') {
         logContainer.innerText += payload.data;
      }
    };

    window.onload = loadBooksList;

    async function loadBooksList() {
      const res = await fetch('/api/books');
      const books = await res.json();
      const listElement = document.getElementById('bookList');
      listElement.innerHTML = '';

      books.forEach(book => {
        const li = document.createElement('li');
        li.style.cursor = 'pointer';
        li.style.color = '#0066cc';
        li.style.margin = '8px 0';
        li.innerText = `📖 ${book.title} [Agent: ${book.agent}]`;
        
        li.onclick = () => resumeBookSession(book.agent, book.title, book.sessionId);
        listElement.appendChild(li);
      });
    }

    async function createNewBook() {
      const title = document.getElementById('newBookTitle').value;
      const agent = document.getElementById('agentSelect').value;
      if(!title) return alert("Please specify a book title");

      logContainer.innerText = `[System]: Spawning a fresh environment for "${title}"...\n`;
      await fetch('/api/start-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent, title, isContinue: false })
      });
      
      document.getElementById('newBookTitle').value = '';
      setTimeout(loadBooksList, 1000); 
    }

    async function resumeBookSession(agent, title, sessionId) {
      logContainer.innerText = `[System]: Resuming persistent session context for "${title}"...\n`;
      await fetch('/api/start-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent, title, sessionId, isContinue: true })
      });
    }
  </script>
</body>
</html>
```