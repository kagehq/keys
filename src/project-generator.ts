import * as fs from 'fs';
import * as path from 'path';

export async function generateConfigFiles(projectDir: string, options: any): Promise<void> {
  console.log('📝 Generating configuration files...');
  
  // Create config directory
  const configDir = path.join(projectDir, 'config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  // Generate broker config
  const brokerConfig = {
    port: parseInt(options.port),
    enableHTTPS: false,
    enableMTLS: false,
    cors: {
      origins: ['http://localhost:3000', 'http://localhost:8080'],
      credentials: true
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100
    }
  };
  
  fs.writeFileSync(
    path.join(projectDir, 'config', 'broker.json'),
    JSON.stringify(brokerConfig, null, 2)
  );
  
  // Generate security config
  const securityConfig = {
    tls: {
      enabled: false,
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3'
    },
    mtls: {
      enabled: false,
      verifyClient: true
    },
    cors: {
      enabled: true,
      origins: ['http://localhost:3000', 'http://localhost:8080'],
      credentials: true
    },
    csrf: {
      enabled: true,
      tokenLength: 32
    },
    session: {
      enabled: true,
      maxAge: 24 * 60 * 60 * 1000,
      secure: false,
      httpOnly: true,
      sameSite: 'strict'
    }
  };
  
  fs.writeFileSync(
    path.join(projectDir, 'config', 'security.json'),
    JSON.stringify(securityConfig, null, 2)
  );
  
  // Generate environment template
  const envTemplate = `# Kage Keys Environment Configuration
# Copy this to .env and fill in your values

# Broker Configuration
BROKER_PORT=${options.port}
BROKER_HOST=localhost

# Security
HMAC_SECRET=your-secret-key-here
ENABLE_HTTPS=false
ENABLE_MTLS=false

# Database
AUDIT_DB_PATH=./logs/audit.db

# API Keys (for demo purposes)
OPENAI_API_KEY=your-openai-key-here
GITHUB_TOKEN=your-github-token-here
SLACK_TOKEN=your-slack-token-here

# CORS Origins
CORS_ORIGINS=http://localhost:3000,http://localhost:8080
`;
  
  fs.writeFileSync(
    path.join(projectDir, '.env.example'),
    envTemplate
  );
}

export async function generateExampleIntegrations(projectDir: string): Promise<void> {
  console.log('🔧 Generating example integrations...');
  
  // Create examples directory
  const examplesDir = path.join(projectDir, 'examples');
  if (!fs.existsSync(examplesDir)) {
    fs.mkdirSync(examplesDir, { recursive: true });
  }
  
  // LangChain integration example
  const langchainExample = `import { withAgentKey } from '@kagehq/keys';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { HumanMessage } from 'langchain/schema';

async function chatWithAuth() {
  const agentKey = 'your-agent-key-here';
  
  try {
    const result = await withAgentKey(agentKey, async (token) => {
      const llm = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        temperature: 0.7,
      });
      
      const response = await llm.call([
        new HumanMessage("Hello! I'm an AI agent with authenticated access.")
      ]);
      
      return response;
    });
    
    console.log('Chat response:', result);
  } catch (error) {
    console.error('Authentication failed:', error);
  }
}

chatWithAuth();
`;
  
  fs.writeFileSync(
    path.join(projectDir, 'examples', 'langchain-integration.js'),
    langchainExample
  );
  
  // LlamaIndex integration example
  const llamaIndexExample = `import { withAgentKey } from '@kagehq/keys';
import { OpenAI } from 'llamaindex/llms/openai';
import { Document } from 'llamaindex/schema/Document';

async function ragWithAuth() {
  const agentKey = 'your-agent-key-here';
  
  try {
    const result = await withAgentKey(agentKey, async (token) => {
      const llm = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        temperature: 0.1,
      });
      
      const document = new Document({
        text: "This is a sample document for RAG processing.",
        metadata: { source: "example" }
      });
      
      // Process document with authenticated access
      return { document, llm: llm.constructor.name };
    });
    
    console.log('RAG result:', result);
  } catch (error) {
    console.error('Authentication failed:', error);
  }
}

ragWithAuth();
`;
  
  fs.writeFileSync(
    path.join(projectDir, 'examples', 'llamaindex-integration.js'),
    llamaIndexExample
  );
  
  // OpenAI Assistants integration example
  const openaiAssistantsExample = `import { withAgentKey } from '@kagehq/keys';
import OpenAI from 'openai';

async function assistantWithAuth() {
  const agentKey = 'your-agent-key-here';
  
  try {
    const result = await withAgentKey(agentKey, async (token) => {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      const assistant = await openai.beta.assistants.create({
        name: "Kage Keys Assistant",
        instructions: "I'm an AI assistant with authenticated access to tools.",
        model: "gpt-4-turbo-preview",
        tools: [{ type: "code_interpreter" }],
      });
      
      return { assistantId: assistant.id, name: assistant.name };
    });
    
    console.log('Assistant created:', result);
  } catch (error) {
    console.error('Authentication failed:', error);
  }
}

assistantWithAuth();
`;
  
  fs.writeFileSync(
    path.join(projectDir, 'examples', 'openai-assistants-integration.js'),
    openaiAssistantsExample
  );
  
  // GitHub Actions integration example
  const githubActionsExample = `import { withAgentKey } from '@kagehq/keys';
import { Octokit } from '@octokit/rest';

async function githubOpsWithAuth() {
  const agentKey = process.env.KAGE_AGENT_KEY;
  
  try {
    const result = await withAgentKey(agentKey, async (token) => {
      const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
      });
      
      // List repositories with authenticated access
      const { data: repos } = await octokit.repos.listForAuthenticatedUser({
        per_page: 10,
      });
      
      return repos.map(repo => ({
        name: repo.name,
        description: repo.description,
        url: repo.html_url
      }));
    });
    
    console.log('Repositories:', result);
  } catch (error) {
    console.error('Authentication failed:', error);
  }
}

githubOpsWithAuth();
`;
  
  fs.writeFileSync(
    path.join(projectDir, 'examples', 'github-actions-integration.js'),
    githubActionsExample
  );
}

export async function generateDockerConfig(projectDir: string): Promise<void> {
  console.log('🐳 Generating Docker configuration...');
  
  const dockerfile = `FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S kagekeys -u 1001
USER kagekeys

# Expose ports
EXPOSE 3000 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]
`;
  
  fs.writeFileSync(
    path.join(projectDir, 'Dockerfile'),
    dockerfile
  );
  
  const dockerCompose = `version: '3.8'

services:
  kage-keys:
    build: .
    ports:
      - "3000:3000"  # Broker
      - "8080:8080"  # Dashboard
    environment:
      - NODE_ENV=production
      - BROKER_PORT=3000
    volumes:
      - ./logs:/app/logs
      - ./config:/app/config
      - ./certs:/app/certs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Optional: PostgreSQL for production audit logs
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: kagekeys
      POSTGRES_USER: kagekeys
      POSTGRES_PASSWORD: your-password-here
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

volumes:
  postgres_data:
`;
  
  fs.writeFileSync(
    path.join(projectDir, 'docker-compose.yml'),
    dockerCompose
  );
  
  const dockerIgnore = `node_modules
npm-debug.log
logs
*.log
.env
.env.local
.env.production
.git
.gitignore
README.md
Dockerfile
docker-compose.yml
.helm
`;
  
  fs.writeFileSync(
    path.join(projectDir, '.dockerignore'),
    dockerIgnore
  );
}

export async function generateHelmChart(projectDir: string): Promise<void> {
  console.log('⚓ Generating Helm chart...');
  
  const helmDir = path.join(projectDir, '.helm');
  const templatesDir = path.join(helmDir, 'templates');
  if (!fs.existsSync(helmDir)) {
    fs.mkdirSync(helmDir, { recursive: true });
  }
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }
  
  const chartYaml = `apiVersion: v2
name: kage-keys
description: Agent Key Broker for AI agents
type: application
version: 0.4.1
appVersion: "0.4.1"
keywords:
  - ai
  - agents
  - authentication
  - security
home: https://github.com/kagehq/keys
sources:
  - https://github.com/kagehq/keys
maintainers:
  - name: Kage HQ
    email: team@kagehq.com
`;
  
  fs.writeFileSync(
    path.join(helmDir, 'Chart.yaml'),
    chartYaml
  );
  
  const valuesYaml = `# Default values for kage-keys
replicaCount: 1

image:
  repository: kagehq/keys
  tag: "0.4.1"
  pullPolicy: IfNotPresent

imagePullSecrets: []
nameOverride: ""
fullnameOverride: ""

serviceAccount:
  create: true
  annotations: {}
  name: ""

podAnnotations: {}

podSecurityContext: {}

securityContext: {}

service:
  type: ClusterIP
  port: 3000
  dashboardPort: 8080

ingress:
  enabled: false
  className: ""
  annotations: {}
  hosts:
    - host: chart-example.local
      paths:
        - path: /
          pathType: ImplementationSpecific
  tls: []

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 100
  targetCPUUtilizationPercentage: 80

nodeSelector: {}

tolerations: []

affinity: {}

# Kage Keys specific configuration
config:
  broker:
    port: 3000
    enableHTTPS: false
    enableMTLS: false
  security:
    cors:
      origins: []
      credentials: true
    csrf:
      enabled: true
    session:
      enabled: true
      secure: false
`;
  
  fs.writeFileSync(
    path.join(helmDir, 'values.yaml'),
    valuesYaml
  );
  
  const deploymentYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "kage-keys.fullname" . }}
  labels:
    {{- include "kage-keys.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "kage-keys.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "kage-keys.selectorLabels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ include "kage-keys.serviceAccountName" . }}
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: broker
              containerPort: {{ .Values.config.broker.port }}
              protocol: TCP
            - name: dashboard
              containerPort: {{ .Values.service.dashboardPort }}
              protocol: TCP
          livenessProbe:
            httpGet:
              path: /health
              port: broker
          readinessProbe:
            httpGet:
              path: /health
              port: broker
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
`;
  
  fs.writeFileSync(
    path.join(helmDir, 'templates', 'deployment.yaml'),
    deploymentYaml
  );
}

export async function generateGitHubAction(projectDir: string): Promise<void> {
  console.log('🔄 Generating GitHub Action...');
  
  const actionsDir = path.join(projectDir, '.github', 'workflows');
  if (!fs.existsSync(actionsDir)) {
    fs.mkdirSync(actionsDir, { recursive: true });
  }
  
  const workflowYaml = `name: Kage Keys CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Use Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Build
      run: npm run build

  security-scan:
    runs-on: ubuntu-latest
    needs: test
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Run security scan
      uses: actions/dependency-review-action@v3
    
    - name: Run SAST scan
      uses: github/codeql-action/analyze@v2
      with:
        languages: javascript

  deploy:
    runs-on: ubuntu-latest
    needs: [test, security-scan]
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Deploy to staging
      run: |
        echo "Deploying to staging environment"
        # Add your deployment commands here
    
    - name: Deploy to production
      run: |
        echo "Deploying to production environment"
        # Add your deployment commands here

  # Kage Keys specific: Generate one-time agent tokens
  generate-tokens:
    runs-on: ubuntu-latest
    if: github.event_name == 'workflow_dispatch'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Use Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install Kage Keys
      run: npm install @kagehq/keys
    
    - name: Generate agent token
      run: |
        node -e "
        const { createToken } = require('@kagehq/keys');
        
        async function generateToken() {
          const token = await createToken(
            'github-actions',
            'github:repos.read,github:issues.read',
            3600, // 1 hour
            './audit.db'
          );
          console.log('Generated token:', token);
          console.log('::set-output name=agent-token::' + token);
        }
        
        generateToken();
        "
      id: token-generation
    
    - name: Use agent token
      run: |
        echo "Agent token generated successfully"
        echo "Token: \${{ steps.token-generation.outputs.agent-token }}"
        # Use this token for authenticated GitHub operations
`;
  
  fs.writeFileSync(
    path.join(actionsDir, 'ci-cd.yml'),
    workflowYaml
  );
  
  const tokenWorkflow = `name: Generate One-Time Agent Token

on:
  workflow_dispatch:
    inputs:
      agent_name:
        description: 'Agent name'
        required: true
        default: 'github-actions'
      scope:
        description: 'Scope for the agent'
        required: true
        default: 'github:repos.read,github:issues.read'
      duration:
        description: 'Token duration in seconds'
        required: true
        default: '3600'

jobs:
  generate-token:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Use Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install Kage Keys
      run: npm install @kagehq/keys
    
    - name: Generate one-time agent token
      run: |
        node -e "
        const { createToken } = require('@kagehq/keys');
        
        async function generateToken() {
          const token = await createToken(
            '\${{ github.event.inputs.agent_name }}',
            '\${{ github.event.inputs.scope }}',
            parseInt('\${{ github.event.inputs.duration }}'),
            './audit.db'
          );
          
          console.log('Generated one-time agent token:');
          console.log('Agent:', '\${{ github.event.inputs.agent_name }}');
          console.log('Scope:', '\${{ github.event.inputs.scope }}');
          console.log('Duration:', '\${{ github.event.inputs.duration }}s');
          console.log('Token:', token);
          
          # Set output for use in other steps
          console.log('::set-output name=agent-token::' + token);
        }
        
        generateToken().catch(console.error);
        "
      id: token-generation
    
    - name: Use token for authenticated operations
      run: |
        echo "Using agent token for authenticated operations..."
        # Example: Use the token to make authenticated API calls
        # curl -H "X-Agent-Key: \${{ steps.token-generation.outputs.agent-token }}" \\
        #      https://api.github.com/user/repos
`;
  
  fs.writeFileSync(
    path.join(actionsDir, 'generate-token.yml'),
    tokenWorkflow
  );
}

export async function generatePackageJson(projectDir: string): Promise<void> {
  console.log('📦 Generating package.json...');
  
  const packageJson = {
    name: "kage-keys-project",
    version: "1.0.0",
    description: "Kage Keys project for AI agent authentication",
    main: "index.js",
    scripts: {
      "start": "kage-keys start",
      "dev": "kage-keys start --port 3000",
      "dashboard": "kage-keys start --port 8080",
      "test": "echo \"No tests specified\" && exit 0",
      "build": "echo \"No build step required\"",
      "docker:build": "docker build -t kage-keys .",
      "docker:run": "docker run -p 3000:3000 -p 8080:8080 kage-keys",
      "helm:install": "helm install kage-keys ./.helm",
      "helm:upgrade": "helm upgrade kage-keys ./.helm"
    },
    dependencies: {
      "@kagehq/keys": "^0.4.1",
      "dotenv": "^16.0.0"
    },
    devDependencies: {
      "@types/node": "^18.0.0",
      "typescript": "^5.0.0"
    },
    keywords: [
      "ai",
      "agents",
      "authentication",
      "security",
      "kage-keys"
    ],
    author: "Your Name",
    license: "MIT"
  };
  
  fs.writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
}

export async function generateREADME(projectDir: string): Promise<void> {
  console.log('📚 Generating README...');
  
  const readme = `# Kage Keys Project

This project was initialized with [Kage Keys](https://github.com/kagehq/keys) - the enterprise permissions layer for AI agents.

## 🚀 Quick Start

1. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Configure environment:**
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your configuration
   \`\`\`

3. **Start the broker:**
   \`\`\`bash
   npm start
   \`\`\`

4. **Access the dashboard:**
   - Broker: http://localhost:3000
   - Dashboard: http://localhost:8080

## 🔧 Configuration

- **Broker Config**: \`config/broker.json\`
- **Security Config**: \`config/security.json\`
- **Environment**: \`.env\`

## 📚 Examples

Check the \`examples/\` directory for integration examples:
- LangChain integration
- LlamaIndex integration  
- OpenAI Assistants integration
- GitHub Actions integration

## 🐳 Docker

\`\`\`bash
# Build and run
npm run docker:build
npm run docker:run

# Or use docker-compose
docker-compose up -d
\`\`\`

## ⚓ Helm (Kubernetes)

\`\`\`bash
# Install
npm run helm:install

# Upgrade
npm run helm:upgrade
\`\`\`

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
`;
  
  fs.writeFileSync(
    path.join(projectDir, 'README.md'),
    readme
  );
}
