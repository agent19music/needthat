export function authMessage(
  error: { message?: string; code?: string } | null | undefined,
  fallback: string,
) {
  if (!error) return fallback
  if (error.message?.includes('not configured')) {
    return 'Password reset email is not configured.'
  }
  if (
    error.code === 'INVALID_EMAIL_OR_PASSWORD' ||
    error.code === 'INVALID_USERNAME_OR_PASSWORD'
  ) {
    return 'That email, username, or password is not right.'
  }
  if (error.code === 'USERNAME_IS_ALREADY_TAKEN') return 'That username is taken.'
  if (
    error.code === 'INVALID_USERNAME' ||
    error.code === 'USERNAME_TOO_SHORT' ||
    error.code === 'USERNAME_TOO_LONG'
  ) {
    return 'Use 3 to 30 letters, numbers, or underscores.'
  }
  if (error.code === 'INVALID_TOKEN' || error.code === 'TOKEN_EXPIRED') {
    return 'This reset link has expired. Request a new one.'
  }
  return error.message || fallback
}
