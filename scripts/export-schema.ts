import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { repositoryRoot } from '../shared/config/define-target';
import { runtimeSchema } from '../shared/input/schema';

// Describe accepted external input, not the parsed output with materialized defaults.
await writeFile(resolve(repositoryRoot, 'docs/runtime.schema.json'), JSON.stringify(z.toJSONSchema(runtimeSchema, { io: 'input' }), null, 2) + '\n');
console.log('Updated docs/runtime.schema.json');
