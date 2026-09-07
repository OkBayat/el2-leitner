# Security

Apply security guidance at the changed trust boundary.

- Authenticate identities and authorize the exact action and resource owner.
- Validate untrusted input before it reaches domain or infrastructure effects.
- Use least privilege for GitHub, worker, provider, and operational credentials.
- Keep secrets and API keys out of logs, prompts, fixtures, and generated
  evidence.
- Preserve learner, account, progress, and exercise-data privacy.
- Prefer fail-closed behavior and focused negative authorization coverage.

Never use production mutations, privileged jobs, destructive data changes, or
deployment as routine verification. Follow the owning Vocora safety contract
for any such action.
