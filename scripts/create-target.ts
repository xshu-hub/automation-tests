import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repositoryRoot, validateTargetID } from '../shared/config/output';

async function replaceTokens(directory: string, id: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) await replaceTokens(file, id);
    else if (entry.isFile()) await writeFile(file, (await readFile(file, 'utf8')).replaceAll('__TARGET_ID__', id));
    else throw new Error('Target templates must contain regular files and directories.');
  }
}
export async function createTarget(id: string, root = repositoryRoot): Promise<string> {
  validateTargetID(id);
  const destination = resolve(root, 'targets', id);
  await mkdir(resolve(root, 'targets'), { recursive: true });
  try {
    // Non-recursive mkdir reserves the name atomically, including concurrent generators.
    await mkdir(destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(`Target "${id}" already exists; existing files were not changed.`, { cause: error });
    }
    throw error;
  }
  try {
    const template = resolve(root, 'templates/target');
    for (const entry of await readdir(template)) {
      await cp(resolve(template, entry), resolve(destination, entry), { recursive: true, force: false, errorOnExist: true });
    }
    await replaceTokens(destination, id);
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
  return destination;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const id = process.argv[2];
  if (!id || process.argv.length !== 3) throw new Error('Usage: npm run target:new -- <lowercase-target-id>');
  await createTarget(id);
  console.log(`Created targets/${id}. Add external runtime input and business tests; see its README.md.`);
}
