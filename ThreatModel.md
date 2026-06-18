# Threat Model

## Attack Vectors
- **Word insertion/deletion**: Resisted by keyed placement.
- **Unicode normalization**: Addressed by stripping detection.
- **Sanitization attacks**: Leaves evidence of removal.
- **Sentence shuffling**: Alters document hash, invalidating signature.
