# NOX.AI - Night Intelligence

A beautiful AI web chat application with a stunning night sky theme that seamlessly integrates with n8n workflows. NOX.AI provides real-time execution monitoring, allowing you to see workflow nodes in action, similar to Claude's MCP visualization.

![NOX.AI](https://img.shields.io/badge/Theme-Night%20Sky-blueviolet) ![n8n](https://img.shields.io/badge/Integration-n8n-red) ![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- **🌙 Night Sky Theme**: Immersive dark theme with animated stars and cosmic gradients
- **☀️ Light/Dark Mode**: Toggle between beautiful day and night themes
- **🔗 n8n Integration**: Direct webhook communication with n8n workflows
- **📊 Real-time Monitoring**: Live execution tracking with node visualization
- **🎨 Modern UI**: Clean, responsive design with smooth animations
- **⚡ Fast & Lightweight**: Vanilla JavaScript - no heavy frameworks

## 🚀 Quick Start

### 1. Clone or Download

```bash
git clone https://github.com/yourusername/NOX-AI.git
cd NOX-AI
```

### 2. Serve the Application

You can use any static file server. Here are a few options:

**Python:**
```bash
python -m http.server 8000
```

**Node.js (http-server):**
```bash
npx http-server -p 8000
```

**VS Code Live Server:**
- Install "Live Server" extension
- Right-click `index.html` and select "Open with Live Server"

### 3. Open in Browser

Navigate to `http://localhost:8000` (or your server's URL)

## 🔧 Configuration

### Setting up n8n Integration

1. **Click the Settings Button** (gear icon in the bottom-right)

2. **Configure n8n Connection:**
   - **n8n Instance URL**: Your n8n instance URL (e.g., `https://your-n8n.com`)
   - **Webhook URL**: Your n8n webhook endpoint (e.g., `https://your-n8n.com/webhook/chat`)
   - **API Key** (optional): Your n8n API key for execution monitoring

3. **Save Settings**

### Creating an n8n Workflow

Here's a simple n8n workflow example:

1. **Webhook Trigger Node**
   - Set method to `POST`
   - Path: `/chat` (or your preferred path)

2. **AI Agent Node** (OpenAI, etc.)
   - Process the incoming message
   - Generate a response

3. **Webhook Response Node**
   - Return data format:
   ```json
   {
     "reply": "Your AI response here",
     "executionId": "{{ $execution.id }}"
   }
   ```

### Enabling Execution Monitoring

To see real-time execution nodes (like Claude's MCP view):

1. **Enable n8n API Access**
   - Go to n8n Settings → API
   - Generate an API key
   - Add the key to NOX.AI settings

2. **Return Execution ID**
   - In your webhook response, include: `"executionId": "{{ $execution.id }}"`
   - NOX.AI will automatically start monitoring

## 📁 Project Structure

```
NOX-AI/
├── index.html          # Main HTML file
├── css/
│   └── styles.css      # All styles (night sky theme, animations)
├── js/
│   ├── app.js          # Main application logic
│   ├── n8n.js          # n8n integration & API
│   └── theme.js        # Theme management
├── assets/             # Images and icons (if needed)
└── README.md           # Documentation
```

## 🎨 Customization

### Changing Colors

Edit CSS variables in `css/styles.css`:

```css
:root {
    --accent-primary: #6366f1;      /* Primary accent color */
    --accent-secondary: #8b5cf6;    /* Secondary accent color */
    /* ... more variables ... */
}
```

### Modifying the Night Sky

Adjust star animations in `css/styles.css`:

```css
.stars {
    animation: animateStars 50s linear infinite;
}
```

## 🔌 API Reference

### n8n Webhook Payload

NOX.AI sends the following JSON to your webhook:

```json
{
  "message": "User's message text",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "sessionId": "session_123456789_abc"
}
```

### Expected Response Format

Your n8n workflow should return:

```json
{
  "reply": "AI assistant's response",
  "executionId": "12345" // Optional, for execution monitoring
}
```

## 🛠️ Advanced Features

### Execution Monitoring

The execution panel shows:
- **Workflow Status**: Running or Completed
- **Individual Nodes**: Each node's execution status
- **Timing Information**: Execution time for each node
- **Error Messages**: Detailed error information if nodes fail

### Session Management

- Sessions are automatically created per browser tab
- Session ID persists for the tab lifetime
- Useful for tracking conversations in n8n

## 🌐 Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (responsive design)

## 📝 Tips

- **Testing Webhooks**: Use [webhook.site](https://webhook.site) to test webhook payloads
- **CORS Issues**: Ensure your n8n instance allows CORS from your domain
- **API Key Security**: Never commit API keys to version control
- **Localhost Testing**: n8n Cloud webhooks work with localhost for testing

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🙏 Acknowledgments

- Inspired by modern AI chat interfaces
- Built for the n8n community
- Designed with love for the night sky

---

**Made with 🌙 by NOX.AI**
