import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  switches: new Map<string, string>(),
  file: ''
}))

function argvHasSwitch(name: string): boolean {
  return process.argv.some((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`))
}

vi.mock('electron', () => ({
  app: {
    commandLine: {
      hasSwitch: (name: string) => state.switches.has(name) || argvHasSwitch(name),
      appendSwitch: (name: string, value?: string) => {
        state.switches.set(name, value ?? '')
      },
      getSwitchValue: (name: string) => {
        if (state.switches.has(name)) return state.switches.get(name)
        const prefix = `--${name}=`
        return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? ''
      }
    }
  }
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    readFileSync: () => state.file
  }
})

const originalArgv = [...process.argv]
const originalXdgConfigHome = process.env.XDG_CONFIG_HOME

function switchValue(name: string): string | undefined {
  if (state.switches.has(name)) return state.switches.get(name)
  const prefix = `--${name}=`
  const found = process.argv.find((arg) => arg.startsWith(prefix))
  return found?.slice(prefix.length)
}

beforeEach(() => {
  state.switches.clear()
  state.file = ''
  process.argv = ['electron', '.']
  process.env.XDG_CONFIG_HOME = '/tmp/lychee-flags-test'
})

afterEach(() => {
  process.argv = [...originalArgv]
  if (originalXdgConfigHome === undefined) delete process.env.XDG_CONFIG_HOME
  else process.env.XDG_CONFIG_HOME = originalXdgConfigHome
})

describe('startup flags priority', () => {
  it('keeps explicit command-line switches above the flags file and built-in defaults', async () => {
    process.argv = ['electron', '.', '--password-store=basic', '--foo=cli']
    state.file = '--password-store=file\n--foo=file\n--bar=file'
    const { applyFlagsFromDisk } = await import('../../src/main/startup-flags')

    applyFlagsFromDisk()

    expect(switchValue('password-store')).toBe('basic')
    expect(switchValue('foo')).toBe('cli')
    expect(switchValue('bar')).toBe('file')
    expect(switchValue('autoplay-policy')).toBe('no-user-gesture-required')
  })

  it('lets the flags file override the built-in defaults', async () => {
    state.file = '--password-store=file'
    const { applyFlagsFromDisk } = await import('../../src/main/startup-flags')

    applyFlagsFromDisk()

    expect(switchValue('password-store')).toBe('file')
    expect(switchValue('autoplay-policy')).toBe('no-user-gesture-required')
  })

  it('applies built-in defaults when neither source sets the switch', async () => {
    const { applyFlagsFromDisk } = await import('../../src/main/startup-flags')

    applyFlagsFromDisk()

    expect(switchValue('password-store')).toBe('gnome-libsecret')
    expect(switchValue('autoplay-policy')).toBe('no-user-gesture-required')
  })
})
