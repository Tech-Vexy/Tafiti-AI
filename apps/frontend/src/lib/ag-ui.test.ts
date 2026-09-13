import { describe, it, expect } from 'vitest'
import { CopilotKitAGUIBridge } from '@/lib/ag-ui'
import { cn } from '@/lib/utils'

describe('CopilotKitAGUIBridge.isAGUIEvent', () => {
  it('accepts events with a string type', () => {
    expect(CopilotKitAGUIBridge.isAGUIEvent({ type: 'STEP_STARTED' })).toBe(true)
  })

  it('accepts events with a runId', () => {
    expect(CopilotKitAGUIBridge.isAGUIEvent({ type: 'custom', runId: 'run_1' })).toBe(true)
  })

  it('rejects null and non-objects', () => {
    expect(CopilotKitAGUIBridge.isAGUIEvent(null)).toBe(false)
    expect(CopilotKitAGUIBridge.isAGUIEvent('STEP_STARTED')).toBe(false)
  })

  it('rejects objects without a type or runId', () => {
    expect(CopilotKitAGUIBridge.isAGUIEvent({ payload: {} })).toBe(false)
  })
})

describe('CopilotKitAGUIBridge.normalizeStep', () => {
  it('normalizes a minimal raw step', () => {
    const step = CopilotKitAGUIBridge.normalizeStep({ id: 'abc', label: 'Search' })
    expect(step.stepId).toBe('abc')
    expect(step.stepName).toBe('Search')
    expect(step.status).toBe('completed')
  })

  it('maps elapsed_ms into both fields', () => {
    const step = CopilotKitAGUIBridge.normalizeStep({ stepId: 's1', elapsed_ms: 1200 })
    expect(step.durationMs).toBe(1200)
    expect(step.elapsed_ms).toBe(1200)
  })

  it('falls back for empty input', () => {
    const step = CopilotKitAGUIBridge.normalizeStep({})
    expect(step.stepId).toBe('step_unknown')
    expect(step.stepName).toBe('Executing Step')
  })
})

describe('cn', () => {
  it('merges Tailwind class conflicts', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('filters falsy values', () => {
    expect(cn('a', false && 'b', null, undefined, 0 && 'c')).toBe('a')
  })
})