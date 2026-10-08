import { describe, expect, it } from 'vitest'
import { nextOnboardingStep, onboardingProgress, onboardingSteps } from './onboarding'

const input = (over = {}) => ({ profileComplete: false, clientCount: 0, hasPlan: false, anyClientEntered: false, ...over })

describe('onboardingSteps', () => {
  it('has the four steps in order, all pending for a brand new account', () => {
    const steps = onboardingSteps(input())
    expect(steps.map(s => s.id)).toEqual(['profile', 'client', 'plan', 'access'])
    expect(steps.every(s => !s.done)).toBe(true)
  })
  it('marks each step from what the nutritionist has done', () => {
    const steps = onboardingSteps(input({ profileComplete: true, clientCount: 2, hasPlan: true }))
    expect(steps.map(s => s.done)).toEqual([true, true, true, false])
  })
})

describe('onboardingProgress / nextOnboardingStep', () => {
  it('computes the percentage and whether it is complete', () => {
    expect(onboardingProgress(onboardingSteps(input({ profileComplete: true })))).toEqual({ done: 1, total: 4, percent: 25, complete: false })
    expect(onboardingProgress(onboardingSteps(input({ profileComplete: true, clientCount: 1, hasPlan: true, anyClientEntered: true }))).complete).toBe(true)
  })
  it('points to the first step that is missing, not necessarily the next in a row', () => {
    expect(nextOnboardingStep(onboardingSteps(input({ clientCount: 1 })))?.id).toBe('profile')
    expect(nextOnboardingStep(onboardingSteps(input({ profileComplete: true, clientCount: 1 })))?.id).toBe('plan')
    expect(nextOnboardingStep(onboardingSteps(input({ profileComplete: true, clientCount: 1, hasPlan: true, anyClientEntered: true })))).toBeNull()
  })
})
