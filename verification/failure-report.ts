import assert from 'node:assert/strict';

export const FAILURE_TITLE = 'intentional failure produces artifacts and still cleans data';
export const CLEANUP_TITLE = 'the preceding failed test left no business data';
export const FAILURE_MARKER = 'EXPECTED_FAILURE_PROBE';

interface Attachment { name: string; path?: string; contentType: string }
interface Result { status: string; errors: { message?: string }[]; attachments: Attachment[] }
interface ProbeTest { results: Result[]; expectedStatus?: string; status?: string }
interface Spec { title: string; tests: ProbeTest[] }
interface Suite { specs: Spec[]; suites?: Suite[] }
export interface ProbeReport { suites: Suite[]; errors?: unknown[] }

/** Validate individual outcomes and proof attachments, never just aggregated counts. */
export function validateFailureReport(report: ProbeReport): { failure: Result; cleanup: Result } {
  assert.equal(report.errors?.length ?? 0, 0, 'Unexpected global runner errors.');
  const specs: Spec[] = [];
  const visit = (suite: Suite): void => {
    specs.push(...suite.specs);
    suite.suites?.forEach(visit);
  };
  report.suites.forEach(visit);
  assert.equal(specs.length, 2, 'Expected exactly the two failure-probe cases.');
  const get = (title: string): Result => {
    const matches = specs.filter((spec) => spec.title === title);
    assert.equal(matches.length, 1, `Missing or duplicate probe case: ${title}`);
    assert.equal(matches[0].tests.length, 1, 'Probe must run on one project only.');
    assert.equal(matches[0].tests[0].results.length, 1, 'Probe must not retry or omit execution.');
    return matches[0].tests[0].results[0];
  };
  const failure = get(FAILURE_TITLE);
  const cleanup = get(CLEANUP_TITLE);
  assert.equal(failure.status, 'failed', 'The first probe must fail at the intentional assertion.');
  assert.equal(failure.errors.length, 1, 'The probe must have exactly one intentional failure.');
  assert.ok(failure.errors[0].message?.includes(FAILURE_MARKER), 'Failure did not reach the intentional assertion.');
  assert.equal(cleanup.status, 'passed', 'The post-cleanup probe must actually pass.');
  assert.equal(cleanup.errors.length, 0, 'The post-cleanup probe contains errors.');
  for (const name of ['created-item', 'cleanup-verified', 'screenshot', 'trace']) {
    assert.ok(failure.attachments.some((attachment) => attachment.name === name && attachment.path), `Missing failure proof: ${name}`);
  }
  assert.ok(cleanup.attachments.some((attachment) => attachment.name === 'post-cleanup-verified' && attachment.path), 'Missing independent cleanup proof.');
  return { failure, cleanup };
}
