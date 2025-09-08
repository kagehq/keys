import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);

describe('CLI Basic Tests', () => {
  const testProjectDir = './test-projects';

  beforeEach(() => {
    if (fs.existsSync(testProjectDir)) {
      fs.rmSync(testProjectDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testProjectDir)) {
      fs.rmSync(testProjectDir, { recursive: true, force: true });
    }
  });

  describe('Basic CLI Commands', () => {
    it('should show help information', async () => {
      const { stdout } = await execAsync('node dist/cli.js --help');
      
      expect(stdout).toContain('Agent Key Broker');
      expect(stdout).toContain('Commands:');
      expect(stdout).toContain('start');
      expect(stdout).toContain('init');
    });

    it('should show version information', async () => {
      const { stdout } = await execAsync('node dist/cli.js --version');
      
      expect(stdout).toContain('0.2.0');
    });

    it('should show init help', async () => {
      const { stdout } = await execAsync('node dist/cli.js init --help');
      
      expect(stdout).toContain('Initialize a new Kage Keys project');
      expect(stdout).toContain('--docker');
      expect(stdout).toContain('--helm');
      expect(stdout).toContain('--github-action');
    });

    it('should list policy packs', async () => {
      const { stdout } = await execAsync('node dist/cli.js packs');
      
      expect(stdout).toContain('Policy Packs');
      expect(stdout).toContain('llm-with-tools');
      expect(stdout).toContain('rag-bot');
      expect(stdout).toContain('github-ops-bot');
    });

    it('should show policy pack info', async () => {
      const { stdout } = await execAsync('node dist/cli.js packs --info llm-with-tools');
      
      expect(stdout).toContain('llm-with-tools');
      expect(stdout).toContain('Description:');
    });
  });

  describe('Project Initialization', () => {
    it('should initialize a new project', async () => {
      const { stdout } = await execAsync('node dist/cli.js init --port 3000');
      
      expect(stdout).toContain('Initializing new Kage Keys project');
      expect(stdout).toContain('Project created at: ./projects');
      
      // Check that project directory was created
      expect(fs.existsSync('./projects')).toBe(true);
    });

    it('should create required project files', async () => {
      await execAsync('node dist/cli.js init --port 3000');
      
      // Check required files
      expect(fs.existsSync('./projects/package.json')).toBe(true);
      expect(fs.existsSync('./projects/README.md')).toBe(true);
      expect(fs.existsSync('./projects/.env.example')).toBe(true);
      expect(fs.existsSync('./projects/config/broker.json')).toBe(true);
      expect(fs.existsSync('./projects/config/security.json')).toBe(true);
    });

    it('should initialize project with Docker configuration', async () => {
      const { stdout } = await execAsync('node dist/cli.js init --docker --port 3000');
      
      expect(stdout).toContain('Initializing new Kage Keys project');
      
      // Check that Docker files were created
      expect(fs.existsSync('./projects/Dockerfile')).toBe(true);
      expect(fs.existsSync('./projects/docker-compose.yml')).toBe(true);
    });

    it('should initialize project with Helm charts', async () => {
      const { stdout } = await execAsync('node dist/cli.js init --helm --port 3000');
      
      expect(stdout).toContain('Initializing new Kage Keys project');
      
      // Check that Helm files were created
      expect(fs.existsSync('./projects/.helm/Chart.yaml')).toBe(true);
      expect(fs.existsSync('./projects/.helm/values.yaml')).toBe(true);
    });

    it('should initialize project with GitHub Actions', async () => {
      const { stdout } = await execAsync('node dist/cli.js init --github-action --port 3000');
      
      expect(stdout).toContain('Initializing new Kage Keys project');
      
      // Check that GitHub Actions files were created
      expect(fs.existsSync('./projects/.github/workflows')).toBe(true);
    });

    it('should generate valid package.json', async () => {
      await execAsync('node dist/cli.js init --port 3000');
      
      const packageJsonPath = './projects/package.json';
      expect(fs.existsSync(packageJsonPath)).toBe(true);
      
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      
      expect(packageJson.name).toBe('kage-keys-project');
      expect(packageJson.dependencies).toHaveProperty('@kagehq/keys');
      expect(packageJson.scripts).toHaveProperty('start');
      expect(packageJson.scripts).toHaveProperty('dashboard');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid command', async () => {
      await expect(
        execAsync('node dist/cli.js invalid-command')
      ).rejects.toThrow();
    });

    it('should handle missing required options', async () => {
      await expect(
        execAsync('node dist/cli.js token create')
      ).rejects.toThrow();
    });
  });
});
