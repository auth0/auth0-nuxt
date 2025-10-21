const core = require('@actions/core');
const github = require('@actions/github');
const load = require('@commitlint/load').default;
const lint = require('@commitlint/lint').default;
const format = require('@commitlint/format').default;

async function run() {
  try {
    // 1. Get the pull request title
    const prTitle = github.context.payload.pull_request?.title;

    if (!prTitle) {
      core.setFailed('⛔️ Could not get pull request title. This action should only be run on a pull_request event.');
      return;
    }

    core.info(`📝 Validating PR Title: "${prTitle}"`);

    // 2. Load the commitlint configuration from the repository
    const config = await load();
    core.info('✅ Loaded commitlint configuration successfully.');

    // 3. Lint the pull request title
    const result = await lint(prTitle, config.rules, {
      defaultIgnores: config.defaultIgnores,
      helpUrl: config.helpUrl,
    });

    // 4. Report the results
    if (result.valid) {
      core.info('✅ PR title is valid.');
    } else {
      const formattedErrors = format({ results: [result] }, { color: false });
      core.setFailed(`⛔️ PR title validation failed:\n${formattedErrors}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`⛔️ Action failed with error: ${error.message}`);
    } else {
      core.setFailed('⛔️ An unknown error occurred.');
    }
  }
}

run();
