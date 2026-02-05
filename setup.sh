#!/bin/bash

set -e

echo "OpenClawd Setup"
echo "==============="
echo ""

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from template"
else
  echo ".env file already exists"
fi
echo ""

echo "LLM Provider Configuration"
echo "--------------------------"
echo "Supported: Anthropic, OpenAI, Google, Venice, Ollama, OpenRouter, Groq, xAI, Mistral, Bedrock, and more"
echo ""
read -p "Enter your Anthropic API key (or press Enter to skip): " api_key
if [ -n "$api_key" ]; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=$api_key/" .env
  else
    sed -i "s/ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=$api_key/" .env
  fi
  echo "Anthropic API key saved to .env"
else
  echo "Skipped. Add API keys to .env manually."
fi
echo ""

echo "Installing dependencies..."
npm install
cd server && npm install && cd ..
cd messaging && npm install && cd ..
echo ""

echo "========================"
echo "Setup complete!"
echo "========================"
echo ""
echo "Available providers: Run 'curl http://localhost:3001/api/llm/providers' to see configured providers"
echo ""
echo "Next steps:"
echo "  1. Add API keys to .env for providers you want to use"
echo "  2. (Optional) Configure MCP servers in server/mcp-servers.json"
echo "  3. Start backend: cd server && npm start"
echo "  4. Start app: npm start (in another terminal)"
echo ""
echo "For messaging bot (WhatsApp/Telegram/Signal):"
echo "  cd messaging && node cli.js"
echo ""
echo "API Endpoints:"
echo "  GET  /api/llm/providers  - List LLM providers"
echo "  GET  /api/llm/models     - List available models"
echo "  GET  /api/llm/usage      - Usage statistics"
echo "  GET  /api/auth/profiles  - Auth profiles"
echo "  GET  /api/mcp/servers    - MCP servers"
echo "  POST /api/chat           - Chat endpoint"
echo ""
echo "Need help? Open an issue on GitHub!"
echo ""
