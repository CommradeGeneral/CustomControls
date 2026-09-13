import { crc32, deflateRawSync } from 'node:zlib'
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

if (!guid) throw new Error('manifest.json does not contain a valid control identity GUID')

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

if (!existsSync(controlPath)) throw new Error('The control output directory does not exist. Run the Vite build first.')

function collect(directory, prefix) {
  const entries = []
  for (const name of readdirSync(directory).sort()) {
    const absolute = path.join(directory, name)
    const archiveName = `${prefix}${name}`
    if (statSync(absolute).isDirectory()) entries.push(...collect(absolute, `${archiveName}/`))
    else entries.push({ name: archiveName, data: readFileSync(absolute) })
  }
  return entries
}

function buildZip(files) {
  const locals = []
  const centrals = []
  let offset = 0

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8')
    const compressed = deflateRawSync(file.data)
    const checksum = crc32(file.data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(file.data.length, 22)
    local.writeUInt16LE(name.length, 26)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(file.data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)

    locals.push(local, name, compressed)
    centrals.push(central, name)
    offset += local.length + name.length + compressed.length
  }

  const centralDirectory = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, centralDirectory, end])
}

const archiveName = `{${guid}}.zip`
const outputPath = path.join(outputDirectory, archiveName)
const temporaryPath = `${outputPath}.tmp`
const members = [{ name: 'manifest.json', data: readFileSync(manifestPath) }, ...collect(controlPath, 'control/')]

mkdirSync(outputDirectory, { recursive: true })
rmSync(temporaryPath, { force: true })
rmSync(outputPath, { force: true })
writeFileSync(temporaryPath, buildZip(members))
renameSync(temporaryPath, outputPath)
console.log(`Packaged ${archiveName} in ${outputDirectory}`)