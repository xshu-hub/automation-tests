import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLEANUP_TITLE, FAILURE_MARKER, FAILURE_TITLE, validateFailureReport, type ProbeReport,
} from '../failure-report';

function reportFixture(): ProbeReport {
  return {
    errors: [],
    suites: [{
      specs: [],
      suites: [{
        specs: [
          {
            title: FAILURE_TITLE,
            tests: [{
              expectedStatus: 'passed', status: 'unexpected',
              results: [{
                status: 'failed',
                errors: [{ message: `Error: ${FAILURE_MARKER}\nExpected: expected\nReceived: actual` }],
                attachments: [
                  { name: 'created-item', path: '/probe/created-item.json', contentType: 'application/json' },
                  { name: 'cleanup-verified', path: '/probe/cleanup-verified.json', contentType: 'application/json' },
                  { name: 'screenshot', path: '/probe/test-failed-1.png', contentType: 'image/png' },
                  { name: 'trace', path: '/probe/trace.zip', contentType: 'application/zip' },
                ],
              }],
            }],
          },
          {
            title: CLEANUP_TITLE,
            tests: [{
              expectedStatus: 'passed', status: 'expected',
              results: [{
                status: 'passed', errors: [],
                attachments: [{
                  name: 'post-cleanup-verified', path: '/probe/post-cleanup-verified.json', contentType: 'application/json',
                }],
              }],
            }],
          },
        ],
      }],
    }],
  };
}

function probeSpecs(report: ProbeReport) {
  return report.suites[0].suites![0].specs;
}

test('accepts the exact intentional failure and completed cleanup from nested suites', () => {
  const report = reportFixture();
  const { failure, cleanup } = validateFailureReport(report);
  assert.equal(failure, probeSpecs(report)[0].tests[0].results[0]);
  assert.equal(cleanup, probeSpecs(report)[1].tests[0].results[0]);
});

test('rejects an authentication failure even when aggregate results would be one failed and one passed', () => {
  const report = reportFixture();
  probeSpecs(report)[0].tests[0].results[0].errors = [{ message: 'HTTP status: Expected 201, received 403' }];
  assert.throws(() => validateFailureReport(report), /intentional assertion/);
});

test('rejects cleanup teardown errors in addition to the intentional assertion', () => {
  const report = reportFixture();
  probeSpecs(report)[0].tests[0].results[0].errors.push({ message: 'Cleanup failed: API context already disposed' });
  assert.throws(() => validateFailureReport(report), /exactly one intentional failure/);
});

test('rejects a skipped independent cleanup check', () => {
  const report = reportFixture();
  probeSpecs(report)[1].tests[0].results[0].status = 'skipped';
  assert.throws(() => validateFailureReport(report), /actually pass/);
});

test('rejects a report that omitted the independent cleanup case', () => {
  const report = reportFixture();
  probeSpecs(report).pop();
  assert.throws(() => validateFailureReport(report), /exactly the two/);
});

test('rejects retries that could conceal a different first failure', () => {
  const report = reportFixture();
  const results = probeSpecs(report)[0].tests[0].results;
  results.unshift({ status: 'failed', errors: [{ message: 'Connection refused' }], attachments: [] });
  assert.throws(() => validateFailureReport(report), /must not retry/);
});

for (const name of ['created-item', 'cleanup-verified', 'screenshot', 'trace']) {
  test(`rejects missing ${name} proof despite the expected assertion and result counts`, () => {
    const report = reportFixture();
    const result = probeSpecs(report)[0].tests[0].results[0];
    result.attachments = result.attachments.filter((attachment) => attachment.name !== name);
    assert.throws(() => validateFailureReport(report), /Missing failure proof/);
  });
}

test('rejects an independent cleanup attachment without a file path', () => {
  const report = reportFixture();
  delete probeSpecs(report)[1].tests[0].results[0].attachments[0].path;
  assert.throws(() => validateFailureReport(report), /Missing independent cleanup proof/);
});

test('rejects global runner errors even when both expected cases are present', () => {
  const report = reportFixture();
  report.errors = [{ message: 'Worker exited unexpectedly' }];
  assert.throws(() => validateFailureReport(report), /global runner errors/);
});
