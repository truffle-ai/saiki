/**
 * Interface for allowed tools storage (in-memory, DB, etc.)
 *
 * Multi-user support: For multi-tenancy, we can consider either:
 *  - Instantiating a provider per user (current pattern, recommended for most cases)
 *  - Or, add userId as a parameter to each method for batch/admin/multi-user operations:
 *      allowTool(toolName: string, userId: string): Promise<void>
 *      ...etc.
 *  - You can also add static/factory methods to create user-scoped providers, e.g.,
 *      AllowedToolsProvider.forUser(userId)
 *
 * AllowedToolsProvider supports both single-user and multi-user scenarios.
 * - If `userId` is omitted, the implementation will use a default user (e.g., from getUserId()).
 * - For multi-user/admin scenarios, always pass `userId` explicitly.
 * - We can enforce this by having a separate env variable/feature-flag for multi-user and having
 *   strict check for the user id if the feature flag is set.
 */
export interface IAllowedToolsProvider {
    allowTool(toolName: string, userId?: string): Promise<void>;
    disallowTool(toolName: string, userId?: string): Promise<void>;
    isToolAllowed(toolName: string, userId?: string): Promise<boolean>;
    getAllowedTools?(userId?: string): Promise<Set<string>>;
}
