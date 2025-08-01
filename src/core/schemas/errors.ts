export const enum SaikiErrorCode {
    SCHEMA_VALIDATION = 'schema_validation',

    LLM_INCOMPATIBLE_MODEL_PROVIDER = 'llm_incompatible_model_provider',
    LLM_UNSUPPORTED_ROUTER = 'llm_unsupported_router',
    LLM_MISSING_BASE_URL = 'llm_missing_base_url',
    LLM_INVALID_BASE_URL = 'llm_invalid_base_url',
    LLM_MISSING_API_KEY = 'llm_missing_api_key',
    LLM_MISSING_API_KEY_CANDIDATE = 'llm_missing_api_key_candidate',
    LLM_SHORT_API_KEY = 'llm_short_api_key',
    LLM_MAX_INPUT_TOKENS_EXCEEDED = 'llm_max_input_tokens_exceeded',
    LLM_UNKNOWN_MODEL = 'llm_unknown_model',

    // examples you’ll likely need soon for other domains:
    DUPLICATE_NAME = 'duplicate_name',
    INVALID_URL = 'invalid_url',
}
