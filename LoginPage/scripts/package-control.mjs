import { deflateRawSync, crc32 } from 'node:zlib'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(projectRoot, 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const controlType = manifest.control?.identity?.type ?? ''
const guid = controlType.match(/^guid:\/\/([^/]+)$/i)?.[1]

if (!guid) {
  throw new Error('manifest.json does not contain a valid control identity GUID')
}

const controlPath = path.join(projectRoot, 'control')
const repoRoot = path.resolve(projectRoot, '..')
let outputDirectory = path.join(projectRoot, 'dist-controls')
// TIA_PROJ is shared across every control project, so it lives in the repo-root
// .env. A project-local .env still wins, for overriding one project's target.
for (const envPath of [path.join(repoRoot, '.env'), path.join(projectRoot, '.env')]) {
  if (!existsSync(envPath)) continue
  const envMatch = readFileSync(envPath, 'utf8').match(/^TIA_PROJ\s*=\s*['"]?(.*?)['"]?\s*$/m)
  if (envMatch?.[1]) outputDirectory = envMatch[1].replace(/\\\\/g, '\\')
}
const archiveName = `{${guid}}.zip`
const outputPath = path.join(outputDirectory, archiveName)
// Staged next to the destination, not in the project: the two live on
// different drives here, and rename cannot cross devices.
const temporaryPath = path.join(outputDirectory, `${archiveName}.tmp`)

if (!existsSync(controlPath)) {
  throw new Error('The control output directory does not exist. Run the Vite build first.')
}

/**
 * Collect the archive members as { name, data } pairs.
 *
 * `name` is the in-archive path and must always use forward slashes: the ZIP
 * spec mandates them, and the TIA importer resolves the manifest's
 * "./control/index.html" against those names. Windows' Compress-Archive wrote
 * backslashes here, which made the import fail to find the start page.
 */
function collect(directory, prefix) {
  const entries = []
  for (const name of readdirSync(directory).sort()) {
    const absolute = path.join(directory, name)
    const archiveEntry = `${prefix}${name}`
    if (statSync(absolute).isDirectory()) {
      entries.push(...collect(absolute, `${archiveEntry}/`))
    } else {
      entries.push({ name: archiveEntry, data: readFileSync(absolute) })
    }
  }
  return entries
}

const members = [
  { name: 'manifest.json', data: readFileSync(manifestPath) },
  ...collect(controlPath, 'control/'),
]

/**
 * Minimal ZIP writer.
 *
 * Only the pieces the importer needs: deflated entries, no data descriptors, no
 * Zip64 (a web control stays far below the 4 GB / 65535-entry limits). Entries
 * are stored with UTF-8 names and the DOS "made by" host so the archive matches
 * what the Windows tooling produces for the controls that already import.
 */
function buildZip(files) {
  const locals = []
  const centrals = []
  let offset = 0

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, 'utf8')
    const compressed = deflateRawSync(file.data)
    const checksum = crc32(file.data)

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0) // local file header signature
    localHeader.writeUInt16LE(20, 4) // version needed to extract (2.0 = deflate)
    localHeader.writeUInt16LE(0x0800, 6) // general purpose flags: UTF-8 names
    localHeader.writeUInt16LE(8, 8) // compression method: deflate
    localHeader.writeUInt16LE(0, 10) // modification time
    localHeader.writeUInt16LE(0x21, 12) // modification date (1980-01-01)
    localHeader.writeUInt32LE(checksum, 14)
    localHeader.writeUInt32LE(compressed.length, 18)
    localHeader.writeUInt32LE(file.data.length, 22)
    localHeader.writeUInt16LE(nameBytes.length, 26)
    localHeader.writeUInt16LE(0, 28) // extra field length

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0) // central directory signature
    centralHeader.writeUInt16LE(20, 4) // version made by
    centralHeader.writeUInt16LE(20, 6) // version needed to extract
    centralHeader.writeUInt16LE(0x0800, 8)
    centralHeader.writeUInt16LE(8, 10)
    centralHeader.writeUInt16LE(0, 12)
    centralHeader.writeUInt16LE(0x21, 14)
    centralHeader.writeUInt32LE(checksum, 16)
    centralHeader.writeUInt32LE(compressed.length, 20)
    centralHeader.writeUInt32LE(file.data.length, 24)
    centralHeader.writeUInt16LE(nameBytes.length, 28)
    centralHeader.writeUInt16LE(0, 30) // extra field length
    centralHeader.writeUInt16LE(0, 32) // comment length
    centralHeader.writeUInt16LE(0, 34) // disk number start
    centralHeader.writeUInt16LE(0, 36) // internal attributes
    centralHeader.writeUInt32LE(0, 38) // external attributes
    centralHeader.writeUInt32LE(offset, 42) // offset of local header

    locals.push(localHeader, nameBytes, compressed)
    centrals.push(centralHeader, nameBytes)
    offset += localHeader.length + nameBytes.length + compressed.length
  }

  const centralDirectory = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0) // end of central directory signature
  end.writeUInt16LE(0, 4) // this disk
  end.writeUInt16LE(0, 6) // disk with central directory
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20) // comment length

  return Buffer.concat([...locals, centralDirectory, end])
}

mkdirSync(outputDirectory, { recursive: true })
rmSync(temporaryPath, { force: true })
rmSync(outputPath, { force: true })

writeFileSync(temporaryPath, buildZip(members))
renameSync(temporaryPath, outputPath)

console.log(`Packaged ${archiveName} in ${outputDirectory}`)
console.log(members.map((member) => `  ${member.name}`).join('\n'))
