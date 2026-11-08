#!/usr/bin/env node
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
const version = packageJson.version
const dist = resolve('dist')
const source = join(dist, 'linux-unpacked')
const target = join(dist, 'lychee-player')
const tarball = join(dist, `lychee-player-${version}-x86_64.tar.gz`)

if (!existsSync(join(source, 'lychee-player'))) {
  console.error(`未找到 electron-builder 产物：${source}`)
  process.exit(1)
}

await rm(target, { recursive: true, force: true })
await rm(tarball, { force: true })
await rm(`${tarball}.sha256`, { force: true })
await mkdir(target, { recursive: true })
await cp(source, target, { recursive: true, verbatimSymlinks: true })

await cp('LICENSE', join(target, 'LICENSE'))
await cp('packaging/arch/lychee-player.desktop', join(target, 'lychee-player.desktop'))
await cp('resources/icon.png', join(target, 'lychee-player.png'))
await cp('resources/flags.conf.example', join(target, 'flags.conf.example'))

const result = spawnSync('tar', ['-czf', tarball, '-C', dist, 'lychee-player'], {
  stdio: 'inherit'
})
if (result.status !== 0) process.exit(result.status ?? 1)

const digest = createHash('sha256').update(await readFile(tarball)).digest('hex')
await writeFile(`${tarball}.sha256`, `${digest}  ${tarball.split('/').pop()}\n`)
console.log(`已生成 ${tarball}`)
console.log(`已生成 ${tarball}.sha256`)
