# NOX.AI Setup Guide

This guide will walk you through setting up NOX.AI with n8n step by step.

## Prerequisites

- A web browser (Chrome, Firefox, Safari, or Edge)
- An n8n instance (cloud or self-hosted)
- Optional: OpenAI API key or other AI service

## Step 1: Get NOX.AI Running

### Option A: Local Development Server

1. **Navigate to the NOX-AI directory:**
   ```bash
   cd NOX-AI
   ```

2. **Start a local server:**

   Using Python:
   ```bash
   python -m http.server 8000
   ```

   Or using Node.js:
   ```bash
   npx http-server -p 8000
   ```

3. **Open your browser:**
   Navigate to `http://localhost:8000`

### Option B: Deploy to Hosting

Upload the files to any static hosting service:
- **Netlify**: Drag and drop the folder
- **Vercel**: Deploy via GitHub integration
- **GitHub Pages**: Enable in repository settings
- **Any web server**: Upload via FTP/SFTP

## Step 2: Set Up n8n Workflow

### Import the Example Workflow

1. **Log in to your n8n instance**

2. **Import the workflow:**
   - Click on "Workflows" → "Import from File"
   - Select `n8n-workflow-example.json` from the NOX-AI folder
   - Click "Import"

3. **Configure the AI Node:**
   - Click on the "OpenAI" node (or your preferred AI service)
   - Add your API credentials
   - Adjust the system prompt if desired

4. **Activate the workflow:**
   - Click "Active" toggle in the top-right
   - Note: The workflow must be active to receive webhooks

### Get Your Webhook URL

1. **Click on the "Webhook" node**

2. **Copy the Production URL:**
   - It will look like: `https://your-n8n.com/webhook/nox-chat`
   - Save this URL - you'll need it in the next step

### Optional: Enable API Access for Execution Monitoring

1. **In n8n, go to Settings → API**

2. **Generate an API key:**
   - Click "Create API Key"
   - Give it a name: "NOX.AI Monitoring"
   - Copy the API key (you won't see it again!)

3. **Note your n8n instance URL:**
   - Example: `https://your-n8n.com`

## Step 3: Configure NOX.AI

1. **Open NOX.AI in your browser**

2. **Click the Settings button** (gear icon, bottom-right)

3. **Enter your n8n configuration:**

   - **n8n Instance URL**: Your n8n base URL
     ```
     https://your-n8n.com
     ```

   - **Webhook URL**: The webhook URL from Step 2
     ```
     https://your-n8n.com/webhook/nox-chat
     ```

   - **API Key** (optional but recommended): The API key from Step 2
     ```
     your-api-key-here
     ```

4. **Click "Save Settings"**

## Step 4: Test the Connection

1. **Type a test message:**
   ```
   Hello NOX.AI!
   ```

2. **Send the message**

3. **Watch for:**
   - ✅ Your message appears in the chat
   - ✅ A loading indicator shows
   - ✅ AI response appears
   - ✅ Execution panel shows workflow progress (if API key configured)

## Troubleshooting

### No Response from n8n

**Check:**
- Is the workflow active in n8n?
- Is the webhook URL correct?
- Check n8n executions tab for errors
- Check browser console for CORS errors

**CORS Issues:**
If you see CORS errors in the browser console:
1. In n8n, add your NOX.AI domain to allowed origins
2. Or use n8n's built-in webhook authentication

### Execution Monitoring Not Working

**Check:**
- Is the API key correct?
- Is the n8n instance URL correct (without trailing slash)?
- Does your n8n plan support API access?
- Is the workflow returning `executionId` in the response?

### Settings Not Saving

**Check:**
- Is localStorage enabled in your browser?
- Are you in private/incognito mode?
- Try clearing browser cache and reloading

## Advanced Configuration

### Custom AI Prompts

Edit the n8n workflow's "OpenAI" node:

```json
{
  "role": "system",
  "content": "Your custom system prompt here"
}
```

### Multiple AI Services

You can add multiple AI nodes in n8n:
- OpenAI for general queries
- Anthropic for analysis
- Local LLMs for privacy

Use n8n's "IF" node to route based on message content.

### Adding Memory/Context

Add a database node to store conversation history:
1. Add PostgreSQL/MongoDB node
2. Store messages with sessionId
3. Retrieve context before AI call

### Webhook Authentication

For production, add security:

1. **In n8n webhook node:**
   - Enable "Authentication"
   - Set a header key: `X-NOX-SECRET`
   - Set a secret value

2. **In NOX.AI's `n8n.js`:**
   ```javascript
   headers: {
     'Content-Type': 'application/json',
     'X-NOX-SECRET': 'your-secret-here'
   }
   ```

## Environment-Specific Tips

### n8n Cloud

- API access included in Pro plan
- Webhooks automatically HTTPS
- CORS configured by default

### Self-Hosted n8n

- Configure HTTPS for webhooks
- Set up CORS in environment variables:
  ```
  N8N_CORS_ORIGIN=https://your-nox-ai.com
  ```
- Consider using nginx reverse proxy

### Local Development

- n8n tunnel for webhook testing
- Use ngrok for NOX.AI if needed
- localhost works for both in same network

## Next Steps

Now that you're set up:

1. **Customize the theme** - Edit `css/styles.css`
2. **Enhance the workflow** - Add tools, APIs, databases
3. **Add features** - File upload, voice input, etc.
4. **Deploy** - Put it in production!

## Getting Help

- Check the main [README.md](README.md) for features
- Review n8n documentation for workflow help
- Check browser console for JavaScript errors
- Open an issue on GitHub for bugs

---

**Happy chatting with NOX.AI! 🌙**
