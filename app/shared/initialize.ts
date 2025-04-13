import { AgentConfig } from '../../src/config/types.js';
import { initializeServices } from '../../src/utils/service-initializer.js';

export async function initializeAgent(
  config: AgentConfig,
  connectionMode: 'strict' | 'lenient' = 'lenient'
) {
  // This function now wraps the original initializeServices
  // to provide a single point of entry for both CLI and Web UI
  return await initializeServices(config, connectionMode);
} 