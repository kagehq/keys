# Kage Keys Project

This project was initialized with [Kage Keys](https://github.com/kagehq/keys) - the enterprise permissions layer for AI agents.

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the broker:**
   ```bash
   npm start
   ```

4. **Access the dashboard:**
   - Broker: http://localhost:3000
   - Dashboard: http://localhost:8080

## 🔧 Configuration

- **Broker Config**: `config/broker.json`
- **Security Config**: `config/security.json`
- **Environment**: `.env`

## 📚 Examples

Check the `examples/` directory for integration examples:
- LangChain integration
- LlamaIndex integration  
- OpenAI Assistants integration
- GitHub Actions integration

## 🐳 Docker

```bash
# Build and run
npm run docker:build
npm run docker:run

# Or use docker-compose
docker-compose up -d
```

## ⚓ Helm (Kubernetes)

```bash
# Install
npm run helm:install

# Upgrade
npm run helm:upgrade
```

## 🔄 GitHub Actions

The project includes GitHub Actions for:
- CI/CD pipeline
- Security scanning
- One-time agent token generation

## 📖 Documentation

- [Kage Keys GitHub](https://github.com/kagehq/keys)
- [API Reference](https://github.com/kagehq/keys#api-reference)
- [Security Guide](https://github.com/kagehq/keys#security-features)

## 🤝 Support

- GitHub Issues: [kagehq/keys](https://github.com/kagehq/keys/issues)
- Documentation: [README](https://github.com/kagehq/keys#readme)
