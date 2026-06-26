export interface ValidationIssue {
  path?: (string | number)[]
  code?: string
  message?: string
  minimum?: number
  maximum?: number
}

const FIELD_LABELS: Record<string, string> = {
  companyName: 'Company name',
  name: 'Name',
  email: 'Email',
  password: 'Password',
}

function formatIssueMessage(field: string, issue: ValidationIssue): string {
  const label = FIELD_LABELS[field] ?? field

  if (issue.code === 'too_small' && typeof issue.minimum === 'number') {
    return `${label} must be at least ${issue.minimum} characters`
  }
  if (issue.code === 'too_big' && typeof issue.maximum === 'number') {
    return `${label} must be no more than ${issue.maximum} characters`
  }
  if (field === 'email' && (issue.code === 'invalid_string' || issue.code === 'invalid_format')) {
    return 'Please enter a valid email address'
  }

  return issue.message ?? `${label} is invalid`
}

export function fieldErrorsFromIssues(details: ValidationIssue[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {}

  for (const issue of details) {
    const field = issue.path?.[0]
    if (typeof field !== 'string' || fieldErrors[field]) continue
    fieldErrors[field] = formatIssueMessage(field, issue)
  }

  return fieldErrors
}
