# Test-Driven Development

Use TDD proportionally for changed observable behavior.

1. Reproduce the behavior with the narrowest failing regression or
   characterization test.
2. Confirm it fails for the intended reason.
3. Implement the smallest change that makes it pass.
4. Refactor only inside the tested boundary when necessary.
5. Re-run the focused regression and affected checks.

Do not add broad or duplicate tests when an existing test can express the
behavior precisely.
