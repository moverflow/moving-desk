import { describe, it, expect } from 'vitest'
import { fieldErrorsFromIssues } from './validation-errors'

describe('fieldErrorsFromIssues', () => {
  it('formats password too_small as user-friendly message', () => {
    const errors = fieldErrorsFromIssues([
      {
        code: 'too_small',
        minimum: 8,
        path: ['password'],
        message: 'Too small: expected string to have >=8 characters',
      },
    ])

    expect(errors.password).toBe('Password must be at least 8 characters')
  })

  it('formats email validation error', () => {
    const errors = fieldErrorsFromIssues([
      {
        code: 'invalid_string',
        path: ['email'],
        message: 'Invalid email',
      },
    ])

    expect(errors.email).toBe('Please enter a valid email address')
  })

  it('keeps only the first error per field', () => {
    const errors = fieldErrorsFromIssues([
      { code: 'too_small', minimum: 2, path: ['name'] },
      { code: 'too_big', maximum: 100, path: ['name'] },
    ])

    expect(errors.name).toBe('Name must be at least 2 characters')
  })
})
