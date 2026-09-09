const message = [
	"E2E_DISABLED: Browser E2E is disabled until Vocora has a dedicated test database.",
	"Use unit, behavior, contract, regression, or agent-evaluation tests instead.",
].join(" ");

console.error(message);
process.exitCode = 1;
