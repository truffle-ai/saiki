export const enum SaikiErrorCode {
    SCHEMA_VALIDATION = 'schema_validation',
    INCOMPATIBLE_MODEL_PROVIDER = 'incompatible_model_provider',
    UNSUPPORTED_ROUTER = 'unsupported_router',
    MISSING_BASE_URL = 'missing_base_url',
    INVALID_BASE_URL = 'invalid_base_url',
    MISSING_API_KEY = 'missing_api_key',
    MISSING_API_KEY_CANDIDATE = 'missing_api_key_candidate',
    SHORT_API_KEY = 'short_api_key',
    MAX_INPUT_TOKENS_EXCEEDED = 'max_input_tokens_exceeded',
    UNKNOWN_MODEL = 'unknown_model',

    // examples you’ll likely need soon for other domains:
    DUPLICATE_NAME = 'duplicate_name',
    INVALID_URL = 'invalid_url',
}
