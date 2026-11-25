#!/usr/bin/env node
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
const version = packageJson.version
const dist = resolve('dist')
const source = join(dist, 'linux-unpacked')
const target = join(dist, 'lychee-player')
const base = `lychee-player-${version}-x86_64`
const tarballGz = join(dist, `${base}.tar.gz`)
const tarballZst = join(dist, `${base}.tar.zst`)

if (!existsSync(join(source, 'lychee-player'))) {
  console.error(`未找到 electron-builder 产物：${source}`)
  process.exit(1)
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.error) {
    console.error(`无法执行 ${command}：${result.error.message}`)
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
}

async function writeDigest(tarball) {
  const digest = createHash('sha256').update(await readFile(tarball)).digest('hex')
  await writeFile(`${tarball}.sha256`, `${digest}  ${tarball.split('/').pop()}\n`)
  const { size } = await stat(tarball)
  console.log(`已生成 ${tarball}（${(size / 1024 / 1024).toFixed(1)} MiB）`)
  console.log(`已生成 ${tarball}.sha256`)
}

await rm(target, { recursive: true, force: true })
await rm(tarballGz, { force: true })
await rm(`${tarballGz}.sha256`, { force: true })
await rm(tarballZst, { force: true })
await rm(`${tarballZst}.sha256`, { force: true })
await mkdir(target, { recursive: true })
await cp(source, target, { recursive: true, verbatimSymlinks: true })

await cp('LICENSE', join(target, 'LICENSE'))
await cp('packaging/arch/lychee-player.desktop', join(target, 'lychee-player.desktop'))
await cp('resources/icon.png', join(target, 'lychee-player.png'))
await cp('resources/flags.conf.example', join(target, 'flags.conf.example'))

// gzip 产物保留给旧安装脚本 / 旧链接使用。
run('tar', ['-czf', tarballGz, '-C', dist, 'lychee-player'])
await writeDigest(tarballGz)

// zstd 产物是新的推荐格式：同内容约小 23%，解压更快。
const hasZstd = spawnSync('zstd', ['--version'], { stdio: 'ignore' }).status === 0
if (hasZstd) {
  const plainTar = join(dist, `${base}.tar`)
  await rm(plainTar, { force: true })
  run('tar', ['-cf', plainTar, '-C', dist, 'lychee-player'])
  run('zstd', ['-19', '-T0', '-q', '-f', '-o', tarballZst, plainTar])
  await rm(plainTar, { force: true })
  await writeDigest(tarballZst)
} else {
  console.warn('未找到 zstd，跳过 tar.zst 产物')
}
